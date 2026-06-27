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
  current_price: string | null;
  price_as_of: Date | null;
  interest_rate: string | null;
  purchase_date: string | null;
  maturity_date: string | null;
  meta: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  account_name: string;
}

export interface BondResponse extends BondRow {
  quantity: number;
  buy_price: number;
  coupon_rate: number;
  face_value_per_unit: number;
  invested_value: number;
  current_value: number;
  face_value_total: number;
  accrued_interest: number;
  gain_loss: number;
  gain_loss_pct: number;
  days_held: number;
  tenure_days: number;
  payouts: PayoutResponse[];
}

function enrichPayout(row: PayoutRow): PayoutResponse {
  const interest  = parseFloat(row.interest_payout);
  const principal = parseFloat(row.principal_amount);
  return {
    id:               row.id,
    bond_id:          row.bond_id,
    payout_date:      row.payout_date,
    frequency:        row.frequency,
    interest_payout:  interest,
    principal_amount: principal,
    total_payout:     Math.round((interest + principal) * 100) / 100,
    notes:            row.notes,
    created_at:       row.created_at,
  };
}

function enrich(row: BondRow, payouts: PayoutResponse[] = []): BondResponse {
  const quantity         = parseFloat(row.units);
  const buyPrice         = parseFloat(row.purchase_price ?? '0');
  const couponRate       = parseFloat(row.interest_rate ?? '0');
  const currPrice        = row.current_price ? parseFloat(row.current_price) : null;
  const faceValuePerUnit = parseFloat((row.meta?.face_value_per_unit as string) ?? '1000');

  const investedValue  = Math.round(quantity * buyPrice * 100) / 100;
  const currentValue   = currPrice != null ? Math.round(quantity * currPrice * 100) / 100 : investedValue;
  const faceValueTotal = Math.round(quantity * faceValuePerUnit * 100) / 100;

  const today    = new Date().toISOString().slice(0, 10);
  const start    = row.purchase_date ?? today;
  const maturity = row.maturity_date ?? today;

  const daysHeld   = Math.max(0, Math.floor((new Date(today).getTime()    - new Date(start).getTime())    / 86_400_000));
  const tenureDays = Math.max(0, Math.floor((new Date(maturity).getTime() - new Date(start).getTime())    / 86_400_000));

  const accruedInterest = Math.round(faceValueTotal * (couponRate / 100) * (daysHeld / 365) * 100) / 100;
  const gainLoss        = Math.round((currentValue - investedValue) * 100) / 100;
  const gainLossPct     = investedValue > 0 ? Math.round((gainLoss / investedValue) * 10000) / 100 : 0;

  return { ...row, quantity, buy_price: buyPrice, coupon_rate: couponRate, face_value_per_unit: faceValuePerUnit, invested_value: investedValue, current_value: currentValue, face_value_total: faceValueTotal, accrued_interest: accruedInterest, gain_loss: gainLoss, gain_loss_pct: gainLossPct, days_held: daysHeld, tenure_days: tenureDays, payouts };
}

const SELECT = `
  SELECT a.id, a.account_id, a.user_id, a.name, a.symbol,
         a.units, a.purchase_price, a.current_price, a.price_as_of,
         a.interest_rate, a.purchase_date, a.maturity_date,
         a.meta, a.created_at, a.updated_at,
         acc.name AS account_name
  FROM assets a
  JOIN accounts acc ON acc.id = a.account_id
  WHERE a.asset_type = 'bond'
`;

export class BondsService {
  async list(userId: string): Promise<BondResponse[]> {
    const rows = await query<BondRow>(`${SELECT} AND a.user_id = $1 ORDER BY a.created_at DESC`, [userId]);
    if (rows.length === 0) return [];
    const bondIds = rows.map(r => r.id);
    const payoutRows = await query<PayoutRow>(
      `SELECT id, bond_id, user_id, payout_date::text, frequency, interest_payout, principal_amount, notes, created_at
       FROM bond_payouts WHERE bond_id = ANY($1::uuid[]) ORDER BY payout_date ASC`,
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
      `SELECT id, bond_id, user_id, payout_date::text, frequency, interest_payout, principal_amount, notes, created_at
       FROM bond_payouts WHERE bond_id = $1 ORDER BY payout_date ASC`,
      [id]
    );
    return enrich(row, payoutRows.map(enrichPayout));
  }

