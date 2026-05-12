const sql = require('mssql/msnodesqlv8');

const dbConfig = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  driver: process.env.DB_DRIVER,
  port: 1433,
  options: {
    trustedConnection: true,
    trustServerCertificate: true,
  },
};

let pool;

async function getPool() {
  if (!pool) {
    pool = await sql.connect(dbConfig);
  }
  return pool;
}

module.exports = { sql, getPool };
