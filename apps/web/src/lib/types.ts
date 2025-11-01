export type Raffle = {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'published' | 'selling' | 'closed' | 'drawn' | 'archived';
  currency: string;
  ticket_price_cents: number;
  prize_amount_cents?: number; // nuevo: monto del premio en centavos
  top_buyer_prize_cents?: number; // nuevo: premio para el Top Comprador en centavos
  image_url: string | null;
  total_tickets: number;
  allow_manual?: boolean; // si false, solo números aleatorios
};

export type RaffleTicketCounters = {
  raffle_id: string;
  total_tickets: number;
  sold: number;
  reserved: number;
  available: number;
};

export type Draw = {
  id: string;
  raffle_id: string;
  provider: string | null;
  external_draw_id: string | null;
  result_number: string | null;
  rule: string | null;
  draw_date: string | null; // YYYY-MM-DD
  official_link: string | null;
  started_at: string;
};

export type Winner = {
  id: string;
  raffle_id: string | null;
  draw_id: string | null;
  ticket_id: string | null;
  position: number;
  type: 'public_draw' | 'top_buyer' | 'manual';
  rule_applied: string | null;
  ticket_number_snapshot: number | null;
  winner_name: string | null;
  instagram_user: string | null;
  created_at: string;
};
