"use client";
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { uploadEvidence } from '@/lib/data/payments';
import { createPaymentForSession } from '@/lib/rpc';
import { centsToUsd, getUsdVesRate, round2 } from '@/lib/data/rate';
import { VE_CITIES } from '@/lib/data/cities';

export const checkoutSchema = z.object({
  email: z.string().email({ message: 'Email inválido' }).optional().or(z.literal('')),
  phone: z.string().min(6, 'Teléfono requerido'),
  city: z.string().min(2, 'Ciudad requerida'),
  method: z.string().min(1, 'Selecciona un método'),
  reference: z.string().optional().or(z.literal('')),
  amount_ves: z.string().optional(),
  evidence: z.any().optional(),
});

export function CheckoutForm({
  raffleId,
  sessionId,
  currency = 'VES',
  disabled = false,
  onCreated,
  quantity,
  unitPriceCents,
  methodLabel,
}: {
  raffleId: string;
  sessionId: string;
  currency?: string;
  disabled?: boolean;
  onCreated?: (paymentId: string) => void;
  quantity?: number;
  unitPriceCents?: number;
  methodLabel?: string;
}) {
  const { register, handleSubmit, setValue, formState: { errors }, watch, reset } = useForm<z.infer<typeof checkoutSchema>>({
    resolver: zodResolver(checkoutSchema),
  });

  // Control del selector de ciudad: si el usuario elige 'OTRA', mostramos campo libre
  const [citySelect, setCitySelect] = useState<string>('');

  // Tasa USD->VES
  const [rateInfo, setRateInfo] = useState<{ rate: number; source?: string } | null>(null);
  useEffect(() => {
    (async () => {
      const info = await getUsdVesRate();
      if (info && info.rate > 0) setRateInfo({ rate: info.rate, source: info.source });
    })();
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    let evidence_url: string | null = null;
    const ev = watch('evidence') as File | undefined;
    if (ev && typeof ev !== 'string') {
      evidence_url = await uploadEvidence(ev, `evidence/${raffleId}/${sessionId}`);
    }
    // Calcular montos y tasa usada
    const unitUSD = centsToUsd(unitPriceCents ?? 0);
    const count = quantity ?? 0;
    const totalUSD = round2(unitUSD * count);
    const rateUsed = rateInfo?.rate ?? 0;
    const amountVES = rateUsed ? String(round2(totalUSD * rateUsed)) : null;
    const paymentId = await createPaymentForSession({
      p_raffle_id: raffleId,
      p_session_id: sessionId,
      p_email: values.email || null,
      p_phone: values.phone,
      p_city: values.city,
      p_method: values.method,
      p_reference: values.reference || null,
      p_evidence_url: evidence_url,
      p_amount_ves: amountVES,
      p_rate_used: rateUsed ? String(rateUsed) : null,
      p_rate_source: rateInfo?.source ?? null,
      p_currency: currency,
    });
    onCreated?.(paymentId);
    reset();
  });

  const evidence = watch('evidence');

  const count = quantity ?? 0;
  const unitUSD = centsToUsd(unitPriceCents ?? 0);
  const rate = rateInfo?.rate ?? 0;
  const unitVES = useMemo(() => (rate ? round2(unitUSD * rate) : 0), [unitUSD, rate]);
  const totalVES = useMemo(() => round2(unitVES * count), [unitVES, count]);

  return (
    <form onSubmit={onSubmit} className="space-y-4 border rounded-xl p-4 bg-white shadow-sm">
      <h2 className="text-lg font-semibold">Confirmar pago</h2>
      {count > 0 && (
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="p-2 rounded border bg-gray-50">
            <div className="text-xs text-gray-600">Cantidad</div>
            <div className="font-semibold">{count}</div>
          </div>
          <div className="p-2 rounded border bg-gray-50">
            <div className="text-xs text-gray-600">Precio unitario (Bs)</div>
            <div className="font-semibold">{rate ? unitVES.toFixed(2) : '—'} Bs</div>
          </div>
          <div className="p-2 rounded border bg-gray-50">
            <div className="text-xs text-gray-600">Total (Bs)</div>
            <div className="font-semibold">{rate ? totalVES.toFixed(2) : '—'} Bs</div>
          </div>
        </div>
      )}
      {rateInfo?.rate && (
        <p className="text-xs text-gray-600">Tasa BCV usada: {Number(rateInfo.rate).toFixed(2)} Bs/USD</p>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Email (opcional)</label>
          <input type="email" className="mt-1 w-full border rounded-lg p-2" placeholder="tucorreo@mail.com" {...register('email')} />
          {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message as string}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium">Teléfono</label>
          <input type="tel" className="mt-1 w-full border rounded-lg p-2" placeholder="0412-0000000" {...register('phone')} />
          {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone.message as string}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium">Ciudad</label>
          <select
            className="mt-1 w-full border rounded-lg p-2"
            value={citySelect || ''}
            onChange={(e) => {
              const val = e.target.value;
              setCitySelect(val);
              if (val && val !== 'OTRA') {
                setValue('city', val, { shouldValidate: true });
              } else {
                setValue('city', '', { shouldValidate: true });
              }
            }}
          >
            <option value="" disabled>Selecciona tu ciudad</option>
            {VE_CITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
            <option value="OTRA">Otra…</option>
          </select>
          {citySelect === 'OTRA' && (
            <input
              type="text"
              className="mt-2 w-full border rounded-lg p-2"
              placeholder="Escribe tu ciudad"
              {...register('city')}
            />
          )}
          {errors.city && <p className="text-xs text-red-600 mt-1">{errors.city.message as string}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium">Método de pago</label>
          <div className="mt-1 w-full border rounded-lg p-2 bg-gray-100">{methodLabel ?? ''}</div>
          <input type="hidden" value={methodLabel ?? ''} {...register('method')} />
        </div>
        <div>
          <label className="block text-sm font-medium">Referencia (opcional)</label>
          <input type="text" className="mt-1 w-full border rounded-lg p-2" placeholder="N° referencia o hash" {...register('reference')} />
        </div>
        {/* Monto en VES calculado automáticamente con la tasa; lo enviamos oculto */}
        <input type="hidden" value={rate ? String(totalVES) : ''} {...register('amount_ves')} />
        <div>
          <label className="block text-sm font-medium">Evidencia (imagen/pdf)</label>
          <input type="file" accept="image/*,.pdf" className="mt-1 w-full border rounded-lg p-2"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setValue('evidence', f as any, { shouldValidate: false }); }} />
          {evidence && typeof evidence !== 'string' && (
            <p className="text-xs text-gray-500 mt-1">Archivo: {(evidence as File).name}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-60" disabled={disabled}>Enviar pago</button>
      </div>
    </form>
  );
}
