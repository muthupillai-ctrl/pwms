import { query, queryOne } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { getOrCreatePortfolioAccount } from '../../utils/portfolioAccount';

type Compounding = 'simple' | 'monthly' | 'quarterly' | 'half_yearly' | 'annual';

export interface FdRow {
  id: string;
  account_id: string;
  user_id: string;
  name: string;
  symbol: string | null;      // fd_number stored here
  units: string;              // principal
  interest_rate: string | null;
  purchase_date: string | null;
  maturity_date: string | null;
  meta: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  // joined
  account_name: string;
}

export interface FdResponse extends FdRow {
  principal: number;
  maturity_amount: number;
  tenure_days: number;
}

const COMPOUNDING_PERIODS: Record<Compounding, number> = {
  simple:      0,
  annual:      1,
  half_yearly: 2,
  quarterly:   4,
  monthly:     12,
};

function calcMaturityAmount(
  principal: number,
  ratePercent: number,
  startDate: string,
  maturityDate: string,
  compounding: Compounding
): { maturityAmount: number; tenureDays: number } {
  const start = new Date(startDate);
  const end   = new Date(maturityDate);
  const tenureDays = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
  const years = tenureDays / 365;
  const rate  = ratePercent / 100;

  let maturityAmount: number;
  if (compounding === 'simple') {
    maturityAmount = principal * (1 + rate * years);
  } else {
    const n = COMPOUNDING_PERIODS[compounding];
    maturityAmount = principal * Math.pow(1 + rate / n, n * years);
  }

  return { maturityAmount: Math.round(maturityAmount * 100) / 100, tenureDays };
}

function enrichFd(fd: FdRow): FdResponse {
  const principal   = parseFloat(fd.units);
  const rate        = parseFloat(fd.interest_rate ?? '0');
  const compounding = ((fd.meta?.compounding as Compounding) ?? 'quarterly');
  const start       = fd.purchase_date ?? new Date().toISOString().slice(0, 10);
  const maturity    = fd.maturity_date ?? start;

  const { maturityAmount: calcAmount, tenureDays } = calcMaturityAmount(principal, rate, start, maturity, compounding);

  const assured = fd.meta?.assuredMaturityAmount;
  const maturity_amount = (typeof assured === 'number' && assured > 0) ? assured : calcAmount;

  return { ...fd, principal, maturity_amount, tenure_days: tenureDays };
}

const SELECT_FD = `
  SELECT
    a.id, a.account_id, a.user_id, a.name, a.symbol,
    a.units, a.interest_rate, a.purchase_date, a.maturity_date,
    a.meta, a.created_at, a.updated_at,
    acc.name AS account_name
  FROM assets a
  JOIN accounts acc ON acc.id = a.account_id
  WHERE a.asset_type = 'fd'
`;

export class FdService {
  async list(userId: string): Promise<FdResponse[]> {
    const rows = await query<FdRow>(
      `${SELECT_FD} AND a.user_id = $1 ORDER BY a.created_at DESC`,
      [userId]
    );
    return rows.map(enrichFd);
  }

  async getOne(id: string, userId: string): Promise<FdResponse> {
    const fd = await queryOne<FdRow>(
      `${SELECT_FD} AND a.id = $1 AND a.user_id = $2`,
      [id, userId]
    );
    if (!fd) throw new AppError(404, 'NOT_FOUND', 'Fixed deposit not found');
    return enrichFd(fd);
  }

  async create(
    userId: string,
    data: {
      accountId?: string;
      name: string;
      fdNumber?: string;
      principal: number;
      interestRate: number;
      startDate: string;
      maturityDate: string;
      compounding: Compounding;
      assuredMaturityAmount?: number;
      notes?: string;
      meta: Record<string, unknown>;
    }
  ): Promise<FdResponse> {
    const accountId = data.accountId ??
      await getOrCreatePortfolioAccount(userId, 'fixed_deposit', 'Fixed Deposits Portfolio');

    const meta: Record<string, unknown> = { ...data.meta, compounding: data.compounding };
    if (data.notes) meta.notes = data.notes;
    if (data.assuredMaturityAmount) meta.assuredMaturityAmount = data.assuredMaturityAmount;

    const [row] = await query<FdRow>(
      `INSERT INTO assets
         (account_id, user_id, asset_type, name, symbol, units, interest_rate, purchase_date, maturity_date, meta)
       VALUES ($1, $2, 'fd', $3, $4, $5, $6, $7, $8, $9)
       RETURNING
         id, account_id, user_id, name, symbol,
         units, interest_rate, purchase_date, maturity_date,
         meta, created_at, updated_at`,
      [
        accountId,
        userId,
        data.name,
        data.fdNumber ?? null,
        data.principal,
        data.interestRate,
        data.startDate,
        data.maturityDate,
        JSON.stringify(meta),
      ]
    );

    // Re-fetch to get joined account_name cleanly
    const result = await this.getOne(row.id, userId);
    logger.info('Fixed deposit created', { fdId: row.id, userId });
    return result;
  }

  async update(
    id: string,
    userId: string,
    data: {
      name?: string;
      fdNumber?: string | null;
      interestRate?: number;
      maturityDate?: string;
      compounding?: Compounding;
      assuredMaturityAmount?: number | null;
      notes?: string | null;
      meta?: Record<string, unknown>;
    }
  ): Promise<FdResponse> {
    const existing = await this.getOne(id, userId);

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.name !== undefined)         { fields.push(`name = $${idx++}`);          values.push(data.name); }
    if (data.fdNumber !== undefined)     { fields.push(`symbol = $${idx++}`);        values.push(data.fdNumber); }
    if (data.interestRate !== undefined) { fields.push(`interest_rate = $${idx++}`); values.push(data.interestRate); }
    if (data.maturityDate !== undefined) { fields.push(`maturity_date = $${idx++}`); values.push(data.maturityDate); }

    // Merge meta so compounding, notes, and assuredMaturityAmount can be updated
    if (data.compounding !== undefined || data.notes !== undefined || data.assuredMaturityAmount !== undefined || data.meta !== undefined) {
      const currentMeta = existing.meta ?? {};
      const mergedMeta: Record<string, unknown> = {
        ...currentMeta,
        ...(data.meta ?? {}),
        ...(data.compounding !== undefined ? { compounding: data.compounding } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      };
      if (data.assuredMaturityAmount !== undefined) {
        if (data.assuredMaturityAmount === null) delete mergedMeta['assuredMaturityAmount'];
        else mergedMeta['assuredMaturityAmount'] = data.assuredMaturityAmount;
      }
      fields.push(`meta = $${idx++}`);
      values.push(JSON.stringify(mergedMeta));
    }

    fields.push('updated_at = NOW()');
    values.push(id, userId);

    await query(
      `UPDATE assets SET ${fields.join(', ')} WHERE id = $${idx++} AND user_id = $${idx}`,
      values
    );

    logger.info('Fixed deposit updated', { fdId: id, userId });
    return this.getOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.getOne(id, userId);
    await query(`DELETE FROM assets WHERE id = $1 AND user_id = $2 AND asset_type = 'fd'`, [id, userId]);
    logger.info('Fixed deposit deleted', { fdId: id, userId });
  }
}
