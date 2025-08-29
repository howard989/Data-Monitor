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

async function getSandwichStats(builderName = null) {

  if (builderName) {
    const sql = `
      WITH f AS (
        SELECT *
        FROM ${TBL_OVERVIEW}
        WHERE builder_address IS NOT NULL
          AND (
            (builder_kind='builder' AND builder_group = $1) OR
            (builder_kind='bribe'   AND builder_bribe_name = $1)
          )
      )
      SELECT
        COUNT(*)::bigint AS total_blocks,
        COUNT(*) FILTER (WHERE has_sandwich)::bigint AS sandwich_blocks,
        MIN(block_number) AS earliest_block,
        MAX(block_number) AS latest_block
      FROM f;
    `;
    const { rows } = await pool.query(sql, [builderName]);
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
    FROM ${TBL_OVERVIEW};
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
    WHERE builder_address IS NOT NULL
    GROUP BY 1,2
    ORDER BY sandwich_blocks DESC, blocks DESC
    LIMIT 100;
  `;

  const [baseRes, brkRes] = await Promise.all([pool.query(baseSql), pool.query(breakdownSql)]);
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
};