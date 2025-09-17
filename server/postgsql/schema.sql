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




CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sandwich_attack_block_time 
ON public.sandwich_attack(block_time);


CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sandwich_attack_block_number 
ON public.sandwich_attack(block_number);


CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sandwich_attack_is_bundle 
ON public.sandwich_attack(is_bundle);


CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sandwich_attack_profit_token 
ON public.sandwich_attack(profit_token);


CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sandwich_attack_profit_wei 
ON public.sandwich_attack(profit_wei);


CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sandwich_attack_victim_to 
ON public.sandwich_attack(victim_to);


CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sandwich_attack_front_tx_hash 
ON public.sandwich_attack(front_tx_hash);


CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sandwich_attack_time_bundle 
ON public.sandwich_attack(block_time, is_bundle);


CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sandwich_attack_time_profit_token 
ON public.sandwich_attack(block_time, profit_token);


CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_block_overview_builder_group 
ON public.block_overview(builder_group) 
WHERE builder_kind = 'builder' AND builder_group IS NOT NULL;


CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_block_overview_time_builder 
ON public.block_overview(block_time, builder_kind);


CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_block_overview_block_builder 
ON public.block_overview(block_number, builder_kind, builder_group);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sandwich_backrun_attack_id 
ON public.sandwich_backrun(attack_id);


CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sandwich_backrun_tx_hash 
ON public.sandwich_backrun(tx_hash);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sandwich_attack_stats_query 
ON public.sandwich_attack(block_time, profit_token, is_bundle)
INCLUDE (profit_wei, block_number);


CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_block_overview_builder_stats 
ON public.block_overview(block_time, builder_group, builder_kind)
WHERE builder_kind = 'builder';


