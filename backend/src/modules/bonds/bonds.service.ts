import { query, queryOne } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { getOrCreatePortfolioAccount } from '../../utils/portfolioAccount';

export interface PayoutRow {
  id: string;
  bond_id: string;
  user_id: string;
  payout_date: string;
  frequency: string;
  interest_payout: string;
  tds: string;
  principal_amount: string;
  notes: string | null;
  created_at: Date;
}

export interface PayoutResponse {
  id: string;
  bond_id: string;
  payout_date: string;
  frequency: string;
  interest_payout: number;
  tds: number;
  principal_amount: number;
  total_payout: number;
  notes: string | null;
  created_at: Date;
}

export interface BondRow {
  id: string;
  account_id: string;
  user_id: string;
  name: string;
  symbol: string | null;
  units: string;
  purchase_price: string | null;
  purchase_date: string | null;
  maturity_date: string | null;
  meta: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  account_name: string;
}

export interface BondResponse extends BondRow {
  investment_amount: number;
  total_tds: number;
  expected_total_interest: number;
  total: number;
  payouts: PayoutResponse[];
}

function enrichPayout(row: PayoutRow): PayoutResponse {
  const interest  = parseFloat(row.interest_payout);
  const tds       = parseFloat(row.tds ?? '0');
  const principal = parseFloat(row.principal_amount);
  return {
    id:               row.id,
    bond_id:          row.bond_id,
    payout_date:      row.payout_date,
    frequency:        row.frequency,
    interest_payout:  interest,
    tds,
    principal_amount: principal,
    total_payout:     Math.round((interest + principal - tds) * 100) / 100,
    notes:            row.notes,
    created_at:       row.created_at,
  };
}

function enrich(row: BondRow, payouts: PayoutResponse[] = []): BondResponse {
  const investmentAmount = parseFloat(row.purchase_price ?? '0');
  const today            = new Date().toISOString().slice(0, 10);
  const futurePays       = payouts.filter(p => p.payout_date >= today);
  const grossInterest    = Math.round(futurePays.reduce((s, p) => s + p.interest_payout, 0) * 100) / 100;
  const totalTds         = Math.round(futurePays.reduce((s, p) => s + p.tds,             0) * 100) / 100;
  const expectedTotalInterest = Math.round((grossInterest - totalTds) * 100) / 100;
  const total            = Math.round(futurePays.reduce((s, p) => s + p.total_payout,    0) * 100) / 100;

  return {
    ...row,
    investment_amount:       investmentAmount,
    total_tds:               totalTds,
    expected_total_interest: expectedTotalInterest,
    total,
    payouts,
  };
}

const SELECT = `
  SELECT a.id, a.account_id, a.user_id, a.name, a.symbol,
         a.units, a.purchase_price, a.purchase_date, a.maturity_date,
         a.meta, a.created_at, a.updated_at,
         acc.name AS account_name
  FROM assets a
  JOIN accounts acc ON acc.id = a.account_id
  WHERE a.asset_type = 'bond'
`;

const PAYOUT_SELECT = `
  SELECT id, bond_id, user_id, payout_date::text, frequency,
         interest_payout, tds, principal_amount, notes, created_at
  FROM bond_payouts
`;

export class BondsService {
  async list(userId: string): Promise<BondResponse[]> {
    const rows = await query<BondRow>(`${SELECT} AND a.user_id = $1 ORDER BY a.created_at DESC`, [userId]);
    if (rows.length === 0) return [];

    const bondIds = rows.map(r => r.id);
    const payoutRows = await query<PayoutRow>(
      `${PAYOUT_SELECT} WHERE bond_id = ANY($1::uuid[]) ORDER BY payout_date DESC`,
      [bondIds]
    );

    const byBond = new Map<string, PayoutResponse[]>();
    for (const p of payoutRows) {
      const arr = byBond.get(p.bond_id) ?? [];
      arr.push(enrichPayout(p));
      byBond.set(p.bond_id, arr);
    }
    return rows.map(r => enrich(r, byBond.get(r.id) ?? []));
  }

  async getOne(id: string, userId: string): Promise<BondResponse> {
    const row = await queryOne<BondRow>(`${SELECT} AND a.id = $1 AND a.user_id = $2`, [id, userId]);
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Bond not found');

    const payoutRows = await query<PayoutRow>(
      `${PAYOUT_SELECT} WHERE bond_id = $1 ORDER BY payout_date DESC`,
      [id]
    );
    return enrich(row, payoutRows.map(enrichPayout));
  }

