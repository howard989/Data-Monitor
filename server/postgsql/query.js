const { pool, SCHEMA } = require('./db');
const { statsCache, chartCache } = require('../utils/queryCache');

function ident(x) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(x)) {
    throw new Error(`Invalid identifier: ${x}`);
  }
  return `"${x}"`;
}

const schemaName = String(SCHEMA || 'public').toLowerCase();
const TBL_OVERVIEW = `${ident(schemaName)}.${ident('block_overview')}`;

const stableTokens = [
  '0x55d398326f99059ff775485246999027b3197955', // USDT
  '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // USDC
  '0xe9e7cea3dedca5984780bafc599bd69add087d56', // BUSD
  '0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d'  // USD1
];

const publicRouters = [
  '0x111111125421ca6dc452d289314280a0f8842a65',
  '0xd9c500dff816a1da21a48a732d3498bf09dc9aeb',
  '0xb300000b72deaeb607a12d5f54773d1c19c7028d'
];

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

async function getEarliestBlock() {
  const sql = `
    SELECT MIN(block_number) as earliest_block, 
           MIN(block_time) as earliest_time
    FROM ${TBL_OVERVIEW}
    WHERE block_number IS NOT NULL;
  `;
  const { rows } = await pool.query(sql);
  return rows[0] || { earliest_block: null, earliest_time: null };
}

function buildFilters(amountRange, bundleFilter, frontrunRouter, params, p) {
  const stableList = stableTokens.map(t => `'${t.toLowerCase()}'`).join(',');
  const routerListSql = publicRouters.map(r => `'${r.toLowerCase()}'`).join(',');

  const hasAmount = !!amountRange && (
    (amountRange.min ?? '') !== '' || (amountRange.max ?? '') !== ''
  );

  const conds = [];

  if (bundleFilter === 'bundle-only') conds.push('sa.is_bundle = true');
  if (bundleFilter === 'non-bundle-only') conds.push('sa.is_bundle = false');

  if (frontrunRouter === 'public') conds.push(`LOWER(sa.front_to) IN (${routerListSql})`);
  if (frontrunRouter === 'customized') conds.push(`LOWER(sa.front_to) NOT IN (${routerListSql})`);

  if (hasAmount) {
    const rangeConds = [];
    if ((amountRange.min ?? '') !== '') { params.push(amountRange.min); rangeConds.push(`sa.profit_wei::numeric/1e18 >= $${p++}`); }
    if ((amountRange.max ?? '') !== '') { params.push(amountRange.max); rangeConds.push(`sa.profit_wei::numeric/1e18 <= $${p++}`); }
    conds.push(`sa.profit_token IN (${stableList}) AND ${rangeConds.join(' AND ')}`);
  }

  const whereSql = conds.length ? ` AND ${conds.join(' AND ')}` : '';
  return { whereSql, params, p, hasAmount };
}

