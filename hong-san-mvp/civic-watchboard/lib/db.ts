import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is missing. Set it in .env.local");
}

export const pool = new Pool({
  connectionString: DATABASE_URL,
  // Supabase는 보통 SSL 필요(환경에 따라)
  ssl: { rejectUnauthorized: false },
});
