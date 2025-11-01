import Image from 'next/image'

export default function RaffleLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-5">
        <div className="glow-breath rounded-md">
          <Image
            src="https://res.cloudinary.com/dzaokhfcw/image/upload/v1762024154/Prizo_l32y0t.png"
            alt="Prizo"
            width={140}
            height={42}
            className="h-9 w-auto"
            priority
            unoptimized
          />
        </div>
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full border-4 border-white/20"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-brand-500 border-r-brand-500 border-b-transparent border-l-transparent animate-spin"></div>
        </div>
        <div className="text-sm text-white/90">Cargando rifa…</div>
      </div>
    </div>
  );
}
