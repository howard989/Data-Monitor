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
    SELECT DISTINCT
      CASE
        WHEN builder_kind = 'builder' THEN builder_group
        WHEN builder_kind = 'bribe'   THEN builder_bribe_name
      END AS builder_name
    FROM ${TBL_OVERVIEW}
    WHERE builder_address IS NOT NULL
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
        WHERE builder_address IS NOT NULL
          AND (
            (builder_kind='builder' AND builder_group = $${paramIndex}) OR
            (builder_kind='bribe'   AND builder_bribe_name = $${paramIndex})
          )
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
    const sand  = Number(r.sandwich_blocks || 0);
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
    SELECT
      CASE
        WHEN builder_kind = 'builder' THEN builder_group
        WHEN builder_kind = 'bribe'   THEN builder_bribe_name
        ELSE NULL
      END AS builder_name,
      builder_kind,
      COUNT(*)::bigint AS blocks,
      COUNT(*) FILTER (WHERE has_sandwich)::bigint AS sandwich_blocks
    FROM ${TBL_OVERVIEW}
    WHERE builder_address IS NOT NULL ${dateFilter}
    GROUP BY 1,2
    ORDER BY (CASE WHEN COUNT(*) > 0 THEN 100.0 * COUNT(*) FILTER (WHERE has_sandwich) / COUNT(*) ELSE 0 END) DESC, blocks DESC
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
    sandwich_percentage: r.blocks ? Number((100 * Number(r.sandwich_blocks) / Number(r.blocks)).toFixed(6)) : 0
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
    WHERE bo.builder_address IS NOT NULL
      AND (
        (bo.builder_kind = 'builder' AND bo.builder_group = $1) OR
        (bo.builder_kind = 'bribe' AND bo.builder_bribe_name = $1)
      )
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
      sa.front_tx_hash,
      sa.victim_tx_hash,
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
    WHERE bo.builder_address IS NOT NULL
      AND (
        (bo.builder_kind = 'builder' AND bo.builder_group = $1) OR
        (bo.builder_kind = 'bribe' AND bo.builder_bribe_name = $1)
      )
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


module.exports = {
  getSandwichStats,
  getRecentBlocks,
  findSandwichByTx,
  getBlockSandwiches, 
  getHourlyStats,
  getBlockMeta,     
  getBuilderList,
  getBuilderSandwiches,
};