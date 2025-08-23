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

async function getSandwichStats() {
  try {
    const now = Date.now();
    

    if (statsCache && (now - statsCacheTime) < STATS_CACHE_DURATION) {
      return statsCache;
    }


    if (statsInFlight) {
      return statsInFlight;
    }

    const sql = `
      SELECT 
        COUNT(*) AS total_blocks,
        COUNT(*) FILTER (WHERE has_sandwich) AS sandwich_blocks,
        ROUND(
          COALESCE(100.0 * COUNT(*) FILTER (WHERE has_sandwich) / 
          NULLIF(COUNT(*), 0), 0), 
          4
        ) AS sandwich_percentage,
        MAX(block_number) AS latest_block,
        MIN(block_number) AS earliest_block
      FROM ${TBL_OVERVIEW};
    `;
    

    statsInFlight = pool.query(sql)
      .then(result => {
        const raw = result.rows[0];
        statsCache = {
          total_blocks: Number(raw.total_blocks),
          sandwich_blocks: Number(raw.sandwich_blocks),
          sandwich_percentage: Number(raw.sandwich_percentage),
          latest_block: Number(raw.latest_block),
          earliest_block: Number(raw.earliest_block)
        };
        statsCacheTime = Date.now();  
        return statsCache;
      })
      .finally(() => { 
        statsInFlight = null; 
      });
    
    return statsInFlight;
  } catch (error) {
    console.error('Error getting sandwich stats:', error);
    throw error;
  }
}

async function getRecentBlocks(limit = 50) {
  try {
    const sql = `
      SELECT 
        block_number,
        has_sandwich,
        updated_at
      FROM ${TBL_OVERVIEW}
      ORDER BY block_number DESC
      LIMIT $1;
    `;
    
    const result = await pool.query(sql, [limit]);
    return result.rows;
  } catch (error) {
    console.error('Error getting recent blocks:', error);
    throw error;
  }
}

module.exports = {
  getSandwichStats,
  getRecentBlocks
};