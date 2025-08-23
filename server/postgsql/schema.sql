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