async function runBaseAndBreakdownNoFilter(params, dateFilterAB) {
  const baseSql = `
    SELECT
      COUNT(*)::bigint AS total_blocks,
      COUNT(*) FILTER (WHERE has_sandwich)::bigint AS sandwich_blocks,
      COUNT(*) FILTER (WHERE builder_address IS NOT NULL)::bigint AS builder_blocks,
      COUNT(*) FILTER (WHERE builder_address IS NOT NULL AND has_sandwich)::bigint AS sandwich_builder_blocks,
      MIN(block_number) AS earliest_block,
      MAX(block_number) AS latest_block
    FROM ${TBL_OVERVIEW}
    WHERE 1=1 ${dateFilterAB}
  `;

  const breakdownSql = `
    SELECT
      builder_group AS builder_name,
      MAX(builder_kind) AS builder_kind,
      COUNT(*)::bigint AS blocks,
      COUNT(*) FILTER (WHERE has_sandwich)::bigint AS sandwich_blocks
    FROM ${TBL_OVERVIEW}
    WHERE builder_kind = 'builder' 
      AND builder_group IS NOT NULL ${dateFilterAB}
    GROUP BY builder_group
    ORDER BY (CASE WHEN COUNT(*) > 0 
              THEN 100.0 * COUNT(*) FILTER (WHERE has_sandwich) / COUNT(*) 
              ELSE 0 END) DESC, COUNT(*) DESC
    LIMIT 100
  `;

  const stableList = stableTokens.map(t => `'${t.toLowerCase()}'`).join(',');
  const profitSql = `
    WITH token_profits AS (
      SELECT 
        bo.builder_group AS builder_name,
        sa.profit_token,
        SUM(sa.profit_wei)::numeric AS total_profit_wei,
        COUNT(*)::int AS sandwich_count
      FROM public.sandwich_attack sa
      JOIN ${TBL_OVERVIEW} bo ON bo.block_number = sa.block_number
      WHERE bo.block_time >= $1::timestamp AND bo.block_time <= $2::timestamp
        AND bo.builder_kind = 'builder' 
        AND bo.builder_group IS NOT NULL
      GROUP BY bo.builder_group, sa.profit_token
    )
    SELECT
      builder_name,
      SUM(CASE 
        WHEN profit_token IN (${stableList}) THEN total_profit_wei/1e18 ELSE 0
      END) AS stable_usd_total,
      SUM(CASE 
        WHEN profit_token = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c' THEN total_profit_wei 
        ELSE 0
      END)::text AS wbnb_wei_total,
      jsonb_agg(
        jsonb_build_object(
          'token_address', profit_token,
          'profit_wei', total_profit_wei::text,
          'count', sandwich_count
        )
      ) AS profit_breakdown
    FROM token_profits
    GROUP BY builder_name;
  `;

  const [baseRes, brkRes, pfRes] = await Promise.all([
    pool.query(baseSql, params),
    pool.query(breakdownSql, params),
    pool.query(profitSql, params),
  ]);

  const b = baseRes.rows[0] || {};
  const total_blocks = Number(b.total_blocks || 0);
  const sandwich_blocks = Number(b.sandwich_blocks || 0);
  const builder_blocks = Number(b.builder_blocks || 0);
  const sandwich_builder_blocks = Number(b.sandwich_builder_blocks || 0);

  const profitByBuilder = new Map(
    (pfRes.rows || []).map(r => [r.builder_name, {
      stable_usd_total: Number(r.stable_usd_total || 0),
      wbnb_wei_total: String(r.wbnb_wei_total || '0'),
      profit_breakdown: r.profit_breakdown || []
    }])
  );

  const breakdown = (brkRes.rows || []).map(r => {
    const extra = profitByBuilder.get(r.builder_name) || { stable_usd_total: 0, wbnb_wei_total: '0', profit_breakdown: [] };
    return {
      builder_name: r.builder_name,
      builder_kind: r.builder_kind,
      blocks: Number(r.blocks),
      sandwich_blocks: Number(r.sandwich_blocks),
      sandwich_percentage: r.blocks ? Number((100 * Number(r.sandwich_blocks) / Number(r.blocks)).toFixed(6)) : 0,
      mined_rate: total_blocks ? Number((100 * Number(r.blocks) / total_blocks).toFixed(4)) : 0,
      ...extra
    };
  });

  return {
    total_blocks,
    sandwich_blocks,
    earliest_block: Number(b.earliest_block || 0),
    latest_block: Number(b.latest_block || 0),
    builder_blocks,
    sandwich_builder_blocks,
    breakdown_by_builder: breakdown
  };
}

