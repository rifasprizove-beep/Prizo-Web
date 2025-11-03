"use client";
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { createPaymentForSession, ensureSession, verifyTicketsClient, setPaymentCi } from '@/lib/rpc';
import { VE_CITIES } from '@/lib/data/cities';

const usernameRegex = /^[A-Za-z0-9._]{1,30}$/; // formato de Instagram

const schema = z.object({
  // Email opcional; validaremos condicionalmente en superRefine para no bloquear si IG está presente
  email: z.string().optional().or(z.literal('')),
  phone: z.string().min(6, 'Teléfono requerido'),
  city: z.string().min(2, 'Ciudad requerida'),
  // Hacemos la cédula obligatoria para garantizar su persistencia en pagos
  ciPrefix: z.enum(['V','E'], { required_error: 'Prefijo requerido' }),
  ciNumber: z.string()
    .regex(/^\d+$/, { message: 'Solo números' })
    .min(5, 'Cédula inválida'),
  instagram: z.preprocess((v) => (typeof v === 'string' ? v.replace(/^@+/, '') : v),
    z.string().optional().or(z.literal(''))
  ).refine((v) => !v || usernameRegex.test(v), { message: 'Usuario inválido (solo letras, números, punto y _)' }),
  termsAccepted: z.literal(true, { errorMap: () => ({ message: 'Debes aceptar los Términos y Condiciones' }) }),
}).superRefine((v, ctx) => {
  const emailTrim = (v.email ?? '').trim();
  const hasEmail = emailTrim.length > 0;
  const hasIg = !!(v.instagram && v.instagram.trim());
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!hasEmail && !hasIg) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Ingresa tu correo o usuario de Instagram', path: ['email'] });
  }
  if (hasEmail && !emailRegex.test(emailTrim)) {
    // Solo marcamos error de email si NO hay IG; si hay IG, permitimos enviar
    if (!hasIg) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Email inválido', path: ['email'] });
    }
  }
});

