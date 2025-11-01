"use client";
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { createPaymentForSession } from '@/lib/rpc';
import { VE_CITIES } from '@/lib/data/cities';

const schema = z.object({
  email: z.string().email({ message: 'Email inválido' }).optional().or(z.literal('')),
  phone: z.string().min(6, 'Teléfono requerido'),
  city: z.string().min(2, 'Ciudad requerida'),
  ci: z.string().min(5, 'Cédula requerida').optional().or(z.literal('')),
  instagram: z.string().optional().or(z.literal('')),
}).refine((v) => {
  const hasEmail = !!(v.email && v.email.trim());
  const hasIg = !!(v.instagram && v.instagram.trim());
  return hasEmail || hasIg; // exigir al menos uno
}, { message: 'Ingresa tu correo o usuario de Instagram', path: ['email'] });

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
  const { register, handleSubmit, formState: { errors }, setValue } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });
  const [citySelect, setCitySelect] = useState<string>('');
  const [serverError, setServerError] = useState<string | null>(null);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const paymentId = await createPaymentForSession({
      p_raffle_id: raffleId,
      p_session_id: sessionId,
      p_email: values.email || null,
      p_phone: values.phone,
      p_city: values.city,
      p_ci: values.ci || null,
      p_method: 'free',
      p_reference: null,
      p_evidence_url: null,
      p_amount_ves: null,
      p_rate_used: null,
      p_rate_source: null,
      p_currency: 'FREE',
      p_instagram: values.instagram || null,
      });
      onCreated?.(paymentId);
    } catch (e: any) {
      const msg = e?.message || 'No se pudo registrar tu participación.';
      setServerError(msg);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4 border border-brand-500/30 rounded-xl p-4 bg-surface-700 text-white shadow-sm">
      <h2 className="text-lg font-semibold">Confirmar participación</h2>
      {serverError && (
        <div className="p-2 text-sm rounded border bg-red-50 text-red-700">{serverError}</div>
      )}
      {/* Resumen para rifas gratuitas */}
      <div className="text-sm grid sm:grid-cols-2 gap-3">
        <div className="p-3 rounded border border-brand-500/30 bg-surface-800">
          <div className="text-xs text-brand-200">Cantidad</div>
          <div className="text-lg font-semibold text-brand-100">{quantity}</div>
        </div>
        <div className="p-3 rounded border border-brand-500/30 bg-surface-800">
          <div className="text-xs text-brand-200">Total (Bs)</div>
          <div className="text-lg font-semibold text-brand-100">
            0.00
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-brand-500 text-black align-middle">Gratis</span>
          </div>
        </div>
      </div>
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
          <input type="text" className="mt-1 w-full border rounded-lg p-2 bg-surface-800" placeholder="V-12345678" {...register('ci')} />
          {errors.ci && <p className="text-xs text-red-600 mt-1">{errors.ci.message as string}</p>}
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
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-neon disabled:opacity-60" disabled={disabled}>Enviar participación</button>
      </div>
    </form>
  );
}
