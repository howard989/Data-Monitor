CREATE INDEX IF NOT EXISTS idx_sa_bundle 
ON public.sandwich_attack(is_bundle) 
WHERE is_bundle IS NOT NULL;


CREATE INDEX IF NOT EXISTS idx_sa_front_to 
ON public.sandwich_attack(front_to) 
WHERE front_to IS NOT NULL;


CREATE INDEX IF NOT EXISTS idx_sa_profit 
ON public.sandwich_attack(profit_token, profit_wei) 
WHERE profit_token IS NOT NULL;


CREATE INDEX IF NOT EXISTS idx_bo_builder_block 
ON public.block_overview(builder_group, block_number) 
WHERE builder_kind = 'builder' AND builder_group IS NOT NULL;


CREATE INDEX IF NOT EXISTS idx_bo_block_time 
ON public.block_overview(block_time) 
WHERE block_time IS NOT NULL;


CREATE INDEX IF NOT EXISTS idx_sa_block_token 
ON public.sandwich_attack(block_number, profit_token, profit_wei);


ANALYZE public.sandwich_attack;
ANALYZE public.block_overview;


SELECT 
    s.schemaname,
    s.relname as tablename,
    s.indexrelname as indexname,
    s.idx_scan as index_scans,
    pg_size_pretty(pg_relation_size(s.indexrelid)) as index_size
FROM pg_stat_user_indexes s
WHERE s.schemaname = 'public' 
    AND s.relname IN ('sandwich_attack', 'block_overview')
ORDER BY s.idx_scan DESC;


SELECT 
    n.nspname as schemaname,
    t.relname as tablename,
    i.relname as indexname,
    pg_stat_get_numscans(i.oid) as index_scans,
    pg_size_pretty(pg_relation_size(i.oid)) as index_size
FROM pg_class t
JOIN pg_index idx ON t.oid = idx.indrelid
JOIN pg_class i ON i.oid = idx.indexrelid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname = 'public'
    AND t.relname IN ('sandwich_attack', 'block_overview')
ORDER BY pg_stat_get_numscans(i.oid) DESC;