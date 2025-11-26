export function TicketLegend() {
  const Item = ({ color, label }: { color: string; label: string }) => (
    <span className="inline-flex items-center gap-2 text-xs sm:text-sm">
      <span className={`w-3 h-3 sm:w-4 sm:h-4 rounded ${color}`} />
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-gray-600">
      <Item color="bg-white border" label="Disponible" />
      <Item color="bg-yellow-200" label="Reservado" />
      <Item color="bg-gray-300" label="Vendido" />
      <Item color="bg-black" label="Seleccionado" />
    </div>
  );
}
