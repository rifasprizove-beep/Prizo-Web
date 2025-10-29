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

  // Utilidades de parsing para valores numéricos que puedan venir como string
  const toNumber = (val: unknown): number | null => {
    if (typeof val === 'number' && isFinite(val) && val > 0) return val;
    if (typeof val === 'string') {
      // Normaliza: elimina espacios, cambia coma por punto, remueve separadores de miles
      const s = val.trim().replace(/\./g, '').replace(/,/g, '.');
      const num = parseFloat(s);
      if (!isNaN(num) && isFinite(num) && num > 0) return num;
    }
    return null;
  };

  for (const url of mirrors) {
    const r = await tryJson(url, (j) => {
      // Heurística de extracción: buscar un número en campos que incluyan 'bcv'/'official'
      const scan = (obj: any): number | null => {
        if (!obj || typeof obj !== 'object') return null;
        for (const [k, v] of Object.entries(obj)) {
          const key = String(k).toLowerCase();
          // Si la clave sugiere BCV/Official, intenta convertir a número
          if (key.includes('bcv') || key.includes('official') || key.includes('oficial')) {
            const n = toNumber(v);
            if (n) return n;
          }
          // Algunos mirrors anidan bajo { bcv: { price|promedio|value } }
          if (key === 'bcv' && typeof v === 'object') {
            const cand = (v as any)['price'] ?? (v as any)['promedio'] ?? (v as any)['value'] ?? (v as any)['venta'] ?? (v as any)['sell'];
            const n = toNumber(cand);
            if (n) return n;
          }
          if (typeof v === 'object') {
            const nested = scan(v);
            if (nested) return nested;
          }
        }
        return null;
      };
      return scan(j);
    });
    if (r) return NextResponse.json(r);
  }

  return NextResponse.json({ error: 'No rate source available' }, { status: 502 });
}
