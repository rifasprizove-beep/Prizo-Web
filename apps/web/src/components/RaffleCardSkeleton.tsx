export function RaffleCardSkeleton() {
  return (
    <div className="block rounded-3xl border border-white/10 bg-surface-700 text-white animate-pulse">
      <div className="p-4 pb-0 space-y-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="h-6 w-16 rounded-full bg-white/10" />
          <div className="h-6 w-20 rounded-full bg-white/10" />
        </div>
        <div className="h-6 w-3/4 bg-white/10 rounded" />
        <div className="h-10 w-full bg-white/5 rounded" />
      </div>
      <div className="w-full aspect-[16/11] bg-white/10 rounded-3xl -mb-2" />
      <div className="px-4 py-3">
        <div className="h-3 w-16 bg-white/10 rounded mb-2" />
        <div className="h-5 w-28 bg-white/10 rounded" />
      </div>
    </div>
  );
}
