const { pool, SCHEMA } = require('./db');

function ident(x) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(x)) {
    throw new Error(`Invalid identifier: ${x}`);
  }
  return `"${x}"`;
}

const schemaName = String(SCHEMA || 'public').toLowerCase();
const TBL_OVERVIEW = `${ident(schemaName)}.${ident('block_overview')}`;


let statsCache = null;
let statsCacheTime = 0;
let statsInFlight = null;
const STATS_CACHE_DURATION = 6000;

async function getBuilderList() {
  const sql = `
    SELECT DISTINCT builder_group AS builder_name
    FROM ${TBL_OVERVIEW}
    WHERE builder_kind = 'builder' 
      AND builder_group IS NOT NULL
    ORDER BY builder_name;
  `;
  const { rows } = await pool.query(sql);
  return rows.filter(r => r.builder_name).map(r => r.builder_name);
}

async function getSandwichStats(builderName = null, startDate = null, endDate = null) {

  let dateFilter = '';
  const params = [];
  let paramIndex = 1;

  if (startDate && endDate) {
    const endDateTime = endDate.includes('T') ? endDate : `${endDate}T23:59:59`;
    dateFilter = ` AND block_time >= $${paramIndex}::timestamp AND block_time <= $${paramIndex + 1}::timestamp`;
    params.push(startDate, endDateTime);
    paramIndex += 2;
  }

  if (builderName) {
    const sql = `
      WITH f AS (
        SELECT *
        FROM ${TBL_OVERVIEW}
        WHERE builder_kind = 'builder'
          AND builder_group = $${paramIndex}
          ${dateFilter}
      )
      SELECT
        COUNT(*)::bigint AS total_blocks,
        COUNT(*) FILTER (WHERE has_sandwich)::bigint AS sandwich_blocks,
        MIN(block_number) AS earliest_block,
        MAX(block_number) AS latest_block
      FROM f;
    `;
    params.push(builderName);
    const { rows } = await pool.query(sql, params);
    const r = rows[0] || {};
    const total = Number(r.total_blocks || 0);
    const sand = Number(r.sandwich_blocks || 0);
    return {
      scope: 'builder',
      builder_name: builderName,
      total_blocks: total,
      sandwich_blocks: sand,
      sandwich_percentage: total ? Number((100 * sand / total).toFixed(6)) : 0,
      earliest_block: Number(r.earliest_block || 0),
      latest_block: Number(r.latest_block || 0),
      date_range: startDate && endDate ? { start: startDate, end: endDate } : null,
    };
  }

  const baseSql = `
    SELECT
      COUNT(*)::bigint AS total_blocks,
      COUNT(*) FILTER (WHERE has_sandwich)::bigint AS sandwich_blocks,
      COUNT(*) FILTER (WHERE builder_address IS NOT NULL)::bigint AS builder_blocks,
      COUNT(*) FILTER (WHERE has_sandwich AND builder_address IS NOT NULL)::bigint AS sandwich_builder_blocks,
      MIN(block_number) AS earliest_block,
      MAX(block_number) AS latest_block
    FROM ${TBL_OVERVIEW}
    WHERE 1=1 ${dateFilter};
  `;

  const breakdownSql = `
    WITH builder_stats AS (
      SELECT
        bo.builder_group AS builder_name,
        bo.builder_kind,
        bo.block_number,
        bo.has_sandwich
      FROM ${TBL_OVERVIEW} bo
      WHERE bo.builder_kind = 'builder' 
        AND bo.builder_group IS NOT NULL ${dateFilter}
    ),
    token_profits AS (
      SELECT 
        bmp.builder_name,
        bmp.profit_token,
        bmp.token_symbol,
        bmp.total_profit_wei::text,
        bmp.sandwich_count
      FROM public.builder_main_token_profits bmp
    ),
    profit_summary AS (
      SELECT
        builder_name,
        -- Calculate total USD: WBNB will need frontend conversion, stables are 1:1
        SUM(CASE 
          WHEN profit_token IN ('0x55d398326f99059ff775485246999027b3197955', -- USDT
                                '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', -- USDC
                                '0xe9e7cea3dedca5984780bafc599bd69add087d56', -- BUSD
                                '0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d') -- USD1
          THEN total_profit_wei::numeric / 1e18
          ELSE 0
        END) AS stable_usd_total,
        SUM(CASE 
          WHEN profit_token = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c' -- WBNB
          THEN total_profit_wei::numeric
          ELSE 0
        END)::text AS wbnb_wei_total,
        jsonb_agg(
          jsonb_build_object(
            'token', token_symbol,
            'token_address', profit_token,
            'profit_wei', total_profit_wei,
            'count', sandwich_count
          )
        ) AS profit_breakdown
      FROM token_profits
      GROUP BY builder_name
    )
    SELECT
      bs.builder_name,
      MAX(bs.builder_kind) AS builder_kind,
      COUNT(*)::bigint AS blocks,
      COUNT(*) FILTER (WHERE bs.has_sandwich)::bigint AS sandwich_blocks,
      COALESCE(ps.wbnb_wei_total, '0') AS wbnb_wei_total,
      COALESCE(ps.stable_usd_total, 0) AS stable_usd_total,
      ps.profit_breakdown
    FROM builder_stats bs
    LEFT JOIN profit_summary ps ON ps.builder_name = bs.builder_name
    WHERE bs.builder_name IS NOT NULL
    GROUP BY bs.builder_name, ps.wbnb_wei_total, ps.stable_usd_total, ps.profit_breakdown
    ORDER BY (CASE WHEN COUNT(*) > 0 THEN 100.0 * COUNT(*) FILTER (WHERE bs.has_sandwich) / COUNT(*) ELSE 0 END) DESC, blocks DESC
    LIMIT 100;
  `;

  const [baseRes, brkRes] = await Promise.all([
    pool.query(baseSql, params),
    pool.query(breakdownSql, params)
  ]);
  const b = baseRes.rows[0] || {};
  const breakdown = (brkRes.rows || []).map(r => ({
    builder_name: r.builder_name,
    builder_kind: r.builder_kind,
    blocks: Number(r.blocks),
    sandwich_blocks: Number(r.sandwich_blocks),
    sandwich_percentage: r.blocks ? Number((100 * Number(r.sandwich_blocks) / Number(r.blocks)).toFixed(6)) : 0,
    wbnb_wei_total: r.wbnb_wei_total || "0",
    stable_usd_total: Number(r.stable_usd_total || 0),
    profit_breakdown: r.profit_breakdown || []
  }));

  const total_blocks = Number(b.total_blocks || 0);
  const sandwich_blocks = Number(b.sandwich_blocks || 0);
  const builder_blocks = Number(b.builder_blocks || 0);
  const sandwich_builder_blocks = Number(b.sandwich_builder_blocks || 0);

  return {
    total_blocks,
    sandwich_blocks,
    sandwich_percentage: total_blocks ? Number((100 * sandwich_blocks / total_blocks).toFixed(6)) : 0,
    earliest_block: Number(b.earliest_block || 0),
    latest_block: Number(b.latest_block || 0),

    builder_blocks,
    sandwich_builder_blocks,
    sandwich_percentage_on_builder: builder_blocks ? Number((100 * sandwich_builder_blocks / builder_blocks).toFixed(6)) : 0,
    breakdown_by_builder: breakdown,
    date_range: startDate && endDate ? { start: startDate, end: endDate } : null,
  };
}