async function runBaseAndBreakdownWithFilter(params, dateFilterAB, dateFilterBO, whereSql) {
  const stableList = stableTokens.map(t => `'${t.toLowerCase()}'`).join(',');

  const baseSql = `
    WITH all_blocks AS (
      SELECT block_number, builder_address
      FROM ${TBL_OVERVIEW}
      WHERE 1=1 ${dateFilterAB}
    ),
    filtered_sandwiches AS (
      SELECT DISTINCT sa.block_number
      FROM public.sandwich_attack sa
      JOIN all_blocks ab ON sa.block_number = ab.block_number
      WHERE 1=1 ${whereSql}
    )
    SELECT
      COUNT(*)::bigint AS total_blocks,
      SUM(CASE WHEN fs.block_number IS NOT NULL THEN 1 ELSE 0 END)::bigint AS sandwich_blocks,
      SUM(CASE WHEN ab.builder_address IS NOT NULL THEN 1 ELSE 0 END)::bigint AS builder_blocks,
      SUM(CASE WHEN ab.builder_address IS NOT NULL AND fs.block_number IS NOT NULL THEN 1 ELSE 0 END)::bigint AS sandwich_builder_blocks,
      MIN(ab.block_number) AS earliest_block,
      MAX(ab.block_number) AS latest_block
    FROM all_blocks ab
    LEFT JOIN filtered_sandwiches fs ON fs.block_number = ab.block_number;
  `;

  const breakdownSql = `
    WITH builder_stats AS (
      SELECT
        bo.builder_group AS builder_name,
        bo.builder_kind,
        bo.block_number
      FROM ${TBL_OVERVIEW} bo
      WHERE bo.builder_kind = 'builder'
        AND bo.builder_group IS NOT NULL
        ${dateFilterBO}
    ),
    filtered_sandwiches AS (
      SELECT DISTINCT 
        bo.builder_group AS builder_name,
        sa.block_number
      FROM public.sandwich_attack sa
      JOIN ${TBL_OVERVIEW} bo ON sa.block_number = bo.block_number
      WHERE bo.builder_kind = 'builder'
        AND bo.builder_group IS NOT NULL
        ${dateFilterBO}
        ${whereSql}
    ),
    token_profits AS (
      SELECT 
        bo.builder_group AS builder_name,
        sa.profit_token,
        SUM(sa.profit_wei)::numeric AS total_profit_wei,
        COUNT(*)::int AS sandwich_count
      FROM public.sandwich_attack sa
      JOIN ${TBL_OVERVIEW} bo ON sa.block_number = bo.block_number
      WHERE bo.builder_kind = 'builder'
        AND bo.builder_group IS NOT NULL
        ${dateFilterBO}
        ${whereSql}
      GROUP BY bo.builder_group, sa.profit_token
    ),
    profit_summary AS (
      SELECT
        builder_name,
        SUM(CASE 
          WHEN profit_token IN (${stableList}) THEN total_profit_wei/1e18 ELSE 0
        END) AS stable_usd_total,
        SUM(CASE 
          WHEN profit_token = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c' THEN total_profit_wei 
          ELSE 0
        END)::text AS wbnb_wei_total,
        jsonb_agg(
          jsonb_build_object(
            'token_address', profit_token,
            'profit_wei', total_profit_wei::text,
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
      SUM(CASE WHEN fs.block_number IS NOT NULL THEN 1 ELSE 0 END)::bigint AS sandwich_blocks,
      COALESCE(ps.wbnb_wei_total, '0') AS wbnb_wei_total,
      COALESCE(ps.stable_usd_total, 0) AS stable_usd_total,
      ps.profit_breakdown
    FROM builder_stats bs
    LEFT JOIN filtered_sandwiches fs 
      ON bs.builder_name = fs.builder_name AND bs.block_number = fs.block_number
    LEFT JOIN profit_summary ps ON ps.builder_name = bs.builder_name
    GROUP BY bs.builder_name, ps.wbnb_wei_total, ps.stable_usd_total, ps.profit_breakdown
    ORDER BY (CASE WHEN COUNT(*) > 0 
              THEN 100.0 * SUM(CASE WHEN fs.block_number IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*) 
              ELSE 0 END) DESC, COUNT(*) DESC
    LIMIT 100;
  `;

  const [baseRes, brkRes] = await Promise.all([
    pool.query(baseSql, params),
    pool.query(breakdownSql, params)
  ]);

  const b = baseRes.rows[0] || {};
  const total_blocks_raw = Number(b.total_blocks || 0);

  const breakdown = (brkRes.rows || []).map(r => ({
    builder_name: r.builder_name,
    builder_kind: r.builder_kind,
    blocks: Number(r.blocks),
    sandwich_blocks: Number(r.sandwich_blocks),
    sandwich_percentage: r.blocks ? Number((100 * Number(r.sandwich_blocks) / Number(r.blocks)).toFixed(6)) : 0,
    mined_rate: total_blocks_raw ? Number((100 * Number(r.blocks) / total_blocks_raw).toFixed(4)) : 0,
    wbnb_wei_total: r.wbnb_wei_total || '0',
    stable_usd_total: Number(r.stable_usd_total || 0),
    profit_breakdown: r.profit_breakdown || []
  }));

  return {
    total_blocks: Number(b.total_blocks || 0),
    sandwich_blocks: Number(b.sandwich_blocks || 0),
    earliest_block: Number(b.earliest_block || 0),
    latest_block: Number(b.latest_block || 0),
    builder_blocks: Number(b.builder_blocks || 0),
    sandwich_builder_blocks: Number(b.sandwich_builder_blocks || 0),
    breakdown_by_builder: breakdown
  };
}


