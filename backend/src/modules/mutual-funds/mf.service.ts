import { query, queryOne } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

export interface MfTransaction {
  id: string;
  fund_id: string;
  user_id: string;
  units: number;
  nav: number;
  amount: number;
  type: 'purchase' | 'redemption';
  txn_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MfFundRow {
  id: string;
  user_id: string;
  name: string;
  scheme_code: string | null;
  latest_nav: number;
  notes: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // computed
  total_units: number;
  total_invested: number;
  total_value: number;
  profit_loss: number;
  transactions: MfTransaction[];
}

export class MfService {
  async listFunds(userId: string): Promise<MfFundRow[]> {
    const funds = await query<{
      id: string; user_id: string; name: string; scheme_code: string | null;
      latest_nav: string; notes: string | null; meta: Record<string, unknown>;
      created_at: string; updated_at: string;
    }>(
      `SELECT id, user_id, name, scheme_code, latest_nav, notes, meta, created_at, updated_at
       FROM mf_funds WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    if (funds.length === 0) return [];

    const fundIds = funds.map(f => f.id);
    const txns = await query<{
      id: string; fund_id: string; user_id: string;
      units: string; nav: string; amount: string;
      type: string; txn_date: string; notes: string | null;
      created_at: string; updated_at: string;
    }>(
      `SELECT id, fund_id, user_id, units, nav, amount, type, txn_date, notes, created_at, updated_at
       FROM mf_transactions
       WHERE fund_id = ANY($1::uuid[]) ORDER BY txn_date ASC`,
      [fundIds]
    );

    const txnsByFund = new Map<string, MfTransaction[]>();
    for (const t of txns) {
      const arr = txnsByFund.get(t.fund_id) ?? [];
      arr.push({
        ...t,
        units:  parseFloat(t.units),
        nav:    parseFloat(t.nav),
        amount: parseFloat(t.amount),
        type:   t.type as 'purchase' | 'redemption',
      });
      txnsByFund.set(t.fund_id, arr);
    }

    return funds.map(f => {
      const transactions = txnsByFund.get(f.id) ?? [];
      const latest_nav   = parseFloat(f.latest_nav);
      let total_units    = 0;
      let total_invested = 0;
      for (const t of transactions) {
        if (t.type === 'purchase')   { total_units += t.units; total_invested += t.amount; }
        if (t.type === 'redemption') { total_units -= t.units; total_invested -= t.amount; }
      }
      const total_value  = Math.round(total_units * latest_nav * 100) / 100;
      const profit_loss  = Math.round((total_value - total_invested) * 100) / 100;
      return { ...f, latest_nav, total_units, total_invested, total_value, profit_loss, transactions };
    });
  }

  async getFund(id: string, userId: string): Promise<MfFundRow> {
    const all = await this.listFunds(userId);
    const fund = all.find(f => f.id === id);
    if (!fund) throw new AppError(404, 'NOT_FOUND', 'Mutual fund not found');
    return fund;
  }

  async createFund(userId: string, data: {
    name: string;
    schemeCode?: string;
    latestNav?: number;
    notes?: string;
  }): Promise<MfFundRow> {
    const [row] = await query<{ id: string }>(
      `INSERT INTO mf_funds (user_id, name, scheme_code, latest_nav, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [userId, data.name, data.schemeCode ?? null, data.latestNav ?? 0, data.notes ?? null]
    );
    logger.info('MF fund created', { fundId: row.id, userId });
    return this.getFund(row.id, userId);
  }

  async updateFund(id: string, userId: string, data: {
    name?: string;
    schemeCode?: string | null;
    latestNav?: number;
    notes?: string | null;
  }): Promise<MfFundRow> {
    logger.debug('MF updateFund service called', { id, userId, data });
    await this.getFund(id, userId);
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (data.name      !== undefined) { fields.push(`name = $${idx++}`);        values.push(data.name); }
    if (data.schemeCode !== undefined) { fields.push(`scheme_code = $${idx++}`); values.push(data.schemeCode); }
    if (data.latestNav  !== undefined) { fields.push(`latest_nav = $${idx++}`);  values.push(data.latestNav); }
    if (data.notes      !== undefined) { fields.push(`notes = $${idx++}`);       values.push(data.notes); }
    fields.push('updated_at = NOW()');
    values.push(id, userId);
    const sql = `UPDATE mf_funds SET ${fields.join(', ')} WHERE id = $${idx++} AND user_id = $${idx}`;
    logger.debug('MF updateFund SQL', { sql, values });
    await query(sql, values);
    logger.info('MF fund updated', { fundId: id, userId });
    return this.getFund(id, userId);
  }

  async deleteFund(id: string, userId: string): Promise<void> {
    await this.getFund(id, userId);
    await query(`DELETE FROM mf_funds WHERE id = $1 AND user_id = $2`, [id, userId]);
    logger.info('MF fund deleted', { fundId: id, userId });
  }

  async addTransaction(fundId: string, userId: string, data: {
    units: number;
    nav: number;
    amount: number;
    type: 'purchase' | 'redemption';
    txnDate: string;
    notes?: string;
  }): Promise<MfTransaction> {
    await this.getFund(fundId, userId);
    const [row] = await query<MfTransaction & { units: string; nav: string; amount: string }>(
      `INSERT INTO mf_transactions (fund_id, user_id, units, nav, amount, type, txn_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, fund_id, user_id, units, nav, amount, type, txn_date, notes, created_at, updated_at`,
      [fundId, userId, data.units, data.nav, data.amount, data.type, data.txnDate, data.notes ?? null]
    );
    logger.info('MF transaction added', { txnId: row.id, fundId, userId });
    return { ...row, units: parseFloat(row.units as any), nav: parseFloat(row.nav as any), amount: parseFloat(row.amount as any) };
  }

  async deleteTransaction(txnId: string, userId: string): Promise<void> {
    const rows = await query<{ id: string }>(
      `DELETE FROM mf_transactions WHERE id = $1 AND user_id = $2 RETURNING id`, [txnId, userId]
    );
    if (rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Transaction not found');
    logger.info('MF transaction deleted', { txnId, userId });
  }
}
