import { query, queryOne } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

export interface AccountRow {
  id: string;
  user_id: string;
  name: string;
  account_type: string;
  institution: string | null;
  currency: string;
  balance: string;
  is_active: boolean;
  notes: string | null;
  meta: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export class AccountsService {
  async list(userId: string): Promise<AccountRow[]> {
    return query<AccountRow>(
      `SELECT id, user_id, name, account_type, institution, currency,
              balance, is_active, notes, meta, created_at, updated_at
       FROM accounts
       WHERE user_id = $1
         AND account_type IN ('savings', 'current', 'cash', 'other', 'bank')
       ORDER BY created_at DESC`,
      [userId]
    );
  }

  async getOne(id: string, userId: string): Promise<AccountRow> {
    const account = await queryOne<AccountRow>(
      `SELECT id, user_id, name, account_type, institution, currency,
              balance, is_active, notes, meta, created_at, updated_at
       FROM accounts
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (!account) throw new AppError(404, 'NOT_FOUND', 'Account not found');
    return account;
  }

  async create(
    userId: string,
    data: {
      name: string;
      accountType: string;
      institution?: string;
      currency: string;
      balance: number;
      notes?: string;
      meta: Record<string, unknown>;
    }
  ): Promise<AccountRow> {
    const [account] = await query<AccountRow>(
      `INSERT INTO accounts (user_id, name, account_type, institution, currency, balance, notes, meta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, user_id, name, account_type, institution, currency,
                 balance, is_active, notes, meta, created_at, updated_at`,
      [
        userId,
        data.name,
        data.accountType,
        data.institution ?? null,
        data.currency,
        data.balance,
        data.notes ?? null,
        JSON.stringify(data.meta),
      ]
    );
    logger.info('Account created', { accountId: account.id, userId });
    return account;
  }

  async update(
    id: string,
    userId: string,
    data: {
      name?: string;
      institution?: string | null;
      currency?: string;
      balance?: number;
      notes?: string | null;
      meta?: Record<string, unknown>;
      isActive?: boolean;
    }
  ): Promise<AccountRow> {
    await this.getOne(id, userId);

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.name !== undefined)        { fields.push(`name = $${idx++}`);        values.push(data.name); }
    if (data.institution !== undefined) { fields.push(`institution = $${idx++}`); values.push(data.institution); }
    if (data.currency !== undefined)    { fields.push(`currency = $${idx++}`);    values.push(data.currency); }
    if (data.balance !== undefined)     { fields.push(`balance = $${idx++}`);     values.push(data.balance); }
    if (data.notes !== undefined)       { fields.push(`notes = $${idx++}`);       values.push(data.notes); }
    if (data.meta !== undefined)        { fields.push(`meta = $${idx++}`);        values.push(JSON.stringify(data.meta)); }
    if (data.isActive !== undefined)    { fields.push(`is_active = $${idx++}`);   values.push(data.isActive); }

    fields.push(`updated_at = NOW()`);
    values.push(id, userId);

    const [account] = await query<AccountRow>(
      `UPDATE accounts SET ${fields.join(', ')}
       WHERE id = $${idx++} AND user_id = $${idx}
       RETURNING id, user_id, name, account_type, institution, currency,
                 balance, is_active, notes, meta, created_at, updated_at`,
      values
    );
    logger.info('Account updated', { accountId: id, userId });
    return account;
  }

  async updateBalance(id: string, userId: string, balance: number, notes?: string): Promise<AccountRow> {
    await this.getOne(id, userId);

    const extraFields = notes !== undefined ? `, notes = $3` : '';
    const extraValues = notes !== undefined ? [id, userId, balance, notes] : [id, userId, balance];

    const sql = `
      UPDATE accounts
      SET balance = $3, updated_at = NOW()${extraFields}
      WHERE id = $1 AND user_id = $2
      RETURNING id, user_id, name, account_type, institution, currency,
                balance, is_active, notes, meta, created_at, updated_at
    `;

    const [account] = await query<AccountRow>(sql, extraValues);
    logger.info('Account balance updated', { accountId: id, userId, balance });
    return account;
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.getOne(id, userId);
    await query('DELETE FROM accounts WHERE id = $1 AND user_id = $2', [id, userId]);
    logger.info('Account deleted', { accountId: id, userId });
  }
}