export function FreeParticipationForm({
  raffleId,
  sessionId,
  quantity,
  disabled,
  onCreated,
}: {
  raffleId: string;
  sessionId: string;
  quantity: number;
  disabled?: boolean;
  onCreated?: (paymentId: string) => void;
}) {
  const { register, handleSubmit, formState: { errors, isValid }, setValue, watch, setError, clearErrors } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { ciPrefix: 'V' },
    mode: 'onChange',
  });
  // Aviso si la API no está configurada (ayuda a explicar por qué la CI podría no persistirse)
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const [citySelect, setCitySelect] = useState<string>('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ciDup, setCiDup] = useState<null | boolean>(null);
  const ciCheckTimer = useRef<any>(null);

  // Chequeo de cédula duplicada (solo si el usuario ingresó un número)
  const checkCiDuplicate = async () => {
    const prefix = (watch('ciPrefix') as 'V'|'E'|undefined) ?? 'V';
    const ciNum = (watch('ciNumber') as string | undefined) || '';
    const ciCombined = ciNum ? `${prefix}-${ciNum}` : '';
    if (!ciCombined) { setCiDup(null); clearErrors('ciNumber'); return; }
    const found = await verifyTicketsClient(ciCombined, true);
    const hasForRaffle = (found || []).some((r: any) => r?.raffle_id === raffleId);
    if (hasForRaffle) {
      setCiDup(true);
      setError('ciNumber', { type: 'manual', message: 'Esta cédula ya participó en este sorteo' });
    } else {
      setCiDup(false);
      clearErrors('ciNumber');
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    if (submitting) return;
    // eslint-disable-next-line no-console
    console.log('[prizo] submit free participation', { values });
    // Validación fuerte ANTES de enviar: si hay cédula, consultar y bloquear si existe
    const prefixSub = String(values.ciPrefix);
    const ciNumSub = String(values.ciNumber);
    const ciCombinedSub = `${prefixSub}-${ciNumSub}`;
    if (ciCombinedSub) {
      try {
        const foundNow = await verifyTicketsClient(ciCombinedSub, true);
        const hasForRaffleNow = (foundNow || []).some((r: any) => r?.raffle_id === raffleId);
        if (hasForRaffleNow) {
          setCiDup(true);
          setError('ciNumber', { type: 'manual', message: 'Esta cédula ya participó en este sorteo' });
          return;
        }
      } catch {}
    }
    setSubmitting(true);
    // Guardar aceptación para próximas vistas
    try { localStorage.setItem('prizo_terms_accepted_v1', '1'); } catch {}
    try {
      // Asegurar que la sesión exista en BD antes de crear el pago
      try { await ensureSession(sessionId); } catch {}
      // Normalizar teléfono a solo dígitos para evitar falsos duplicados
      const phoneOnly = (values.phone || '').replace(/\D/g, '');
      const prefix = String(values.ciPrefix);
      // Solo números en la cédula
      const ciNum = String(values.ciNumber).replace(/\D/g, '');
      const ciCombined = `${prefix}-${ciNum}`;
      // eslint-disable-next-line no-console
      console.log('[prizo] composed CI', ciCombined);
      const paymentId = await createPaymentForSession({
        p_raffle_id: raffleId,
        p_session_id: sessionId,
        p_email: values.email || null,
        p_phone: phoneOnly || null,
        p_city: values.city,
        p_ci: ciCombined, // formato V-343222211222
        p_method: 'free',
        p_reference: null,
        p_evidence_url: null,
        p_amount_ves: null,
        p_rate_used: null,
        p_rate_source: null,
        p_currency: 'FREE',
        p_instagram: (values.instagram?.replace(/^@+/, '') || null),
      });
      // Persistencia extra por API si aplica
      try {
        const ok = await setPaymentCi(paymentId, ciCombined);
        // eslint-disable-next-line no-console
        console.log('[prizo] setPaymentCi result', { paymentId, ok, apiBaseUrl });
        if (!ok) {
          // Exponer en consola para diagnosticar ambientes sin API
          // eslint-disable-next-line no-console
          console.warn('[prizo] setPaymentCi no se ejecutó (API no configurada o fallo)');
        }
      } catch {}
      onCreated?.(paymentId);
    } catch (e: any) {
      const raw = String(e?.message ?? e ?? '');
      let friendly = 'No se pudo registrar tu participación. Intenta nuevamente.';
      if (/payments_session_id_fkey|foreign key constraint/i.test(raw)) {
        friendly = 'Tu sesión expiró. Recarga la página e inténtalo de nuevo.';
      } else if (/ya particip[oó]|duplicate key|unique constraint|ux_payments_free_/i.test(raw)) {
        friendly = 'Ya participaste en este sorteo gratis';
      }
      setServerError(friendly);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4 border border-brand-500/30 rounded-xl p-4 bg-surface-700 text-white shadow-sm">
      <h2 className="text-lg font-semibold">Confirmar participación</h2>
      {serverError && (
        <div className="p-2 text-sm rounded border bg-red-50 text-red-700">{serverError}</div>
      )}
      {/* En rifas gratis no mostramos cantidad/total */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input type="email" className="mt-1 w-full border rounded-lg p-2 bg-surface-800" placeholder="tucorreo@mail.com" {...register('email')} />
          {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message as string}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium">Teléfono</label>
          <input type="tel" className="mt-1 w-full border rounded-lg p-2 bg-surface-800" placeholder="0412-0000000" {...register('phone')} required />
          {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone.message as string}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium">Usuario de Instagram</label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">@</span>
            <input
              type="text"
              className="w-full border rounded-lg p-2 pl-7 bg-surface-800"
              placeholder="tuusuario"
              {...register('instagram')}
              onChange={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/^@+/, ''); }}
            />
          </div>
          {errors.instagram && <p className="text-xs text-red-600 mt-1">{errors.instagram.message as string}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium">Cédula (obligatoria)</label>
          <div className="mt-1 flex gap-2">
            <select className="w-20 border rounded-lg p-2 bg-surface-800" {...register('ciPrefix')} required>
              <option value="V">V</option>
              <option value="E">E</option>
            </select>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="flex-1 border rounded-lg p-2 bg-surface-800"
              placeholder="12345678"
              required
              value={watch('ciNumber')}
              onInput={(e) => {
                // Elimina cualquier caracter no numérico, incluso al pegar
                const cleanValue = e.currentTarget.value.replace(/\D/g, '');
                setValue('ciNumber', cleanValue, { shouldValidate: true });
              }}
              onChange={(e) => {
                // debounce para verificación duplicada
                const cleanValue = e.currentTarget.value.replace(/\D/g, '');
                setValue('ciNumber', cleanValue, { shouldValidate: true });
                if (ciCheckTimer.current) clearTimeout(ciCheckTimer.current);
                ciCheckTimer.current = setTimeout(checkCiDuplicate, 400);
              }}
              onBlur={() => { if (ciCheckTimer.current) clearTimeout(ciCheckTimer.current); checkCiDuplicate(); }}
            />
          </div>
          {errors.ciNumber && <p className="text-xs text-red-600 mt-1">{errors.ciNumber.message as string}</p>}
          {ciDup === true && !errors.ciNumber && (
            <p className="text-xs text-red-500 mt-1">Esta cédula ya participó en este sorteo</p>
          )}
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
            <input type="text" className="mt-2 w-full border rounded-lg p-2 bg-surface-800" placeholder="Escribe tu ciudad" {...register('city')} />
          )}
          {errors.city && <p className="text-xs text-red-600 mt-1">{errors.city.message as string}</p>}
        </div>
      </div>
      {/* Aceptación de Términos y Condiciones */}
      <div className="mt-2 flex items-center justify-center gap-2 text-sm">
  <input id="termsAcceptedFree" type="checkbox" className="h-4 w-4" {...register('termsAccepted')} required />
        <label htmlFor="termsAcceptedFree" className="select-none">
          Acepto los <a href="/terms" className="underline">Términos y Condiciones</a>
        </label>
      </div>
      {errors.termsAccepted && <p className="text-center text-xs text-red-500">{String(errors.termsAccepted.message ?? '')}</p>}
      <div className="flex items-center justify-center gap-3">
        <button type="submit" className="btn-neon disabled:opacity-60" disabled={disabled || submitting || ciDup === true}>
          {submitting ? 'Enviando…' : 'Enviar participación'}
        </button>
      </div>
      {!apiBaseUrl && (
        <p className="mt-2 text-center text-xs text-yellow-300/90">
          Aviso: la API no está configurada (NEXT_PUBLIC_API_URL vacío). La cédula podría no persistirse.
        </p>
      )}
    </form>
  );
}
