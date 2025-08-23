const { pool, SCHEMA } = require('./db');

function ident(x) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(x)) {
    throw new Error(`Invalid identifier: ${x}`);
  }
  return `"${x}"`;
}

const TBL_OVERVIEW  = `${ident(SCHEMA)}.${ident('block_overview')}`;
const TBL_SANDWICH  = `${ident(SCHEMA)}.${ident('block_sandwiches')}`;

const INIT_SQL = `
CREATE SCHEMA IF NOT EXISTS ${ident(SCHEMA)};

CREATE TABLE IF NOT EXISTS ${TBL_OVERVIEW} (
  block_number BIGINT PRIMARY KEY,
  has_sandwich BOOLEAN NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ${TBL_SANDWICH} (
  block_number BIGINT PRIMARY KEY,
  sandwiches   JSONB  NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ${ident('idx_block_sandwiches_updated_at')}
  ON ${TBL_SANDWICH} (updated_at DESC);
`;

async function ensureSchema() {
  await pool.query(INIT_SQL);
}

async function upsertBlockOverview(blockNumber, hasSandwich) {
  const sql = `
    INSERT INTO ${TBL_OVERVIEW} (block_number, has_sandwich)
    VALUES ($1, $2)
    ON CONFLICT (block_number)
    DO UPDATE SET has_sandwich = EXCLUDED.has_sandwich, updated_at = NOW();
  `;
  await pool.query(sql, [blockNumber, !!hasSandwich]);
}

async function upsertBlockSandwiches(blockNumber, sandwiches) {
  const payload = JSON.stringify(sandwiches ?? []);
  const sql = `
    INSERT INTO ${TBL_SANDWICH} (block_number, sandwiches)
    VALUES ($1, $2::jsonb)
    ON CONFLICT (block_number)
    DO UPDATE SET sandwiches = EXCLUDED.sandwiches, updated_at = NOW();
  `;
  await pool.query(sql, [blockNumber, payload]);
}

module.exports = {
  ensureSchema,
  upsertBlockOverview,
  upsertBlockSandwiches,
};
