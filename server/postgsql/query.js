const { pool, SCHEMA } = require('./db');

function ident(x) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(x)) {
    throw new Error(`Invalid identifier: ${x}`);
  }
  return `"${x}"`;
}

const TBL_OVERVIEW = `${ident(SCHEMA)}.${ident('block_overview')}`;

async function getSandwichStats() {
  try {
    const sql = `
      SELECT 
        COUNT(*) as total_blocks,
        COUNT(CASE WHEN has_sandwich = true THEN 1 END) as sandwich_blocks,
        ROUND(
          (COUNT(CASE WHEN has_sandwich = true THEN 1 END)::numeric / 
           NULLIF(COUNT(*)::numeric, 0)) * 100, 
          4
        ) as sandwich_percentage,
        MAX(block_number) as latest_block,
        MIN(block_number) as earliest_block
      FROM ${TBL_OVERVIEW};
    `;
    
    const result = await pool.query(sql);
    return result.rows[0];
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