async function getSandwichStats(
  builderName = null,
  startDate = null,
  endDate = null,
  bundleFilter = 'all',
  amountRange = null,
  frontrunRouter = 'all'
) {

  const usingDefaultWindow = !startDate && !endDate;
  if (usingDefaultWindow) {
    const now = new Date();
    endDate = now.toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    startDate = thirtyDaysAgo.toISOString().split('T')[0];
  }
  const endDateTime = endDate.includes('T') ? endDate : `${endDate}T23:59:59`;


  const cacheKey = JSON.stringify({ builderName, startDate, endDate, bundleFilter, amountRange, frontrunRouter });
  const cached = statsCache.get(cacheKey);
  if (cached) return cached;


  const params = [startDate, endDateTime];
  let p = 3;
  const dateFilterAB = ` AND block_time >= $1::timestamp AND block_time <= $2::timestamp`;
  const dateFilterBO = ` AND bo.block_time >= $1::timestamp AND bo.block_time <= $2::timestamp`;


  if (builderName) {
    const sql = `
      WITH f AS (
        SELECT *
        FROM ${TBL_OVERVIEW}
        WHERE builder_kind = 'builder'
          AND builder_group = $${p}
          ${dateFilterAB}
      )
      SELECT
        COUNT(*)::bigint AS total_blocks,
        COUNT(*) FILTER (WHERE has_sandwich)::bigint AS sandwich_blocks,
        MIN(block_number) AS earliest_block,
        MAX(block_number) AS latest_block
      FROM f;
    `;
    const { rows } = await pool.query(sql, [...params, builderName]);
    const r = rows[0] || {};
    const total = Number(r.total_blocks || 0);
    const sand = Number(r.sandwich_blocks || 0);
    const result = {
      scope: 'builder',
      builder_name: builderName,
      total_blocks: total,
      sandwich_blocks: sand,
      sandwich_percentage: total ? Number((100 * sand / total).toFixed(6)) : 0,
      earliest_block: Number(r.earliest_block || 0),
      latest_block: Number(r.latest_block || 0),
      date_range: { start: startDate, end: endDate },
      fast_path: false
    };
    statsCache.set(cacheKey, result);
    return result;
  }


  const { whereSql, params: filledParams, hasAmount } =
    buildFilters(amountRange, bundleFilter, frontrunRouter, params, p);

  const noExtraFilters = (bundleFilter === 'all') && !hasAmount && (frontrunRouter === 'all');


  let out;
  if (noExtraFilters) {
    out = await runBaseAndBreakdownNoFilter(filledParams, dateFilterAB);
  } else {
    out = await runBaseAndBreakdownWithFilter(filledParams, dateFilterAB, dateFilterBO, whereSql);
  }


  const result = {
    ...out,
    sandwich_percentage: out.total_blocks ? Number((100 * out.sandwich_blocks / out.total_blocks).toFixed(6)) : 0,
    sandwich_percentage_on_builder: out.builder_blocks ? Number((100 * out.sandwich_builder_blocks / out.builder_blocks).toFixed(6)) : 0,
    date_range: { start: startDate, end: endDate },
    fast_path: false
  };

  statsCache.set(cacheKey, result);
  return result;
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

async function getChartData(
  interval = 'daily',
  startDate = null,
  endDate = null,
  builders = null,
  bundleFilter = 'all',
  amountRange = null,
  frontrunRouter = 'all',
  snapshotBlock = null
) {

  const cacheKey = JSON.stringify({ interval, startDate, endDate, builders, bundleFilter, amountRange, frontrunRouter, snapshotBlock });
  const cached = chartCache.get(cacheKey);
  if (cached) {
    return cached;
  }


  if (!startDate && !endDate) {
    const now = new Date();
    endDate = now.toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    startDate = thirtyDaysAgo.toISOString().split('T')[0];
  }

  const endDateTime = endDate.includes('T') ? endDate : `${endDate}T23:59:59`;

  const hasAmount = !!amountRange && ((amountRange.min ?? '') !== '' || (amountRange.max ?? '') !== '');

  const usingFilters = !(bundleFilter === 'all' && !hasAmount && frontrunRouter === 'all');


  const dateTrunc = interval === 'hourly' ? 'hour' :
    interval === 'weekly' ? 'week' :
      interval === 'monthly' ? 'month' : 'day';


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
        ${snapshotBlock != null ? 'AND block_number <= $3' : ''}
      GROUP BY 1
      ORDER BY total_blocks DESC
      LIMIT 10;
    `;
    const topParams = snapshotBlock != null ? [startDate, endDateTime, snapshotBlock] : [startDate, endDateTime];
    const { rows } = await pool.query(topBuildersSql, topParams);
    builderList = rows.map(r => r.builder_name);
  }


  let params = [startDate, endDateTime];
  let paramIndex = 3;
  let sandwichFilterWhere = '';
  let filterConditions = [];

  // snapshot block condition
  let snapIdx = null;
  let snapBoCond = '';
  let snapBo2Cond = '';
  let snapSaCond = '';
  let snapOverviewCond = '';
  if (snapshotBlock != null) {
    params.push(snapshotBlock);
    snapIdx = paramIndex++;
    snapBoCond = ` AND bo.block_number <= $${snapIdx}`;
    snapBo2Cond = ` AND bo2.block_number <= $${snapIdx}`;
    snapSaCond = ` AND sa.block_number <= $${snapIdx}`;
    snapOverviewCond = ` AND block_number <= $${snapIdx}`;
  }

  if (bundleFilter === 'bundle-only') {
    filterConditions.push('sa.is_bundle = true');
  } else if (bundleFilter === 'non-bundle-only') {
    filterConditions.push('sa.is_bundle = false');
  }


  if (amountRange && ((amountRange.min ?? '') !== '' || (amountRange.max ?? '') !== '')) {
    const stableList = stableTokens.map(t => `'${t.toLowerCase()}'`).join(',');
    const range = [];
    if ((amountRange.min ?? '') !== '') { params.push(amountRange.min); range.push(`sa.profit_wei::numeric/1e18 >= $${paramIndex++}`); }
    if ((amountRange.max ?? '') !== '') { params.push(amountRange.max); range.push(`sa.profit_wei::numeric/1e18 <= $${paramIndex++}`); }
    filterConditions.push(`sa.profit_token IN (${stableList}) AND ${range.join(' AND ')}`);
  }

  if (frontrunRouter === 'public' || frontrunRouter === 'customized') {
    const routerList = publicRouters.map(r => `'${r.toLowerCase()}'`).join(',');
    filterConditions.push(`LOWER(sa.front_to) ${frontrunRouter === 'public' ? 'IN' : 'NOT IN'} (${routerList})`);
  }

  if (filterConditions.length > 0) {
    sandwichFilterWhere = ' AND ' + filterConditions.join(' AND ');
  }


  let sql;
  if (usingFilters) {
    sql = `
      WITH time_series AS (
        SELECT 
          date_trunc('${dateTrunc}', bo.block_time) as time_bucket,
          bo.builder_group AS builder_name,
          COUNT(DISTINCT bo.block_number) as total_blocks
        FROM ${TBL_OVERVIEW} bo
        WHERE bo.block_time >= $1::timestamp AND bo.block_time <= $2::timestamp
          AND bo.builder_kind = 'builder'
          AND bo.builder_group = ANY($${paramIndex}::text[])
          ${snapBoCond}
        GROUP BY 1, 2
      ),
      filtered_sandwiches AS (
        SELECT DISTINCT 
          sa.block_number,
          bo.builder_group AS builder_name,
          date_trunc('${dateTrunc}', bo.block_time) AS time_bucket
        FROM public.sandwich_attack sa
        JOIN ${TBL_OVERVIEW} bo ON sa.block_number = bo.block_number
        WHERE bo.block_time >= $1::timestamp AND bo.block_time <= $2::timestamp
          AND bo.builder_kind = 'builder'
          AND bo.builder_group = ANY($${paramIndex}::text[])
          ${sandwichFilterWhere}
          ${snapBoCond}
          ${snapSaCond}
      ),
      overall AS (
        SELECT 
          date_trunc('${dateTrunc}', bo.block_time) as time_bucket,
          COUNT(*) as total_blocks,
          COUNT(DISTINCT fs.block_number) as total_sandwich_blocks
        FROM ${TBL_OVERVIEW} bo
        LEFT JOIN (
          SELECT DISTINCT sa.block_number
          FROM public.sandwich_attack sa
          JOIN ${TBL_OVERVIEW} bo2 ON sa.block_number = bo2.block_number  
          WHERE bo2.block_time >= $1::timestamp AND bo2.block_time <= $2::timestamp
            ${sandwichFilterWhere}
            ${snapBo2Cond}
            ${snapSaCond}
        ) fs ON bo.block_number = fs.block_number
        WHERE bo.block_time >= $1::timestamp AND bo.block_time <= $2::timestamp
          ${snapBoCond}
        GROUP BY 1
      )
      SELECT 
        to_char(ts.time_bucket AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as date,
        ts.builder_name,
        ts.total_blocks,
        COUNT(DISTINCT fs.block_number) as sandwich_blocks,
        CASE 
          WHEN ts.total_blocks > 0 
          THEN ROUND(100.0 * COUNT(DISTINCT fs.block_number) / ts.total_blocks, 2)
          ELSE 0 
        END as sandwich_rate,
        o.total_blocks as overall_total_blocks,
        o.total_sandwich_blocks as overall_sandwich_blocks
      FROM time_series ts
      LEFT JOIN filtered_sandwiches fs ON fs.time_bucket = ts.time_bucket AND fs.builder_name = ts.builder_name
      JOIN overall o ON o.time_bucket = ts.time_bucket
      GROUP BY ts.time_bucket, ts.builder_name, ts.total_blocks, o.total_blocks, o.total_sandwich_blocks
      ORDER BY ts.time_bucket, ts.builder_name;
    `;
    params.push(builderList);
  } else {
    const buildersIdx = paramIndex;
    params.push(builderList);
    paramIndex++;
    
    sql = `
      WITH time_series AS (
        SELECT 
          date_trunc('${dateTrunc}', block_time) as time_bucket,
          builder_group AS builder_name,
          COUNT(*) as total_blocks,
          COUNT(*) FILTER (WHERE has_sandwich) as sandwich_blocks
        FROM ${TBL_OVERVIEW}
        WHERE block_time >= $1::timestamp AND block_time <= $2::timestamp
          AND builder_kind = 'builder'
          AND builder_group = ANY($${buildersIdx}::text[])
          ${snapOverviewCond}
        GROUP BY 1, 2
      ),
      overall AS (
        SELECT 
          date_trunc('${dateTrunc}', block_time) as time_bucket,
          COUNT(*) as total_blocks,
          COUNT(*) FILTER (WHERE has_sandwich) as total_sandwich_blocks
        FROM ${TBL_OVERVIEW}
        WHERE block_time >= $1::timestamp AND block_time <= $2::timestamp
          ${snapOverviewCond}
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
  }

  const { rows } = await pool.query(sql, params);


  const chartData = {};
  const summary = {
    builders: builderList,
    totalBlocks: 0,
    totalSandwiches: 0,
    avgRate: 0
  };
  const seenDates = new Set();

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


    if (!seenDates.has(row.date)) {
      seenDates.add(row.date);
      summary.totalBlocks += Number(row.overall_total_blocks || 0);
      summary.totalSandwiches += Number(row.overall_sandwich_blocks || 0);
    }
  });

  const series = Object.values(chartData);
  summary.avgRate = summary.totalBlocks > 0
    ? Number((100.0 * summary.totalSandwiches / summary.totalBlocks).toFixed(2))
    : 0;

  const result = {
    series,
    summary,
    interval,
    dateRange: { start: startDate, end: endDate }
  };


  chartCache.set(cacheKey, result);

  return result;
}

