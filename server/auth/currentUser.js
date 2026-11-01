import { getAuth } from '@clerk/express';
import { pool } from '../db.js';

export async function getCurrentDrawlyticsUser(req) {
  const auth = getAuth(req);

  if (!auth.userId) {
    return null;
  }

  const { rows } = await pool.query(
    `
    SELECT id, clerk_user_id, email
    FROM users
    WHERE clerk_user_id = $1
    LIMIT 1
    `,
    [auth.userId],
  );

  return rows[0] ?? null;
}