async function getRecentBlocks(limit = 50) {
  const sql = `
    SELECT 
      block_number,
      has_sandwich,
      block_time,
      block_time_ms,
      updated_at,
      CASE
        WHEN builder_kind = 'builder' THEN builder_group
        WHEN builder_kind = 'bribe'   THEN builder_bribe_name
        ELSE NULL
      END AS builder_name,
      validator_name
    FROM ${TBL_OVERVIEW}
    ORDER BY block_number DESC
    LIMIT $1;
  `;
  const result = await pool.query(sql, [limit]);
  return result.rows;
}



async function findSandwichByTx(txHash) {
  const sql = `
  SELECT
    sa.id,
    sa.block_number,
    sa.block_time,
    sa.block_time_ms,
    sa.front_tx_hash,
    sa.victim_tx_hash,
    sa.profit_wei,
    sa.profit_token,
    sa.is_bundle,
    sa.bundle_size,
    sa.victim_to,    
    COALESCE(
      ARRAY_REMOVE(ARRAY_AGG(sb.tx_hash ORDER BY sb.sequence NULLS LAST), NULL),
      '{}'
    ) AS backrun_txes,
    CASE
      WHEN bo.builder_kind = 'builder' THEN bo.builder_group
      WHEN bo.builder_kind = 'bribe'   THEN bo.builder_bribe_name
      ELSE NULL
    END AS builder_name,
    bo.validator_name
  FROM public.sandwich_attack sa
  JOIN ${TBL_OVERVIEW} bo ON bo.block_number = sa.block_number
  LEFT JOIN public.sandwich_backrun sb ON sb.attack_id = sa.id
  WHERE sa.front_tx_hash = $1
     OR sa.victim_tx_hash = $1
     OR EXISTS (SELECT 1 FROM public.sandwich_backrun sb2 WHERE sb2.attack_id = sa.id AND sb2.tx_hash = $1)
  GROUP BY sa.id, bo.builder_kind, bo.builder_group, bo.builder_bribe_name, bo.validator_name
  ORDER BY sa.block_number DESC
  LIMIT 50;
`;
  const { rows } = await pool.query(sql, [String(txHash).toLowerCase()]);
  return rows;
}