  async create(userId: string, data: {
    accountId?: string;
    name: string;
    isin?: string;
    investmentAmount: number;
    purchaseDate: string;
    maturityDate: string;
    notes?: string;
    meta: Record<string, unknown>;
  }): Promise<BondResponse> {
    const accountId = data.accountId ??
      await getOrCreatePortfolioAccount(userId, 'bond', 'Bonds Portfolio');

    const meta = { ...data.meta, ...(data.notes ? { notes: data.notes } : {}) };

    const [row] = await query<{ id: string }>(
      `INSERT INTO assets
         (account_id, user_id, asset_type, symbol, name, units, purchase_price, purchase_date, maturity_date, meta)
       VALUES ($1, $2, 'bond', $3, $4, 1, $5, $6, $7, $8)
       RETURNING id`,
      [accountId, userId, data.isin ?? null, data.name,
       data.investmentAmount, data.purchaseDate, data.maturityDate, JSON.stringify(meta)]
    );
    logger.info('Bond created', { bondId: row.id, userId });
    return this.getOne(row.id, userId);
  }

  async update(id: string, userId: string, data: {
    name?: string;
    isin?: string | null;
    investmentAmount?: number;
    purchaseDate?: string | null;
    maturityDate?: string;
    notes?: string | null;
    meta?: Record<string, unknown>;
  }): Promise<BondResponse> {
    const existing = await this.getOne(id, userId);
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.name !== undefined)             { fields.push(`name = $${idx++}`);           values.push(data.name); }
    if (data.isin !== undefined)             { fields.push(`symbol = $${idx++}`);          values.push(data.isin || null); }
    if (data.investmentAmount !== undefined) { fields.push(`purchase_price = $${idx++}`);  values.push(data.investmentAmount); }
    if (data.purchaseDate !== undefined)     { fields.push(`purchase_date = $${idx++}`);   values.push(data.purchaseDate || null); }
    if (data.maturityDate !== undefined)     { fields.push(`maturity_date = $${idx++}`);   values.push(data.maturityDate); }

    const needsMeta = data.notes !== undefined || data.meta !== undefined;
    if (needsMeta) {
      const mergedMeta = {
        ...existing.meta,
        ...(data.meta ?? {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      };
      fields.push(`meta = $${idx++}`);
      values.push(JSON.stringify(mergedMeta));
    }

    if (fields.length === 0) return existing;

    fields.push('updated_at = NOW()');
    values.push(id, userId);
    await query(
      `UPDATE assets SET ${fields.join(', ')} WHERE id = $${idx++} AND user_id = $${idx} AND asset_type = 'bond'`,
      values
    );
    logger.info('Bond updated', { bondId: id, userId });
    return this.getOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.getOne(id, userId);
    await query(`DELETE FROM assets WHERE id = $1 AND user_id = $2 AND asset_type = 'bond'`, [id, userId]);
    logger.info('Bond deleted', { bondId: id, userId });
  }

  async addPayout(bondId: string, userId: string, data: {
    payoutDate: string;
    frequency: string;
    interestPayout: number;
    tds: number;
    principalAmount: number;
    notes?: string;
  }): Promise<PayoutResponse> {
    await this.getOne(bondId, userId);
    const [row] = await query<PayoutRow>(
      `INSERT INTO bond_payouts
         (bond_id, user_id, payout_date, frequency, interest_payout, tds, principal_amount, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, bond_id, user_id, payout_date::text, frequency, interest_payout, tds, principal_amount, notes, created_at`,
      [bondId, userId, data.payoutDate, data.frequency,
       data.interestPayout, data.tds, data.principalAmount, data.notes ?? null]
    );
    logger.info('Bond payout added', { payoutId: row.id, bondId, userId });
    return enrichPayout(row);
  }

  async deletePayout(payoutId: string, userId: string): Promise<void> {
    const rows = await query<{ id: string }>(
      `DELETE FROM bond_payouts WHERE id = $1 AND user_id = $2 RETURNING id`,
      [payoutId, userId]
    );
    if (rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Payout not found');
    logger.info('Bond payout deleted', { payoutId, userId });
  }
}
