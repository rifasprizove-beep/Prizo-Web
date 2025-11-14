-- Agrega la columna min_ticket_purchase a la tabla raffles
ALTER TABLE raffles ADD COLUMN min_ticket_purchase integer NOT NULL DEFAULT 1;

-- Opcional: comentario descriptivo
COMMENT ON COLUMN raffles.min_ticket_purchase IS 'Cantidad mínima de tickets que se pueden comprar en una sola orden.';