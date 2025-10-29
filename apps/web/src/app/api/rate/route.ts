import { NextResponse } from 'next/server';

// API de tasa USD->VES (BCV obligatorio).
// Estrategia: consulta mirrors de pydolarvenezuela y extrae la tasa del BCV.
// Devuelve { rate, source: 'BCV', date } o 502 si no hay ninguna fuente operativa.

async function tryJson(url: string, extractor: (j: any) => number | null) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const j = await res.json();
    const r = extractor(j);
    if (r && isFinite(r) && r > 0) {
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      return { rate: Number(r), source: 'BCV', date };
    }
  } catch {}
  return null;
}

export async function GET() {
  // Pydolarvenezuela (varias mirrors). Buscamos 'bcv' o 'official' en cualquier profundidad.
  const mirrors = [
    'https://pydolarvenezuela.github.io/api/v1/dollar',
    'https://pydolarvenezuela-api.vercel.app/api/v1/dollar',
    'https://pydolarvenezuela.vercel.app/api/v1/dollar',
    'https://pydolarvenezuela.obh.software/api/v1/dollar',
    'https://dolartoday-api.vercel.app/api/pydolar',
    'https://venezuela-exchange.vercel.app/api',
  ];

  for (const url of mirrors) {
    const r = await tryJson(
      url,
      (j) => {
        // Heurística de extracción: buscar un número en campos que incluyan 'bcv'/'official'
        const scan = (obj: any): number | null => {
          if (!obj || typeof obj !== 'object') return null;
          for (const [k, v] of Object.entries(obj)) {
            const key = String(k).toLowerCase();
            if (typeof v === 'number' && (key.includes('bcv') || key.includes('official') || key.includes('oficial'))) {
              return Number(v);
            }
            if (typeof v === 'object') {
              const nested = scan(v);
              if (nested) return nested;
            }
          }
          return null;
        };
        return scan(j);
      }
    );
    if (r) return NextResponse.json(r);
  }

  return NextResponse.json({ error: 'No rate source available' }, { status: 502 });
}
