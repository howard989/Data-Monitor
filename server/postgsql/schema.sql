CREATE TABLE IF NOT EXISTS public.block_overview (
  block_number BIGINT PRIMARY KEY,
  has_sandwich BOOLEAN NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.block_sandwiches (
  block_number BIGINT PRIMARY KEY,
  sandwiches   JSONB  NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_block_sandwiches_updated_at
  ON public.block_sandwiches (updated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_block_overview_recent
ON block_overview (block_number DESC)
INCLUDE (has_sandwich, updated_at);



ALTER TABLE public.internal_arb_tx
  ALTER COLUMN profit_receiver DROP NOT NULL,
  ALTER COLUMN profit_amount_wei DROP NOT NULL;


CREATE INDEX IF NOT EXISTS idx_iarb_refund_type
  ON public.internal_arb_tx (refund_type);
  
CREATE INDEX IF NOT EXISTS idx_iarb_router_refund_time
  ON public.internal_arb_tx (router_address, refund_type, block_time DESC);