async function getBlockMeta(blockNumber) {
  const sql = `
    SELECT
      block_number,
      has_sandwich,
      block_time,
      block_time_ms,
      CASE
        WHEN builder_kind = 'builder' THEN builder_group
        WHEN builder_kind = 'bribe'   THEN builder_bribe_name
        ELSE NULL
      END AS builder_name,
      validator_name
    FROM ${TBL_OVERVIEW}
    WHERE block_number = $1;
  `;
  const { rows } = await pool.query(sql, [String(blockNumber)]);
  return rows[0] || null;
}

async function getBlockSandwiches(blockNumber) {
  const listSql = `
  SELECT
    sa.id,
    sa.block_number,
    sa.block_time,
    sa.block_time_ms,
    sa.front_tx_hash,
    sa.victim_tx_hash,
    sa.profit_wei,
    sa.profit_token,
    sa.is_bundle,
    sa.bundle_size,
    sa.victim_to,
    COALESCE(
      ARRAY_REMOVE(ARRAY_AGG(sb.tx_hash ORDER BY sb.sequence NULLS LAST), NULL),
      '{}'
    ) AS backrun_txes,
    CASE
      WHEN bo.builder_kind = 'builder' THEN bo.builder_group
      WHEN bo.builder_kind = 'bribe'   THEN bo.builder_bribe_name
      ELSE NULL
    END AS builder_name,
    bo.validator_name
  FROM public.sandwich_attack sa
  JOIN ${TBL_OVERVIEW} bo ON bo.block_number = sa.block_number
  LEFT JOIN public.sandwich_backrun sb ON sb.attack_id = sa.id
  WHERE sa.block_number = $1
  GROUP BY sa.id, bo.builder_kind, bo.builder_group, bo.builder_bribe_name, bo.validator_name
  ORDER BY sa.id;
`;

  const [meta, listRes] = await Promise.all([
    getBlockMeta(blockNumber),
    pool.query(listSql, [String(blockNumber)]),
  ]);
  const data = listRes.rows || [];
  const is_clean = meta ? !meta.has_sandwich : true;
  return { data, meta, is_clean };
}


