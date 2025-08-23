require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: '40.160.27.101',
  database: 'postgres',
  password: 'S3cur3P@ssw0rd!',
  port: Number(5432),
  max: Number(10),
  idleTimeoutMillis: Number(30000),
  allowExitOnIdle: false,
  application_name: 'sandwich_detector'
});

const SCHEMA = 'public';

pool.on('error', (err) => {
  console.error('Unexpected PG client error', err);
});

module.exports = { pool, SCHEMA };
