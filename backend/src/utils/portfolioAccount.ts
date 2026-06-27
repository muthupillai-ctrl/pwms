import { query, queryOne } from '../config/db';

/**
 * Returns the id of a hidden portfolio account for the given user+type.
 * Creates it if it doesn't exist yet. These accounts are auto-managed
 * and never shown in the user-facing accounts list.
 */
export async function getOrCreatePortfolioAccount(
  userId: string,
  accountType: string,
  name: string,
): Promise<string> {
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM accounts
     WHERE user_id = $1
       AND account_type = $2
       AND (meta->>'isPortfolio')::boolean = true
     LIMIT 1`,
    [userId, accountType]
  );
  if (existing) return existing.id;

  const [account] = await query<{ id: string }>(
    `INSERT INTO accounts (user_id, name, account_type, currency, balance, meta)
     VALUES ($1, $2, $3, 'INR', 0, '{"isPortfolio": true}')
     RETURNING id`,
    [userId, name, accountType]
  );
  return account.id;
}
