import { query, queryOne } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

export interface ManualIncomeRow {
  id: string;
  user_id: string;
  income_date: string;
  amount: string;
  notes: string | null;
  frequency: string;
  end_date: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ManualIncomeResponse {
  id: string;
  user_id: string;
  income_date: string;
  amount: number;
  notes: string | null;
  frequency: string;
  end_date: string | null;
  created_at: Date;
  updated_at: Date;
}

function enrich(row: ManualIncomeRow): ManualIncomeResponse {
  return { ...row, amount: parseFloat(row.amount) };
}

const SELECT = `SELECT id, user_id, income_date::text, amount, notes, frequency, end_date::text, created_at, updated_at
  FROM manual_income_entries`;

export class ManualIncomeService {
  async list(userId: string): Promise<ManualIncomeResponse[]> {
    const rows = await query<ManualIncomeRow>(
      `${SELECT} WHERE user_id = $1 ORDER BY income_date ASC`, [userId]
    );
    return rows.map(enrich);
  }

  async create(userId: string, data: {
    incomeDate: string; amount: number; notes?: string | null;
    frequency?: string; endDate?: string | null;
  }): Promise<ManualIncomeResponse> {
    const [row] = await query<ManualIncomeRow>(
      `INSERT INTO manual_income_entries (user_id, income_date, amount, notes, frequency, end_date)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, user_id, income_date::text, amount, notes, frequency, end_date::text, created_at, updated_at`,
      [userId, data.incomeDate, data.amount, data.notes ?? null,
       data.frequency ?? 'once', data.endDate ?? null]
    );
    logger.info('Manual income entry created', { entryId: row.id, userId });
    return enrich(row);
  }

  async remove(id: string, userId: string): Promise<void> {
    const existing = await queryOne<ManualIncomeRow>(
      `${SELECT} WHERE id = $1 AND user_id = $2`, [id, userId]
    );
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Manual income entry not found');
    await query(`DELETE FROM manual_income_entries WHERE id = $1 AND user_id = $2`, [id, userId]);
    logger.info('Manual income entry deleted', { entryId: id, userId });
  }
}
