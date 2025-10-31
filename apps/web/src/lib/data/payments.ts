import { getSupabase } from '../supabaseClient';

// Sube el archivo a Cloudinary (si el backend puede firmar) o cae en Supabase Storage como fallback.
export async function uploadEvidence(file: File, pathPrefix = 'evidence') {
  // 1) Siempre intentamos firmar con Cloudinary vía backend; si no está configurado, devuelve 500 y caemos a Supabase.
  try {
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    const res = await fetch(`${base}/api/cloudinary/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: pathPrefix }),
    });
    if (res.ok) {
      const { signature, timestamp, apiKey, cloudName: cn, folder, uploadPreset } = await res.json();
      const form = new FormData();
      form.append('file', file);
      form.append('api_key', apiKey);
      form.append('timestamp', String(timestamp));
      form.append('signature', signature);
      form.append('folder', folder);
      if (uploadPreset) form.append('upload_preset', uploadPreset);
      const uploadUrl = `https://api.cloudinary.com/v1_1/${cn}/auto/upload`;
      const up = await fetch(uploadUrl, { method: 'POST', body: form });
      const j = await up.json();
      if (!up.ok) throw new Error(j?.error?.message || `cloudinary upload failed: ${up.status}`);
      return (j.secure_url || j.url) as string;
    }
  } catch {
    // ignorar: caeremos al fallback
  }

  // 2) Fallback a Supabase Storage (requiere bucket 'evidence' creado previamente)
  const supabase = getSupabase();
  const ext = file.name.split('.').pop() || 'bin';
  const filename = `${pathPrefix}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('evidence').upload(filename, file, {
    upsert: false,
    cacheControl: '3600',
  });
  if (error) {
    // Mejor mensaje para el caso típico de bucket inexistente
    if ((error as any)?.statusCode === '404' || (error as any)?.message?.includes('Bucket not found')) {
      throw new Error('No existe el bucket de Supabase Storage "evidence". Configura Cloudinary o crea el bucket público "evidence" en Supabase.');
    }
    throw error;
  }
  const { data } = supabase.storage.from('evidence').getPublicUrl(filename);
  return data.publicUrl as string;
}