async function searchSandwiches({ victim_to = null, is_bundle = null, profit_token = null, builder = null, startDate = null,
  endDate = null, page = 1, limit = 50, sortBy = 'time', bnbUsd = null }) {

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

  const stableList = stableTokens.map(t => `'${t.toLowerCase()}'`).join(',');
  let dataParams = [];

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
    where += ` AND sa.block_time BETWEEN $${params.length - 1}::timestamp AND $${params.length}::timestamp`;
  }
  if (builder) {
    params.push(builder, builder);
    where += ` AND bo.builder_address IS NOT NULL
               AND ((bo.builder_kind='builder' AND bo.builder_group=$${params.length - 1})
                 OR (bo.builder_kind='bribe'   AND bo.builder_bribe_name=$${params.length}))`;
  }


  dataParams = params.slice();
  let orderBySql = 'sa.block_number DESC';
  if (sortBy === 'profit') {
    let bnbParamLiteral = 'NULL';
    if (Number.isFinite(bnbUsd) && bnbUsd > 0) {
      dataParams.push(bnbUsd);
      bnbParamLiteral = `$${dataParams.length}`;
    }
    const profitUsdExpr = `
          CASE
            WHEN sa.profit_token IN (${stableList}) THEN sa.profit_wei::numeric / 1e18
            WHEN sa.profit_token = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c' THEN (sa.profit_wei::numeric / 1e18) * ${bnbParamLiteral}
            ELSE NULL
          END
        `;
    orderBySql = `${profitUsdExpr} DESC NULLS LAST, sa.block_number DESC`;
  }

  dataParams.push(limit, offset);

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
    ORDER BY ${orderBySql}
    LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length};
  `;

  const countParams = params.slice(0);

  const countSql = `
    SELECT COUNT(DISTINCT sa.id) as total
    FROM public.sandwich_attack sa
    JOIN ${TBL_OVERVIEW} bo ON bo.block_number = sa.block_number
    WHERE ${where};
  `;

  const [countRes, dataRes] = await Promise.all([
    pool.query(countSql, countParams),
    pool.query(sql, dataParams)
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
  getEarliestBlock,
  getBuilderSandwiches,
  searchSandwiches,
  getChartData
};