async function getBuilderSandwiches(builderName, page = 1, limit = 50, startDate = null, endDate = null) {
  const offset = (page - 1) * limit;

  // Maximum pages limit
  const MAX_PAGES = 100;
  if (page > MAX_PAGES) {
    return {
      success: false,
      error: `Exceeded maximum page limit (${MAX_PAGES}). Please use date filter to narrow down the results.`,
      maxPages: MAX_PAGES,
      data: [],
      total: 0,
      page,
      limit,
      totalPages: 0
    };
  }

  // Default to last 30 days if no date range provided
  if (!startDate && !endDate) {
    const now = new Date();
    endDate = now.toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    startDate = thirtyDaysAgo.toISOString().split('T')[0];
  }

  let dateFilter = '';
  const countParams = [builderName];
  const dataParams = [builderName];

  if (startDate && endDate) {
    const endDateTime = endDate.includes('T') ? endDate : `${endDate}T23:59:59`;
    dateFilter = ' AND sa.block_time >= $2::timestamp AND sa.block_time <= $3::timestamp';
    countParams.push(startDate, endDateTime);
    dataParams.push(startDate, endDateTime);
  }

  const countSql = `
    SELECT COUNT(DISTINCT sa.id) as total
    FROM public.sandwich_attack sa
    JOIN ${TBL_OVERVIEW} bo ON bo.block_number = sa.block_number
    WHERE bo.builder_kind = 'builder'
      AND bo.builder_group = $1
      ${dateFilter};
  `;


  const limitParam = startDate && endDate ? '$4' : '$2';
  const offsetParam = startDate && endDate ? '$5' : '$3';
  dataParams.push(limit, offset);

  const dataSql = `
  SELECT
    sa.id,
    sa.block_number,
    sa.block_time,
    sa.block_time_ms,
    sa.front_tx_hash,
    sa.victim_tx_hash,
    sa.profit_wei,
    sa.profit_token,
    sa.is_bundle,
    sa.bundle_size,
    sa.victim_to,
    COALESCE(
      ARRAY_REMOVE(ARRAY_AGG(sb.tx_hash ORDER BY sb.sequence NULLS LAST), NULL),
      '{}'
    ) AS backrun_txes,
    CASE
      WHEN bo.builder_kind = 'builder' THEN bo.builder_group
      WHEN bo.builder_kind = 'bribe' THEN bo.builder_bribe_name
    END AS builder_name,
    bo.validator_name
  FROM public.sandwich_attack sa
  JOIN ${TBL_OVERVIEW} bo ON bo.block_number = sa.block_number
  LEFT JOIN public.sandwich_backrun sb ON sb.attack_id = sa.id
  WHERE bo.builder_kind = 'builder'
    AND bo.builder_group = $1
    ${dateFilter}
  GROUP BY sa.id, bo.builder_kind, bo.builder_group, bo.builder_bribe_name, bo.validator_name
  ORDER BY sa.block_number DESC
  LIMIT ${limitParam} OFFSET ${offsetParam};
`;


  const [countRes, dataRes] = await Promise.all([
    pool.query(countSql, countParams),
    pool.query(dataSql, dataParams)
  ]);

  return {
    total: parseInt(countRes.rows[0]?.total || 0),
    page,
    limit,
    totalPages: Math.ceil((countRes.rows[0]?.total || 0) / limit),
    data: dataRes.rows,
    dateRange: { start: startDate, end: endDate },
    success: true
  };
}

async function getHourlyStats(hours = 24) {
  const sql = `
    SELECT
      date_trunc('hour', sa.created_at) AS hour,
      COUNT(*)::bigint AS attacks,
      COUNT(DISTINCT sa.block_number)::bigint AS blocks
    FROM public.sandwich_attack sa
    WHERE sa.created_at >= NOW() - ($1 || ' hours')::interval
    GROUP BY 1
    ORDER BY 1;
  `;
  const { rows } = await pool.query(sql, [hours]);
  return rows;
}

