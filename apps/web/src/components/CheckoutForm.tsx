"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { uploadEvidence } from '@/lib/data/payments';
import { createPaymentForSession, ensureSession } from '@/lib/rpc';
import { centsToUsd, getBcvRatePreferApi, getEnvFallbackRate, round0, round1, round2 } from '@/lib/data/rate';
import { VE_CITIES } from '@/lib/data/cities';
import type { RafflePaymentMethod } from '@/lib/data/paymentConfig';

// Patrones estrictos
const PHONE_REGEX = /^(?:\+?58)?0?(4\d{2})\d{7}$/; // móvil VE (11 dígitos núcleo)
const INSTAGRAM_REGEX = /^@?[A-Za-z0-9._]{2,30}$/;
const INSTAGRAM_INVALID_DOTS = /\.\.|\.$/;
const REF_REGEX = /^[A-Za-z0-9_-]{4,80}$/;
export const checkoutSchema = z.object({
  email: z.string().trim().email({ message: 'Email inválido' }).max(120, 'Email demasiado largo'),
  phone: z.string().trim()
    .transform(v => v.replace(/\D/g, ''))
    .refine(v => /^\d{10,11}$/.test(v), { message: 'Teléfono inválido (10-11 dígitos)' })
    .refine(v => PHONE_REGEX.test(v), { message: 'Teléfono venezolano inválido (ej: 04121234567)' }),
  city: z.string().trim().min(2, 'Ciudad requerida').max(40, 'Ciudad demasiado larga'),
  ciPrefix: z.enum(['V','E'], { required_error: 'Prefijo requerido' }),
  ciNumber: z.string().trim().regex(/^[0-9]{5,10}$/,{ message: 'Cédula inválida (5-10 dígitos)' }),
  instagram: z.string().trim()
    .transform(v => (v.startsWith('@') ? v : '@'+v))
    .refine(v => INSTAGRAM_REGEX.test(v), { message: 'Usuario Instagram inválido' })
    .refine(v => !INSTAGRAM_INVALID_DOTS.test(v), { message: 'Usuario Instagram con puntos inválidos' }),
  method: z.string().trim().min(1, 'Selecciona un método').max(40, 'Método demasiado largo'),
  // Referencia: usar trim nativo antes de validaciones para evitar encadenar .min sobre ZodEffects
  reference: z.string().trim()
    .min(4, 'Referencia mínima 4 caracteres')
    .max(80, 'Referencia máxima 80 caracteres')
    .regex(REF_REGEX, 'Referencia inválida (solo letras, números, _ - )'),
  amount_ves: z.string().optional(),
  evidence: z.any().optional(), // validación manual (se exige en onSubmit)
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
  paymentMethods,
}: {
  raffleId: string;
  sessionId: string;
  currency?: string;
  disabled?: boolean;
  onCreated?: (paymentId: string) => void;
  quantity?: number;
  unitPriceCents?: number;
  methodLabel?: string;
  paymentMethods?: RafflePaymentMethod[];
}) {
  const { register, handleSubmit, setValue, formState: { errors }, watch, reset, getValues } = useForm<z.infer<typeof checkoutSchema>>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { ciPrefix: 'V' },
  });
  const [submitting, setSubmitting] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const storageKey = `prizo_checkout_${raffleId}_${sessionId}`;
  const [methodLocal, setMethodLocal] = useState<string>(() => (paymentMethods && paymentMethods.length ? (paymentMethods[0].method_label ?? methodLabel ?? 'Pago') : (methodLabel ?? 'Pago')));
  const [copiedField, setCopiedField] = useState<string | null>(null);

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

  // Rehidratación del formulario desde localStorage para no perder datos al salir y volver
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<Record<string, any>>;
      const fields = ['email','phone','city','ciPrefix','ciNumber','instagram','method','reference','termsAccepted'] as const;
      fields.forEach((f) => {
        if (data[f] !== undefined) setValue(f as any, data[f] as any, { shouldValidate: false });
      });
      // Sincronizar selector de ciudad
      const savedCity = typeof data.city === 'string' ? data.city : '';
      if (savedCity) {
        if ((VE_CITIES as string[]).includes(savedCity)) {
          setCitySelect(savedCity);
        } else {
          setCitySelect('OTRA');
          setValue('city', savedCity, { shouldValidate: false });
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persistir cambios del formulario en localStorage
  useEffect(() => {
    const sub = watch((values) => {
      try {
        const payload = {
          email: (values as any).email ?? '',
          phone: (values as any).phone ?? '',
          city: (values as any).city ?? '',
          ciPrefix: (values as any).ciPrefix ?? 'V',
          ciNumber: (values as any).ciNumber ?? '',
          instagram: (values as any).instagram ?? '',
          method: (values as any).method ?? '',
          reference: (values as any).reference ?? '',
          termsAccepted: (values as any).termsAccepted ?? false,
        };
        if (typeof window !== 'undefined') localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch {}
    });
    return () => { try { sub.unsubscribe?.(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const onSubmit = handleSubmit(async (values) => {
    if (submitting) return;
    setSubmitting(true);
    // Marcar aceptación de TyC en storage (para futuras validaciones globales)
    try { localStorage.setItem('prizo_terms_accepted_v1', '1'); } catch {}
    let evidence_url: string | null = null;
    const ev = getValues('evidence') as File | undefined;
    if (!ev || typeof ev === 'string') {
      setEvidenceError('La evidencia de pago es obligatoria');
      setSubmitting(false); return;
    }
    {
      const allowed = ['image/jpeg','image/png','image/webp'];
      if (!allowed.includes(ev.type)) {
        setEvidenceError('Tipo de archivo no permitido (usa JPG, PNG o WEBP)');
        setSubmitting(false); return;
      }
      const MAX_SIZE = 5 * 1024 * 1024;
      if (ev.size > MAX_SIZE) {
        setEvidenceError('Archivo demasiado grande (máx 5MB)');
        setSubmitting(false); return;
      }
      setEvidenceError(null);
      evidence_url = await uploadEvidence(ev, `evidence/${raffleId}/${sessionId}`);
    }
    // Calcular montos y tasa usada
    const unitUSD = centsToUsd(unitPriceCents ?? 0);
    const count = quantity ?? 0;
    const totalUSD = round2(unitUSD * count);
    const rateUsed = fallbackRate ?? 0;
    const amountVESNum = rateUsed ? round0(totalUSD * rateUsed) : null;
    // Asegurar que la sesión exista antes de crear el pago
    try { await ensureSession(sessionId); } catch {}
    const ciCombined = (values.ciNumber as string | undefined)?.trim()
      ? `${(values.ciPrefix as 'V'|'E'|undefined) ?? 'V'}-${(values.ciNumber as string).trim()}`
      : null;
    const paymentId = await createPaymentForSession({
      p_raffle_id: raffleId,
      p_session_id: sessionId,
      p_email: values.email,
      p_phone: (values.phone || '').replace(/\D/g, ''),
      p_city: values.city,
      p_ci: ciCombined,
      p_instagram: values.instagram,
      p_method: values.method,
      p_reference: values.reference || null,
      p_evidence_url: evidence_url,
      p_amount_ves: amountVESNum,
      p_rate_used: rateUsed || null,
      p_rate_source: fallbackRate ? 'env' : null,
      p_currency: currency,
    });
    onCreated?.(paymentId);
    reset();
    setSubmitting(false);
    try { localStorage.removeItem(storageKey); } catch {}
  });

  const evidence = watch('evidence');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const count = quantity ?? 0;
  const unitUSD = centsToUsd(unitPriceCents ?? 0);
  const unitVES = useMemo(() => (fallbackRate ? round0(unitUSD * fallbackRate) : 0), [unitUSD, fallbackRate]);
  const totalVES = useMemo(() => round2(unitVES * count), [unitVES, count]);

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-screen-md mx-auto w-full border border-brand-500/30 rounded-xl p-4 sm:p-6 bg-surface-700 text-white shadow-sm">
      <h2 className="text-2xl md:text-3xl font-semibold text-center tracking-wide">Confirmar pago</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 flex flex-col items-center text-center">
          <label className="block text-base font-medium" htmlFor="method_select">Método de pago</label>
          <select
            id="method_select"
            className="mt-2 w-full max-w-xs border rounded-lg px-3 py-3 min-h-[48px] text-base bg-surface-800"
            value={methodLocal}
            onChange={(e) => { setMethodLocal(e.target.value); setValue('method', e.target.value, { shouldValidate: true }); }}
          >
            {(paymentMethods && paymentMethods.length ? paymentMethods : [{ method_label: methodLabel ?? 'Pago' }]).map((m, i) => (
              <option key={m.key ?? i} value={m.method_label ?? `Método ${i+1}`}>{m.method_label ?? `Método ${i+1}`}</option>
            ))}
          </select>
        </div>
      </div>
      {/* Resumen de pago se moverá arriba de los inputs */}
  {/* Guardar método seleccionado para el backend */}
  <input type="hidden" value={methodLocal ?? ''} {...register('method')} />

      {/* Detalles del método seleccionado (desde paymentMethods) */}
      {paymentMethods && paymentMethods.length > 0 && (
        (() => {
          const current = paymentMethods.find((m) => (m.method_label ?? '') === (methodLocal ?? '')) ?? paymentMethods[0];
          if (!current) return null;
          return (
            <div className="rounded-xl border border-brand-500/30 p-3 bg-surface-700 text-white">
              {/* Evitar redundancia: no repetir el nombre del método seleccionado aquí */}
              <div className="space-y-3 text-base">
                {current.bank && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="text-xs opacity-70">Banco</div>
                      <div className="font-semibold break-words">{current.bank}</div>
                    </div>
                    <button type="button" className="px-3 py-2 rounded-lg bg-transparent border border-brand-500/40 text-brand-200 text-xs font-semibold min-h-[40px] tap-safe" onClick={async () => { await navigator.clipboard.writeText(current.bank!); setCopiedField('bank'); setTimeout(() => setCopiedField(null), 1500); }}>{copiedField === 'bank' ? 'COPIADO' : 'COPIAR'}</button>
                  </div>
                )}
                {current.account && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="text-xs opacity-70">Cuenta</div>
                      <div className="font-semibold break-words">{current.account}</div>
                    </div>
                    <button type="button" className="px-3 py-2 rounded-lg bg-transparent border border-brand-500/40 text-brand-200 text-xs font-semibold min-h-[40px] tap-safe" onClick={async () => { await navigator.clipboard.writeText(current.account!); setCopiedField('account'); setTimeout(() => setCopiedField(null), 1500); }}>{copiedField === 'account' ? 'COPIADO' : 'COPIAR'}</button>
                  </div>
                )}
                {current.phone && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="text-xs opacity-70">Teléfono</div>
                      <div className="font-semibold break-words">{current.phone}</div>
                    </div>
                    <button type="button" className="px-3 py-2 rounded-lg bg-transparent border border-brand-500/40 text-brand-200 text-xs font-semibold min-h-[40px] tap-safe" onClick={async () => { await navigator.clipboard.writeText(current.phone!); setCopiedField('phone'); setTimeout(() => setCopiedField(null), 1500); }}>{copiedField === 'phone' ? 'COPIADO' : 'COPIAR'}</button>
                  </div>
                )}
                {current.id_number && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="text-xs opacity-70">Cédula/RIF</div>
                      <div className="font-semibold break-words">{current.id_number}</div>
                    </div>
                    <button type="button" className="px-3 py-2 rounded-lg bg-transparent border border-brand-500/40 text-brand-200 text-xs font-semibold min-h-[40px] tap-safe" onClick={async () => { await navigator.clipboard.writeText(current.id_number!); setCopiedField('id_number'); setTimeout(() => setCopiedField(null), 1500); }}>{copiedField === 'id_number' ? 'COPIADO' : 'COPIAR'}</button>
                  </div>
                )}
                {current.holder && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="text-xs opacity-70">Titular</div>
                      <div className="font-semibold break-words">{current.holder}</div>
                    </div>
                    <button type="button" className="px-3 py-2 rounded-lg bg-transparent border border-brand-500/40 text-brand-200 text-xs font-semibold min-h-[40px] tap-safe" onClick={async () => { await navigator.clipboard.writeText(current.holder!); setCopiedField('holder'); setTimeout(() => setCopiedField(null), 1500); }}>{copiedField === 'holder' ? 'COPIADO' : 'COPIAR'}</button>
                  </div>
                )}
                {current.type && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="text-xs opacity-70">Tipo</div>
                      <div className="font-semibold break-words">{current.type}</div>
                    </div>
                    <button type="button" className="px-3 py-2 rounded-lg bg-transparent border border-brand-500/40 text-brand-200 text-xs font-semibold min-h-[40px] tap-safe" onClick={async () => { await navigator.clipboard.writeText(current.type!); setCopiedField('type'); setTimeout(() => setCopiedField(null), 1500); }}>{copiedField === 'type' ? 'COPIADO' : 'COPIAR'}</button>
                  </div>
                )}
                {current.active === false && (
                  <div className="mt-2 text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded p-2">
                    Método configurado — <b>Esta rifa no está activa</b>
                  </div>
                )}
              </div>
              {/* Resumen eliminado aquí para evitar duplicado */}
            </div>
          );
        })()
      )}

      {/* Resumen de pago arriba de los inputs */}
      {count > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-base">
          <div className="p-2 rounded border border-brand-500/20 bg-surface-800">
            <div className="text-xs text-gray-600">Cantidad</div>
            <div className="font-semibold">{count}</div>
          </div>
          <div className="p-2 rounded border border-brand-500/20 bg-surface-800">
            <div className="text-xs text-gray-600">Total (Bs)</div>
            <div className="font-semibold">
              {fallbackRate
                ? `${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalVES)} Bs`
                : '—'}
            </div>
          </div>
        </div>
      )}
      {bcvInfo?.rate && (
        <p className="text-xs text-gray-400">Tasa BCV del día: {Number(bcvInfo.rate).toFixed(2)} Bs/USD</p>
      )}

  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-base font-medium" htmlFor="email_field">Email</label>
          <input
            type="email"
            autoComplete="email"
            id="email_field"
            className="mt-2 w-full border rounded-lg px-3 py-3 min-h-[48px] text-base bg-surface-800"
            placeholder="tucorreo@mail.com"
            required
            {...register('email')}
          />
          {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message as string}</p>}
        </div>
        <div>
          <label className="block text-base font-medium" htmlFor="phone_field">Teléfono</label>
          <input
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={11}
            id="phone_field"
            className="mt-2 w-full border rounded-lg px-3 py-3 min-h-[48px] text-base bg-surface-800"
            placeholder="04121234567"
            required
            {...register('phone')}
            onChange={(e) => {
              const digits = e.currentTarget.value.replace(/\D/g,'').slice(0,11);
              e.currentTarget.value = digits;
            }}
          />
          {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone.message as string}</p>}
        </div>
        <div>
          <label className="block text-base font-medium" htmlFor="instagram_field">Usuario de Instagram</label>
          <input type="text" id="instagram_field" className="mt-2 w-full border rounded-lg px-3 py-3 min-h-[48px] text-base bg-surface-800" placeholder="@tuusuario" required {...register('instagram')} />
          {errors.instagram && <p className="text-xs text-red-600 mt-1">{errors.instagram.message as string}</p>}
        </div>
        <div>
          <label className="block text-base font-medium">Cédula</label>
          <div className="mt-1 flex gap-2 w-full">
            <select className="w-20 sm:w-24 border rounded-lg px-3 py-3 min-h-[48px] text-base bg-surface-800" required {...register('ciPrefix')}>
              <option value="V">V</option>
              <option value="E">E</option>
            </select>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
              className="flex-1 min-w-0 border rounded-lg px-3 py-3 min-h-[48px] text-base bg-surface-800"
              placeholder="12345678"
              required
              {...register('ciNumber')}
              onChange={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '').slice(0,10); }}
            />
          </div>
          {errors.ciNumber && <p className="text-xs text-red-600 mt-1">{errors.ciNumber.message as string}</p>}
        </div>
        <div>
          <label className="block text-base font-medium" htmlFor="city_select">Ciudad</label>
          <select
            id="city_select"
            className="mt-2 w-full border rounded-lg px-3 py-3 min-h-[48px] text-base bg-surface-800"
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
              className="mt-2 w-full border rounded-lg px-3 py-3 min-h-[48px] text-base bg-surface-800"
              placeholder="Escribe tu ciudad"
              required
              {...register('city')}
            />
          )}
          {errors.city && <p className="text-xs text-red-600 mt-1">{errors.city.message as string}</p>}
        </div>
        {/* Campo visible de método removido por redundante */}
        <div>
          <label className="block text-base font-medium" htmlFor="reference_field">Referencia</label>
          <input type="text" id="reference_field" className="mt-2 w-full border rounded-lg px-3 py-3 min-h-[48px] text-base bg-surface-800" placeholder="N° referencia o hash" required {...register('reference')} />
          {errors.reference && <p className="text-xs text-red-600 mt-1">{errors.reference.message as string}</p>}
        </div>
        {/* Monto en VES calculado automáticamente con la tasa; lo enviamos oculto */}
  <input type="hidden" value={fallbackRate ? String(totalVES) : ''} {...register('amount_ves')} />
        <div className="sm:col-span-2 flex flex-col items-center">
          <label className="block text-base font-medium w-full text-center">Evidencia (JPG, PNG o WEBP máx 5MB) — Obligatoria</label>
          {/* Input real oculto */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setValue('evidence', f as any, { shouldValidate: false });
            }}
          />
          <div className="mt-4 flex flex-wrap justify-center items-center gap-4 w-full">
            <button
              type="button"
              className="px-5 py-3 rounded-lg border border-brand-500/40 text-brand-200 hover:bg-brand-500 hover:text-black transition-colors min-w-[180px] text-center tap-safe min-h-[48px]"
              onClick={() => fileInputRef.current?.click()}
            >Seleccionar archivo</button>
            {evidence && typeof evidence !== 'string' && (
              <>
                <span className="text-xs sm:text-sm text-gray-300 truncate max-w-[16rem] text-center">{(evidence as File).name}</span>
                <button
                  type="button"
                  className="text-xs text-red-300 hover:text-red-200 underline tap-safe min-h-[32px]"
                  onClick={() => {
                    setValue('evidence', undefined as any, { shouldValidate: false });
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    setEvidenceError(null);
                  }}
                >Quitar</button>
              </>
            )}
          </div>
          {evidenceError && <p className="mt-2 text-xs text-red-500 text-center">{evidenceError}</p>}
        </div>
      </div>
      {/* Aceptación de Términos y Condiciones */}
      <div className="mt-4 flex items-center justify-center gap-3 text-base">
        <input id="termsAccepted" type="checkbox" className="h-5 w-5" required {...register('termsAccepted')} />
        <label htmlFor="termsAccepted" className="select-none">
          Acepto los <a href="/terms" className="underline">Términos y Condiciones</a>
        </label>
      </div>
      {errors.termsAccepted && <p className="text-xs text-red-500">{String(errors.termsAccepted.message ?? '')}</p>}
      <div className="flex items-center justify-center gap-3">
        <button type="submit" className="btn-neon w-full sm:w-auto disabled:opacity-60 tap-safe min-h-[52px] text-base" disabled={disabled || submitting}>
          {submitting ? 'Enviando…' : 'Enviar pago'}
        </button>
      </div>
    </form>
  );
}
