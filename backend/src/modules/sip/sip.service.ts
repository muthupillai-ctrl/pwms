import { query, queryOne } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

export interface SipRow {
  id: string;
  user_id: string;
  fund_name: string;
  scheme_code: string | null;
  date_from: string | null;
  current_nav: string;
  units: string;
  invested_amount: string;
  current_value: string;
  monthly_sip_amount: string | null;
  fund_link: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SipResponse {
  id: string;
  user_id: string;
  fund_name: string;
  scheme_code: string | null;
  date_from: string | null;
  current_nav: number;
  units: number;
  invested_amount: number;
  current_value: number;
  monthly_sip_amount: number | null;
  fund_link: string | null;
  pnl: number;
  pnl_pct: number;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

function enrich(row: SipRow): SipResponse {
  const nav      = parseFloat(row.current_nav);
  const units    = parseFloat(row.units);
  const invested = parseFloat(row.invested_amount);
  const current  = Math.round(nav * units * 100) / 100;
  const pnl      = Math.round((current - invested) * 100) / 100;
  const pnl_pct  = invested > 0 ? Math.round((pnl / invested) * 10000) / 100 : 0;
  return {
    id:                 row.id,
    user_id:            row.user_id,
    fund_name:          row.fund_name,
    scheme_code:        row.scheme_code,
    date_from:          row.date_from,
    current_nav:        nav,
    units,
    invested_amount:    invested,
    current_value:      current,
    monthly_sip_amount: row.monthly_sip_amount ? parseFloat(row.monthly_sip_amount) : null,
    fund_link:          row.fund_link,
    pnl,
    pnl_pct,
    notes:              row.notes,
    created_at:         row.created_at,
    updated_at:         row.updated_at,
  };
}

const SELECT = `SELECT id, user_id, fund_name, scheme_code, date_from, current_nav, units,
  invested_amount, current_value, monthly_sip_amount, fund_link, notes, created_at, updated_at
  FROM sip_investments`;

export class SipService {
  async list(userId: string): Promise<SipResponse[]> {
    const rows = await query<SipRow>(`${SELECT} WHERE user_id = $1 ORDER BY fund_name ASC`, [userId]);
    return rows.map(enrich);
  }

  async getOne(id: string, userId: string): Promise<SipResponse> {
    const row = await queryOne<SipRow>(`${SELECT} WHERE id = $1 AND user_id = $2`, [id, userId]);
    if (!row) throw new AppError(404, 'NOT_FOUND', 'SIP not found');
    return enrich(row);
  }

  async create(userId: string, data: {
    fundName: string; schemeCode?: string | null; dateFrom?: string | null;
    currentNav: number; units: number; investedAmount: number;
    monthlySipAmount?: number | null; fundLink?: string | null; notes?: string | null;
  }): Promise<SipResponse> {
    const currentValue = Math.round(data.currentNav * data.units * 100) / 100;
    const [row] = await query<SipRow>(
      `INSERT INTO sip_investments
         (user_id, fund_name, scheme_code, date_from, current_nav, units, invested_amount,
          current_value, monthly_sip_amount, fund_link, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [userId, data.fundName, data.schemeCode ?? null, data.dateFrom ?? null,
       data.currentNav, data.units, data.investedAmount, currentValue,
       data.monthlySipAmount ?? null, data.fundLink ?? null, data.notes ?? null]
    );
    logger.info('SIP created', { sipId: row.id, userId });
    return enrich(row);
  }

  async update(id: string, userId: string, data: {
    fundName?: string; schemeCode?: string | null; dateFrom?: string | null;
    currentNav?: number; units?: number; investedAmount?: number;
    monthlySipAmount?: number | null; fundLink?: string | null; notes?: string | null;
  }): Promise<SipResponse> {
    const existing = await this.getOne(id, userId);
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.fundName         !== undefined) { fields.push(`fund_name = $${idx++}`);          values.push(data.fundName); }
    if (data.schemeCode       !== undefined) { fields.push(`scheme_code = $${idx++}`);         values.push(data.schemeCode); }
    if (data.dateFrom         !== undefined) { fields.push(`date_from = $${idx++}`);           values.push(data.dateFrom); }
    if (data.currentNav       !== undefined) { fields.push(`current_nav = $${idx++}`);         values.push(data.currentNav); }
    if (data.units            !== undefined) { fields.push(`units = $${idx++}`);               values.push(data.units); }
    if (data.investedAmount   !== undefined) { fields.push(`invested_amount = $${idx++}`);    values.push(data.investedAmount); }
    if (data.monthlySipAmount !== undefined) { fields.push(`monthly_sip_amount = $${idx++}`);  values.push(data.monthlySipAmount); }
    if (data.fundLink         !== undefined) { fields.push(`fund_link = $${idx++}`);           values.push(data.fundLink); }
    if (data.notes            !== undefined) { fields.push(`notes = $${idx++}`);               values.push(data.notes); }

    // Recompute current_value whenever nav or units change
    const nav   = data.currentNav   ?? existing.current_nav;
    const units = data.units        ?? existing.units;
    const currentValue = Math.round(nav * units * 100) / 100;
    fields.push(`current_value = $${idx++}`);
    values.push(currentValue);

    fields.push('updated_at = NOW()');
    values.push(id, userId);

    await query(
      `UPDATE sip_investments SET ${fields.join(', ')} WHERE id = $${idx++} AND user_id = $${idx}`,
      values
    );
    logger.info('SIP updated', { sipId: id, userId });
    return this.getOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.getOne(id, userId);
    await query(`DELETE FROM sip_investments WHERE id = $1 AND user_id = $2`, [id, userId]);
    logger.info('SIP deleted', { sipId: id, userId });
  }
}
