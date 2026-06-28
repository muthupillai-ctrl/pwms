/**
 * Manually set a user's password.
 * Usage:  npx tsx scripts/set-password.ts <email> <new-password>
 * Example: npx tsx scripts/set-password.ts admin@example.com "NewPass@123"
 */
import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcryptjs';
import { Pool } from 'pg';

const [, , email, newPassword] = process.argv;

if (!email || !newPassword) {
  console.error('Usage: npx tsx scripts/set-password.ts <email> <new-password>');
  process.exit(1);
}

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT ?? '5432', 10),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl:      process.env.DB_SSL !== 'false' ? { rejectUnauthorized: false } : false,
});

(async () => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      'SELECT id, email, full_name FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (rows.length === 0) {
      console.error(`No user found with email: ${email}`);
      process.exit(1);
    }

    const user = rows[0];
    const hash = await bcrypt.hash(newPassword, 12);

    await client.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hash, user.id]
    );

    console.log(`Password updated for ${user.full_name} (${user.email})`);
  } finally {
    client.release();
    await pool.end();
  }
})();
