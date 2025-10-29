"use client";
import { useState } from 'react';

export default function VerifyPage() {
  const [ticket, setTicket] = useState('');
  const [ref, setRef] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const handleCheck = async () => {
    if (!ticket && !ref && !email) {
      setResult('Introduce número de ticket, referencia o email para verificar.');
      return;
    }
    setResult('Buscando...');
    await new Promise((r) => setTimeout(r, 700));
    setResult('No se encontró coincidencia. Si crees que es un error, contacta al organizador.');
  };

  return (
    <main className="mt-6 space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">Verificar ticket / pago</h1>

      <div className="grid sm:grid-cols-3 gap-3">
        <label className="block">
          <div className="text-sm text-gray-600">Nº Ticket</div>
          <input value={ticket} onChange={(e) => setTicket(e.target.value)} className="mt-1 w-full p-2 border rounded" placeholder="Opcional" />
        </label>
        <label className="block">
          <div className="text-sm text-gray-600">Referencia</div>
          <input value={ref} onChange={(e) => setRef(e.target.value)} className="mt-1 w-full p-2 border rounded" placeholder="Opcional" />
        </label>
        <label className="block">
          <div className="text-sm text-gray-600">Email</div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full p-2 border rounded" placeholder="Opcional" />
        </label>
      </div>

      <div className="flex gap-3">
        <button className="px-4 py-2 rounded bg-black text-white" onClick={handleCheck}>Consultar</button>
        <button className="px-4 py-2 rounded bg-gray-100" onClick={() => { setTicket(''); setRef(''); setEmail(''); setResult(null); }}>Limpiar</button>
      </div>

      {result && (
        <div className="p-4 border rounded bg-white text-gray-800">{result}</div>
      )}
    </main>
  );
}