async function getChartData(interval = 'daily', startDate = null, endDate = null, builders = null) {
  // Default to last 30 days if no date range
  if (!startDate && !endDate) {
    const now = new Date();
    endDate = now.toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    startDate = thirtyDaysAgo.toISOString().split('T')[0];
  }
  
  const endDateTime = endDate.includes('T') ? endDate : `${endDate}T23:59:59`;
  
  // Determine date truncation based on interval
  const dateTrunc = interval === 'hourly' ? 'hour' : 
                    interval === 'weekly' ? 'week' : 
                    interval === 'monthly' ? 'month' : 'day';
  
  // If no builders specified, get top 5
  let builderList = builders;
  if (!builderList) {
    const topBuildersSql = `
      SELECT 
        builder_group AS builder_name,
        COUNT(*) as total_blocks
      FROM ${TBL_OVERVIEW}
      WHERE block_time >= $1::timestamp AND block_time <= $2::timestamp
        AND builder_kind = 'builder'
        AND builder_group IS NOT NULL
      GROUP BY 1
      ORDER BY total_blocks DESC
      LIMIT 5;
    `;
    const { rows } = await pool.query(topBuildersSql, [startDate, endDateTime]);
    builderList = rows.map(r => r.builder_name);
  }
  
  // Get time series data for each builder
  const sql = `
    WITH time_series AS (
      SELECT 
        date_trunc('${dateTrunc}', block_time) as time_bucket,
        builder_group AS builder_name,
        COUNT(*) as total_blocks,
        COUNT(*) FILTER (WHERE has_sandwich) as sandwich_blocks
      FROM ${TBL_OVERVIEW}
      WHERE block_time >= $1::timestamp AND block_time <= $2::timestamp
        AND builder_kind = 'builder'
        AND builder_group = ANY($3)
      GROUP BY 1, 2
    ),
    overall AS (
      SELECT 
        date_trunc('${dateTrunc}', block_time) as time_bucket,
        COUNT(*) as total_blocks,
        COUNT(*) FILTER (WHERE has_sandwich) as total_sandwich_blocks
      FROM ${TBL_OVERVIEW}
      WHERE block_time >= $1::timestamp AND block_time <= $2::timestamp
      GROUP BY 1
    )
    SELECT 
      to_char(ts.time_bucket AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as date,
      ts.builder_name,
      ts.total_blocks,
      ts.sandwich_blocks,
      CASE 
        WHEN ts.total_blocks > 0 
        THEN ROUND(100.0 * ts.sandwich_blocks / ts.total_blocks, 2)
        ELSE 0 
      END as sandwich_rate,
      o.total_blocks as overall_total_blocks,
      o.total_sandwich_blocks as overall_sandwich_blocks
    FROM time_series ts
    JOIN overall o ON o.time_bucket = ts.time_bucket
    ORDER BY ts.time_bucket, ts.builder_name;
  `;
  
  const { rows } = await pool.query(sql, [startDate, endDateTime, builderList]);
  
  // Transform data for chart format
  const chartData = {};
  const summary = {
    builders: builderList,
    totalBlocks: 0,
    totalSandwiches: 0,
    avgRate: 0
  };
  
  rows.forEach(row => {
    if (!chartData[row.date]) {
      chartData[row.date] = {
        date: row.date,
        overall_total: row.overall_total_blocks,
        overall_sandwiches: row.overall_sandwich_blocks,
        overall_rate: row.overall_total_blocks > 0 
          ? Number((100.0 * row.overall_sandwich_blocks / row.overall_total_blocks).toFixed(2))
          : 0
      };
    }
    chartData[row.date][row.builder_name] = Number(row.sandwich_rate);
    summary.totalBlocks += Number(row.total_blocks);
    summary.totalSandwiches += Number(row.sandwich_blocks);
  });
  
  const series = Object.values(chartData);
  summary.avgRate = summary.totalBlocks > 0 
    ? Number((100.0 * summary.totalSandwiches / summary.totalBlocks).toFixed(2))
    : 0;
  
  return {
    series,
    summary,
    interval,
    dateRange: { start: startDate, end: endDate }
  };
}