  async create(userId: string, data: {
    accountId?: string; name: string; isin?: string; quantity: number;
    purchasePrice: number; couponRate: number; purchaseDate?: string;
    maturityDate: string; faceValuePerUnit: number; currentPrice?: number;
    notes?: string; meta: Record<string, unknown>;
  }): Promise<BondResponse> {
    const accountId = data.accountId ??
      await getOrCreatePortfolioAccount(userId, 'bond', 'Bonds Portfolio');

    const meta = { ...data.meta, face_value_per_unit: data.faceValuePerUnit, ...(data.notes ? { notes: data.notes } : {}) };

    const [row] = await query<{ id: string }>(
      `INSERT INTO assets (account_id, user_id, asset_type, symbol, name, units, purchase_price, interest_rate, purchase_date, maturity_date, current_price, price_as_of, meta)
       VALUES ($1,$2,'bond',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id`,
      [accountId, userId, data.isin ?? null, data.name, data.quantity, data.purchasePrice,
       data.couponRate, data.purchaseDate ?? null, data.maturityDate,
       data.currentPrice ?? null, data.currentPrice ? new Date() : null, JSON.stringify(meta)]
    );
    logger.info('Bond created', { bondId: row.id, userId });
    return this.getOne(row.id, userId);
  }

  async update(id: string, userId: string, data: { name?: string; couponRate?: number; maturityDate?: string; notes?: string | null; meta?: Record<string, unknown> }): Promise<BondResponse> {
    const existing = await this.getOne(id, userId);
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.name !== undefined)         { fields.push(`name = $${idx++}`);          values.push(data.name); }
    if (data.couponRate !== undefined)   { fields.push(`interest_rate = $${idx++}`); values.push(data.couponRate); }
    if (data.maturityDate !== undefined) { fields.push(`maturity_date = $${idx++}`); values.push(data.maturityDate); }

    if (data.notes !== undefined || data.meta !== undefined) {
      const mergedMeta = { ...existing.meta, ...(data.meta ?? {}), ...(data.notes !== undefined ? { notes: data.notes } : {}) };
      fields.push(`meta = $${idx++}`);
      values.push(JSON.stringify(mergedMeta));
    }

    fields.push('updated_at = NOW()');
    values.push(id, userId);
    await query(`UPDATE assets SET ${fields.join(', ')} WHERE id = $${idx++} AND user_id = $${idx} AND asset_type = 'bond'`, values);
    logger.info('Bond updated', { bondId: id, userId });
    return this.getOne(id, userId);
  }

  async updatePrice(id: string, userId: string, currentPrice: number): Promise<BondResponse> {
    await this.getOne(id, userId);
    await query(
      `UPDATE assets SET current_price = $1, price_as_of = NOW(), updated_at = NOW() WHERE id = $2 AND user_id = $3 AND asset_type = 'bond'`,
      [currentPrice, id, userId]
    );
    logger.info('Bond price updated', { bondId: id, userId, currentPrice });
    return this.getOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.getOne(id, userId);
    await query(`DELETE FROM assets WHERE id = $1 AND user_id = $2 AND asset_type = 'bond'`, [id, userId]);
    logger.info('Bond deleted', { bondId: id, userId });
  }

  async addPayout(bondId: string, userId: string, data: {
    payoutDate: string; frequency: string;
    interestPayout: number; principalAmount: number; notes?: string;
  }): Promise<PayoutResponse> {
    await this.getOne(bondId, userId);
    const [row] = await query<PayoutRow>(
      `INSERT INTO bond_payouts (bond_id, user_id, payout_date, frequency, interest_payout, principal_amount, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, bond_id, user_id, payout_date::text, frequency, interest_payout, principal_amount, notes, created_at`,
      [bondId, userId, data.payoutDate, data.frequency, data.interestPayout, data.principalAmount, data.notes ?? null]
    );
    logger.info('Bond payout added', { payoutId: row.id, bondId, userId });
    return enrichPayout(row);
  }

  async deletePayout(payoutId: string, userId: string): Promise<void> {
    const rows = await query<{ id: string }>(
      `DELETE FROM bond_payouts WHERE id = $1 AND user_id = $2 RETURNING id`, [payoutId, userId]
    );
    if (rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Payout not found');
    logger.info('Bond payout deleted', { payoutId, userId });
  }
}
