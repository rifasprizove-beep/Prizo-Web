import { getSupabase } from '../supabaseClient';

export async function uploadEvidence(file: File, pathPrefix = 'evidence') {
  const supabase = getSupabase();
  const ext = file.name.split('.').pop() || 'bin';
  const filename = `${pathPrefix}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('evidence').upload(filename, file, {
    upsert: false,
    cacheControl: '3600',
  });
  if (error) throw error;
  const { data } = supabase.storage.from('evidence').getPublicUrl(filename);
  return data.publicUrl as string;
}