async function searchSandwiches({ victim_to = null, is_bundle = null, profit_token = null, builder = null, startDate = null, endDate = null, page = 1, limit = 50 }) {
  // Maximum 100 pages 
  const MAX_PAGES = 100;
  if (page > MAX_PAGES) {
    return {
      success: false,
      error: `Exceeded maximum page limit (${MAX_PAGES}). Please use date filters to narrow down the results.`,
      maxPages: MAX_PAGES,
      data: [],
      page,
      limit
    };
  }
  
  const offset = (page - 1) * limit;

  const params = [];
  let where = '1=1';

  if (victim_to) {
    params.push(String(victim_to).toLowerCase());
    where += ` AND sa.victim_to = $${params.length}`;
  }
  if (is_bundle === true || is_bundle === false) {
    params.push(!!is_bundle);
    where += ` AND sa.is_bundle = $${params.length}`;
  }
  if (profit_token) {
    params.push(String(profit_token).toLowerCase());
    where += ` AND sa.profit_token = $${params.length}`;
  }
  if (startDate && endDate) {
    const endDT = endDate.includes('T') ? endDate : `${endDate}T23:59:59`;
    params.push(startDate, endDT);
    where += ` AND sa.block_time BETWEEN $${params.length-1}::timestamp AND $${params.length}::timestamp`;
  }
  if (builder) {
    params.push(builder, builder);
    where += ` AND bo.builder_address IS NOT NULL
               AND ((bo.builder_kind='builder' AND bo.builder_group=$${params.length-1})
                 OR (bo.builder_kind='bribe'   AND bo.builder_bribe_name=$${params.length}))`;
  }

  params.push(limit, offset);

  const sql = `
    SELECT
      sa.id,
      sa.block_number,
      sa.block_time,
      sa.block_time_ms,
      sa.front_tx_hash,
      sa.victim_tx_hash,
      sa.profit_wei,
      sa.profit_token,
      sa.is_bundle,
      sa.bundle_size,
      sa.victim_to,
      COALESCE(
        ARRAY_REMOVE(ARRAY_AGG(sb.tx_hash ORDER BY sb.sequence NULLS LAST), NULL),
        '{}'
      ) AS backrun_txes,
      CASE
        WHEN bo.builder_kind = 'builder' THEN bo.builder_group
        WHEN bo.builder_kind = 'bribe'   THEN bo.builder_bribe_name
        ELSE NULL
      END AS builder_name,
      bo.validator_name
    FROM public.sandwich_attack sa
    JOIN ${TBL_OVERVIEW} bo ON bo.block_number = sa.block_number
    LEFT JOIN public.sandwich_backrun sb ON sb.attack_id = sa.id
    WHERE ${where}
    GROUP BY sa.id, bo.builder_kind, bo.builder_group, bo.builder_bribe_name, bo.validator_name
    ORDER BY sa.block_number DESC
    LIMIT $${params.length-1} OFFSET $${params.length};
  `;

  // count query for total results
  const countParams = params.slice(0, -2); // Exclude limit and offset
  const countSql = `
    SELECT COUNT(DISTINCT sa.id) as total
    FROM public.sandwich_attack sa
    JOIN ${TBL_OVERVIEW} bo ON bo.block_number = sa.block_number
    WHERE ${where};
  `;
  
  const [countRes, dataRes] = await Promise.all([
    pool.query(countSql, countParams),
    pool.query(sql, params)
  ]);
  
  const total = parseInt(countRes.rows[0]?.total || 0);
  const totalPages = Math.ceil(total / limit);
  
  return { 
    success: true, 
    data: dataRes.rows, 
    page, 
    limit,
    total,
    totalPages
  };
}

module.exports = {
  getSandwichStats,
  getRecentBlocks,
  findSandwichByTx,
  getBlockSandwiches,
  getHourlyStats,
  getBlockMeta,
  getBuilderList,
  getBuilderSandwiches,
  searchSandwiches,
  getChartData
};