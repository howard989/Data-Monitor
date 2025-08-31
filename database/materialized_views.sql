CREATE MATERIALIZED VIEW IF NOT EXISTS mv_builder_daily_stats AS
SELECT 
    bo.builder_group,
    DATE(bo.block_time) as stat_date,
    COUNT(DISTINCT bo.block_number) as total_blocks,
    COUNT(DISTINCT CASE WHEN sa.block_number IS NOT NULL THEN bo.block_number END) as sandwich_blocks,
    COUNT(DISTINCT sa.id) as sandwich_count,
    

    COUNT(DISTINCT CASE WHEN sa.is_bundle = true THEN sa.id END) as bundle_sandwiches,
    COUNT(DISTINCT CASE WHEN sa.is_bundle = false THEN sa.id END) as non_bundle_sandwiches,
    

    SUM(CASE WHEN sa.profit_token = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c' 
        THEN sa.profit_wei ELSE 0 END)::numeric as wbnb_profit_wei,
    SUM(CASE WHEN sa.profit_token IN (
        '0x55d398326f99059ff775485246999027b3197955', -- USDT
        '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', -- USDC
        '0xe9e7cea3dedca5984780bafc599bd69add087d56', -- BUSD
        '0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d'  -- USD1
    ) THEN sa.profit_wei::numeric / 1e18 ELSE 0 END) as stable_usd_profit,
    

    COUNT(DISTINCT CASE WHEN sa.front_to IN (
        '0x111111125421ca6dc452d289314280a0f8842a65',
        '0xd9c500dff816a1da21a48a732d3498bf09dc9aeb',
        '0xb300000b72deaeb607a12d5f54773d1c19c7028d'
    ) THEN sa.id END) as public_router_sandwiches,
    
   
    jsonb_build_object(
        'wbnb', SUM(CASE WHEN sa.profit_token = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c' 
            THEN sa.profit_wei ELSE 0 END)::numeric,
        'stable', SUM(CASE WHEN sa.profit_token IN (
            '0x55d398326f99059ff775485246999027b3197955',
            '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            '0xe9e7cea3dedca5984780bafc599bd69add087d56',
            '0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d'
        ) THEN sa.profit_wei ELSE 0 END)::numeric
    ) as profit_by_token
    
FROM public.block_overview bo
LEFT JOIN public.sandwich_attack sa ON bo.block_number = sa.block_number
WHERE bo.builder_kind = 'builder' 
    AND bo.builder_group IS NOT NULL
    AND bo.block_time >= CURRENT_DATE - INTERVAL '30 days'  
GROUP BY bo.builder_group, DATE(bo.block_time)
WITH DATA;


CREATE INDEX IF NOT EXISTS idx_mv_builder_date 
ON mv_builder_daily_stats(builder_group, stat_date DESC);


CREATE OR REPLACE FUNCTION refresh_builder_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_builder_daily_stats;
END;
$$ LANGUAGE plpgsql;


CREATE TABLE IF NOT EXISTS builder_stats_cache (
    builder_name TEXT,
    cache_date DATE,
    filter_hash TEXT,  
    stats JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (builder_name, cache_date, filter_hash)
);


CREATE INDEX IF NOT EXISTS idx_cache_lookup 
ON builder_stats_cache(cache_date, filter_hash);

CREATE OR REPLACE FUNCTION cleanup_old_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM builder_stats_cache 
    WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-