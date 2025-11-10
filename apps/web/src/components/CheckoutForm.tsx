"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { uploadEvidence } from '@/lib/data/payments';
import { createPaymentForSession, ensureSession } from '@/lib/rpc';
import { centsToUsd, getBcvRatePreferApi, getEnvFallbackRate, round0, round1, round2 } from '@/lib/data/rate';
import { VE_CITIES } from '@/lib/data/cities';

export const checkoutSchema = z.object({
  email: z.string().email({ message: 'Email inválido' }).optional().or(z.literal('')),
  phone: z.string().min(6, 'Teléfono requerido'),
  city: z.string().min(2, 'Ciudad requerida'),
  ciPrefix: z.enum(['V','E']).optional(),
  ciNumber: z.string().regex(/^\d+$/, { message: 'Solo números' }).min(5, 'Cédula inválida').optional().or(z.literal('')),
  instagram: z.string().optional().or(z.literal('')),
  method: z.string().min(1, 'Selecciona un método'),
  reference: z.string().optional().or(z.literal('')),
  amount_ves: z.string().optional(),
  evidence: z.any().optional(),
  termsAccepted: z.literal(true, { errorMap: () => ({ message: 'Debes aceptar los Términos y Condiciones' }) }),
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
    defaultValues: { ciPrefix: 'V' },
  });
  const [submitting, setSubmitting] = useState(false);

  // Control del selector de ciudad: si el usuario elige 'OTRA', mostramos campo libre
  const [citySelect, setCitySelect] = useState<string>('');

  // Tasas: entorno (para Bs) y BCV (para equivalente USD)
  const [bcvInfo, setBcvInfo] = useState<{ rate: number; source?: string } | null>(null);
  const fallbackRate = getEnvFallbackRate();
  useEffect(() => {
    (async () => {
      const info = await getBcvRatePreferApi();
      if (info && info.rate > 0) setBcvInfo({ rate: info.rate, source: info.source });
    })();
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    if (submitting) return;
    setSubmitting(true);
    // Marcar aceptación de TyC en storage (para futuras validaciones globales)
    try { localStorage.setItem('prizo_terms_accepted_v1', '1'); } catch {}
    let evidence_url: string | null = null;
    const ev = watch('evidence') as File | undefined;
    if (ev && typeof ev !== 'string') {
      evidence_url = await uploadEvidence(ev, `evidence/${raffleId}/${sessionId}`);
    }
    // Calcular montos y tasa usada
    const unitUSD = centsToUsd(unitPriceCents ?? 0);
    const count = quantity ?? 0;
    const totalUSD = round2(unitUSD * count);
  const rateUsed = fallbackRate ?? 0;
  const amountVES = rateUsed ? String(round0(totalUSD * rateUsed)) : null;
    // Asegurar que la sesión exista antes de crear el pago
    try { await ensureSession(sessionId); } catch {}
    const ciCombined = (values.ciNumber as string | undefined)?.trim()
      ? `${(values.ciPrefix as 'V'|'E'|undefined) ?? 'V'}-${(values.ciNumber as string).trim()}`
      : null;
    const paymentId = await createPaymentForSession({
      p_raffle_id: raffleId,
      p_session_id: sessionId,
      p_email: values.email || null,
      p_phone: (values.phone || '').replace(/\D/g, ''),
      p_city: values.city,
      p_ci: ciCombined,
      p_instagram: values.instagram || null,
      p_method: values.method,
      p_reference: values.reference || null,
      p_evidence_url: evidence_url,
      p_amount_ves: amountVES,
  p_rate_used: rateUsed ? String(rateUsed) : null,
  p_rate_source: fallbackRate ? 'env' : null,
      p_currency: currency,
    });
    onCreated?.(paymentId);
    reset();
    setSubmitting(false);
  });

  const evidence = watch('evidence');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const count = quantity ?? 0;
  const unitUSD = centsToUsd(unitPriceCents ?? 0);
  const unitVES = useMemo(() => (fallbackRate ? round0(unitUSD * fallbackRate) : 0), [unitUSD, fallbackRate]);
  const totalVES = useMemo(() => round2(unitVES * count), [unitVES, count]);

  return (
    <form onSubmit={onSubmit} className="space-y-4 border border-brand-500/30 rounded-xl p-4 bg-surface-700 text-white shadow-sm">
      <h2 className="text-lg font-semibold">Confirmar pago</h2>
      {count > 0 && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-2 rounded border border-brand-500/20 bg-surface-800">
            <div className="text-xs text-gray-600">Cantidad</div>
            <div className="font-semibold">{count}</div>
          </div>
          <div className="p-2 rounded border border-brand-500/20 bg-surface-800">
            <div className="text-xs text-gray-600">Total (Bs)</div>
            <div className="font-semibold">{fallbackRate ? totalVES.toFixed(2) : '—'} Bs</div>
          </div>
        </div>
      )}
      {fallbackRate && (
        <p className="text-xs text-gray-400">Tasa de referencia (entorno): {Number(fallbackRate).toFixed(2)} Bs/USD</p>
      )}
      {bcvInfo?.rate && (
        <p className="text-xs text-gray-500">Equivalente USD a BCV: {unitVES ? round1(unitVES / bcvInfo.rate).toFixed(1) : '—'} USD</p>
      )}
  {/* Mantener método como campo oculto (ya mostrado arriba) */}
  <input type="hidden" value={methodLabel ?? ''} {...register('method')} />

  <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Email (opcional)</label>
          <input type="email" className="mt-1 w-full border rounded-lg p-2 bg-surface-800" placeholder="tucorreo@mail.com" {...register('email')} />
          {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message as string}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium">Teléfono</label>
          <input type="tel" className="mt-1 w-full border rounded-lg p-2 bg-surface-800" placeholder="0412-0000000" {...register('phone')} />
          {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone.message as string}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium">Usuario de Instagram (opcional)</label>
          <input type="text" className="mt-1 w-full border rounded-lg p-2 bg-surface-800" placeholder="@tuusuario" {...register('instagram')} />
          {errors.instagram && <p className="text-xs text-red-600 mt-1">{errors.instagram.message as string}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium">Cédula (opcional)</label>
          <div className="mt-1 flex gap-2">
            <select className="w-20 border rounded-lg p-2 bg-surface-800" {...register('ciPrefix')}>
              <option value="V">V</option>
              <option value="E">E</option>
            </select>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="flex-1 border rounded-lg p-2 bg-surface-800"
              placeholder="12345678"
              {...register('ciNumber')}
              onChange={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, ''); }}
            />
          </div>
          {errors.ciNumber && <p className="text-xs text-red-600 mt-1">{errors.ciNumber.message as string}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium">Ciudad</label>
          <select
            className="mt-1 w-full border rounded-lg p-2 bg-surface-800"
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
              className="mt-2 w-full border rounded-lg p-2 bg-surface-800"
              placeholder="Escribe tu ciudad"
              {...register('city')}
            />
          )}
          {errors.city && <p className="text-xs text-red-600 mt-1">{errors.city.message as string}</p>}
        </div>
        {/* Campo visible de método removido por redundante */}
        <div>
          <label className="block text-sm font-medium">Referencia (opcional)</label>
          <input type="text" className="mt-1 w-full border rounded-lg p-2 bg-surface-800" placeholder="N° referencia o hash" {...register('reference')} />
        </div>
        {/* Monto en VES calculado automáticamente con la tasa; lo enviamos oculto */}
  <input type="hidden" value={fallbackRate ? String(totalVES) : ''} {...register('amount_ves')} />
        <div>
          <label className="block text-sm font-medium">Evidencia (imagen/pdf)</label>
          {/* Input real oculto */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setValue('evidence', f as any, { shouldValidate: false });
            }}
          />
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="px-3 py-2 rounded-lg border border-brand-500/40 text-brand-200 hover:bg-brand-500 hover:text-black transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >Seleccionar archivo</button>
            {evidence && typeof evidence !== 'string' ? (
              <>
                <span className="text-xs text-gray-300 truncate max-w-[12rem]">{(evidence as File).name}</span>
                <button
                  type="button"
                  className="text-xs text-red-300 hover:text-red-200 underline"
                  onClick={() => {
                    setValue('evidence', undefined as any, { shouldValidate: false });
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >Quitar</button>
              </>
            ) : (
              <span className="text-xs text-gray-400">Opcional (imagen o PDF)</span>
            )}
          </div>
        </div>
      </div>
      {/* Aceptación de Términos y Condiciones */}
      <div className="mt-2 flex items-center gap-2 text-sm">
        <input id="termsAccepted" type="checkbox" className="h-4 w-4" {...register('termsAccepted')} />
        <label htmlFor="termsAccepted" className="select-none">
          Acepto los <a href="/terms" className="underline">Términos y Condiciones</a>
        </label>
      </div>
      {errors.termsAccepted && <p className="text-xs text-red-500">{String(errors.termsAccepted.message ?? '')}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-neon disabled:opacity-60" disabled={disabled || submitting}>
          {submitting ? 'Enviando…' : 'Enviar pago'}
        </button>
      </div>
    </form>
  );
}
