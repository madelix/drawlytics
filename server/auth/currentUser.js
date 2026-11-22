import { clerkClient, getAuth } from '@clerk/express';
import { pool } from '../db.js';

export async function getCurrentDrawlyticsUser(req) {
  const { userId } = getAuth(req);
  if (!userId) return null;

  const existing = await pool.query(
    `
      SELECT id, clerk_user_id, email
      FROM users
      WHERE clerk_user_id = $1
    `,
    [userId],
  );

  if (existing.rows.length > 0) return existing.rows[0];

  const clerkUser = await clerkClient.users.getUser(userId);
  const primaryEmail = clerkUser.emailAddresses.find(
    (address) => address.id === clerkUser.primaryEmailAddressId,
  )?.emailAddress;

  const { rows } = await pool.query(
    `
      INSERT INTO users (clerk_user_id, email)
      VALUES ($1, $2)
      ON CONFLICT (clerk_user_id) DO UPDATE
      SET email = EXCLUDED.email
      RETURNING id, clerk_user_id, email
    `,
    [userId, primaryEmail ?? null],
  );

  return rows[0];
}
