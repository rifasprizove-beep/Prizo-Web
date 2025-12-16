"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { uploadEvidence } from '@/lib/data/payments';
import { createPaymentForSession, ensureSession } from '@/lib/rpc';
import { computeTicketPrice, getBcvRatePreferApi, getEnvFallbackRate, round0, round2 } from '@/lib/data/rate';
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
  onClickLiberar,
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
  onClickLiberar?: () => void;
}) {
  const { register, handleSubmit, setValue, formState: { errors }, watch, reset, getValues } = useForm<z.infer<typeof checkoutSchema>>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { ciPrefix: 'V' },
  });
  const [submitting, setSubmitting] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const storageKey = `prizo_checkout_${raffleId}_${sessionId}`;
  const getMethodId = (m: RafflePaymentMethod, i: number) => (m.key ?? m.method_label ?? String(i));
  const getMethodLabel = (m: RafflePaymentMethod, i: number) => (m.method_label ?? `Método ${i+1}`);
  const preferredId = useMemo(() => {
    if (paymentMethods && paymentMethods.length) {
      const visible = paymentMethods.filter((m) => m.active !== false);
      if (!visible.length) return '';
      const isPagoMovil = (m: RafflePaymentMethod) => {
        const key = (m.key || m.method_label || '').toLowerCase();
        return key.includes('pago') && (key.includes('movil') || key.includes('móvil'));
      };
      const pmIndex = visible.findIndex(isPagoMovil);
      const target = pmIndex >= 0 ? visible[pmIndex] : visible[0];
      return getMethodId(target, Math.max(0, pmIndex));
    }
    return '';
  }, [paymentMethods, methodLabel]);
  const [methodLocal, setMethodLocal] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    setMethodLocal(preferredId);
    if (paymentMethods && paymentMethods.length) {
      const idx = Math.max(0, paymentMethods.findIndex((m) => getMethodId(m, 0) === preferredId));
      const m = paymentMethods[idx >= 0 ? idx : 0];
      setValue('method', getMethodLabel(m, idx >= 0 ? idx : 0), { shouldValidate: true });
    } else if (typeof methodLabel === 'string') {
      setValue('method', methodLabel, { shouldValidate: true });
    }
  }, [preferredId, paymentMethods, methodLabel, setValue]);

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
      const fields = ['email','phone','city','ciPrefix','ciNumber','instagram','reference','termsAccepted'] as const; // no restaurar 'method' para forzar preferido
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
    // Calcular montos con el flujo: USD base -> Bs por fallback -> USD clave por BCV -> Bs mostrados por BCV
    const priceInfo = computeTicketPrice(unitPriceCents ?? 0, fallbackRate, bcvInfo?.rate ?? null);
    const count = quantity ?? 0;
    const totalUSD = round2(priceInfo.usdAtBcv * count);
    const totalVES = round0(priceInfo.bsAtBcv * count);
    const rateUsed = bcvInfo?.rate ?? fallbackRate ?? null;
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
      p_amount_ves: rateUsed ? totalVES : null,
      p_rate_used: rateUsed,
      p_rate_source: rateUsed ? (bcvInfo?.rate ? 'bcv' : 'env') : null,
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
  const priceInfo = useMemo(() => computeTicketPrice(unitPriceCents ?? 0, fallbackRate, bcvInfo?.rate ?? null), [unitPriceCents, fallbackRate, bcvInfo?.rate]);
  const unitUSD = priceInfo.usdAtBcv;
  const unitVES = priceInfo.bsAtBcv;
  const totalUSD = useMemo(() => round2(unitUSD * count), [unitUSD, count]);
  const totalVES = useMemo(() => round0(unitVES * count), [unitVES, count]);
  const isBinanceSelected = (methodLocal || '').toLowerCase().includes('binance');

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-screen-md mx-auto w-full border border-brand-500/30 rounded-xl p-4 sm:p-6 bg-surface-700 text-white shadow-sm">
      <h2 className="text-2xl md:text-3xl font-semibold text-center tracking-wide">Confirmar pago</h2>
      <div className="grid grid-cols-1 gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="block text-base font-semibold">Método de pago</label>
          </div>

          {paymentMethods && paymentMethods.length > 0 ? (
            <div className="w-full flex justify-center items-center">
              <div className="flex flex-wrap justify-center items-center gap-4 w-fit mx-auto">
              {useMemo(() => {
                 if (!paymentMethods) return [] as RafflePaymentMethod[];
                 const visible = paymentMethods.filter((m) => m.active !== false);
                 const isPagoMovil = (m: RafflePaymentMethod) => {
                  const key = (m.key || m.method_label || '').toLowerCase();
                  return key.includes('pago') && (key.includes('movil') || key.includes('móvil'));
                };
                 const pagos = visible.filter(isPagoMovil);
                 const otros = visible.filter((m) => !isPagoMovil(m));
                return [...pagos, ...otros];
              }, [paymentMethods]).map((m, i) => {
                const id = getMethodId(m, i);
                const label = getMethodLabel(m, i);
                const isActive = id === methodLocal;
                const keyLowerAll = (m.key || m.method_label || '').toLowerCase();
                const isPM = keyLowerAll.includes('pago') && (keyLowerAll.includes('movil') || keyLowerAll.includes('móvil'));
                const badge = (() => {
                  const base = (m.key || label || '').toLowerCase();
                  if (base.includes('zelle')) return { text: 'Zelle', bg: 'from-[#6D1ED4] to-[#6D1ED4]', fg: 'text-white' };
                  if (base.includes('binance') || base.includes('usdt')) return { text: 'Binance', bg: 'from-white to-white', fg: 'text-[#1F7A3D]' };
                  if (base.includes('bizum')) return { text: 'Bizum', bg: 'from-[#E8F5FF] to-[#CFE9FF]', fg: 'text-[#0D5C9C]' };
                  if (base.includes('pago') || base.includes('movil') || base.includes('móvil')) return { text: 'Pago Móvil', bg: 'from-white to-white', fg: 'text-[#A10063]' };
                  if (base.includes('transfer')) return { text: 'Transfer', bg: 'from-[#F8FAFF] to-[#E8EEFF]', fg: 'text-[#1D2A5C]' };
                  return { text: label, bg: 'from-[#F6F7FB] to-[#ECEEF5]', fg: 'text-brand-700' };
                })();
                const logo = (() => {
                  const base = (m.bank || '').toLowerCase();
                  const keyLower = (m.key || label || '').toLowerCase();
                  if (base.includes('banesco')) {
                    return <img src="https://res.cloudinary.com/dzaokhfcw/image/upload/v1765892651/BANESCO_z8zinq.avif" alt="Banesco" className="h-full w-full object-contain p-1" />;
                  }
                  if (keyLower.includes('zelle')) {
                    return <img src="https://res.cloudinary.com/dzaokhfcw/image/upload/c_crop,w_800,h_800/v1765894302/Zelle_logo.svg_t21wue.png" alt="Zelle" className="h-full w-full object-contain p-1" />;
                  }
                  if (keyLower.includes('binance') || keyLower.includes('usdt')) {
                    return <img src="https://res.cloudinary.com/dzaokhfcw/image/upload/v1765896772/binance_mftr7p.png" alt="Binance" className="h-full w-full object-contain p-1" />;
                  }
                  return <span className="z-10 text-sm font-bold">{badge.text.slice(0, 6)}</span>;
                })();
                return (
                  <button
                    key={m.key ?? i}
                    type="button"
                    onClick={() => { setMethodLocal(id); setValue('method', label, { shouldValidate: true }); setCopiedField(null); }}
                    aria-label={label}
                    aria-pressed={isActive}
                    className={`group relative flex flex-col items-center gap-2 rounded-xl px-3 py-3 text-center transition-all ${isActive ? 'bg-surface-700 text-white shadow-lg shadow-brand-900/30' : 'bg-surface-800/60 text-white/80 hover:bg-surface-700 hover:text-white'} ${isPM ? 'order-first' : 'order-last'}`}
                  >
                    <div className={`relative h-14 w-14 rounded-2xl bg-gradient-to-br ${badge.bg} flex items-center justify-center text-sm font-bold ${badge.fg} shadow-inner overflow-hidden transition-opacity ${isActive ? 'opacity-100' : 'opacity-60 group-hover:opacity-80'}`}>
                      {logo}
                    </div>
                    <div className="text-sm font-semibold leading-tight line-clamp-2 text-white">{label}</div>
                    {isActive && <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-brand-400" />}
                  </button>
                );
              })}
              </div>
            </div>
          ) : (
            <select
              className="w-full max-w-xs border rounded-lg px-3 py-3 min-h-[48px] text-base bg-surface-800"
              value={methodLocal}
              onChange={(e) => { setMethodLocal(e.target.value); setValue('method', e.target.value, { shouldValidate: true }); }}
            >
              <option value={methodLocal}>{methodLocal}</option>
            </select>
          )}
        </div>
      </div>
      {/* Guardar método seleccionado para el backend */}
      <input type="hidden" value={(watch('method') as any) ?? ''} {...register('method')} />

      {/* Detalles del método seleccionado (desde paymentMethods) */}
      {paymentMethods && paymentMethods.length > 0 && (
        (() => {
          const current = (() => {
            const list = paymentMethods.filter((m) => m.active !== false);
            const byId = list.find((m, i) => getMethodId(m, i) === methodLocal);
            if (byId) return byId;
            const byLabel = list.find((m) => (m.method_label ?? '') === ((watch('method') as any) ?? ''));
            return byLabel ?? list[0];
          })();
          if (!current) return null;
          return (
            <div className="rounded-2xl border border-brand-500/30 p-4 bg-surface-700 text-white shadow-sm">
              <div className="grid grid-cols-1 gap-4 text-base">
                {current.bank && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="text-xs opacity-70">Banco</div>
                      <div className="font-semibold break-words">{current.bank}</div>
                    </div>
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
                  <div className="mt-2 text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded p-2 sm:col-span-2">
                    Método configurado — <b>Esta rifa no está activa</b>
                  </div>
                )}
              </div>
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
            <div className="text-xs text-gray-600">Total (USD)</div>
            <div className="font-semibold">
              {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalUSD)} $
            </div>
          </div>
          <div className="p-2 rounded border border-brand-500/20 bg-surface-800">
            <div className="text-xs text-gray-600">Total (Bs)</div>
            <div className="font-semibold">
              {bcvInfo?.rate
                ? `${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalVES)} Bs`
                : 'Calculando tasa BCV…'}
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
  <input type="hidden" value={(bcvInfo?.rate || fallbackRate) ? String(totalVES) : ''} {...register('amount_ves')} />
        <div className="sm:col-span-2 flex flex-col items-center">
          <label className="block text-base font-medium w-full text-center">Enviar capture (JPG, PNG o WEBP máx 5MB) — Obligatoria</label>
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
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 w-full">
        <div />
        <button type="submit" className="btn-neon justify-self-center disabled:opacity-60 tap-safe min-h-[52px] text-base" disabled={disabled || submitting}>
          {submitting ? 'Enviando…' : 'Enviar pago'}
        </button>
        {onClickLiberar ? (
          <button type="button" className="justify-self-end text-base px-4 py-2 rounded-lg border-2 border-red-500 text-red-200 hover:bg-red-600 hover:text-white transition-colors shadow-sm tap-safe" onClick={onClickLiberar} disabled={disabled || submitting}>Liberar</button>
        ) : (
          <div />
        )}
      </div>
    </form>
  );
}
