require("dotenv").config({ path: ".env.local" });

const { Pool } = require("pg");
const { createClient } = require("redis");

async function test() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const redis = createClient({
    url: process.env.REDIS_URL,
  });

  try {
    const result = await pool.query("SELECT NOW()");
    console.log("PostgreSQL connected:", result.rows[0]);

    await redis.connect();
    console.log("Redis connected:", await redis.ping());

  } catch (error) {
    console.error(error);
  } finally {
    await pool.end();
    if (redis.isOpen) await redis.quit();
  }
}

test();