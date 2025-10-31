import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Firma de subida a Cloudinary.
// Envía POST con { folder?: string, publicId?: string } y opcionalmente usamos
// CLOUDINARY_UPLOAD_PRESET si está definido.
// Respuesta: { signature, timestamp, apiKey, cloudName, folder, publicId, uploadPreset? }

function signParams(params: Record<string, string | number | undefined>, apiSecret: string): string {
  // Ordenar alfabéticamente y construir cadena key=value&...
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)) as Array<[string, string | number]>;
  const toSign = entries.map(([k, v]) => `${k}=${v}`).join('&');
  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET; // opcional

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Cloudinary env vars missing' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const folder = String(body?.folder || 'evidence');
    const publicId = body?.publicId ? String(body.publicId) : undefined;
    const timestamp = Math.floor(Date.now() / 1000);

    const params: Record<string, string | number | undefined> = {
      folder,
      timestamp,
      upload_preset: uploadPreset,
      public_id: publicId,
    };

    const signature = signParams(params, apiSecret);

    return NextResponse.json({
      signature,
      timestamp,
      apiKey,
      cloudName,
      folder,
      publicId,
      uploadPreset: uploadPreset || undefined,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'sign error' }, { status: 500 });
  }
}
