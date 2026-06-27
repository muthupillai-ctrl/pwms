import { query, queryOne } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { getOrCreatePortfolioAccount } from '../../utils/portfolioAccount';

export interface StockRow {
  id: string;
  account_id: string;
  user_id: string;
  name: string;
  symbol: string | null;
  units: string;
  purchase_price: string | null;
  current_price: string | null;
  price_as_of: Date | null;
  purchase_date: string | null;
  meta: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  account_name: string;
}

export interface StockResponse extends StockRow {
  shares: number;
  buy_price: number;
  invested_value: number;
  current_value: number;
  gain_loss: number;
  gain_loss_pct: number;
}

function enrich(row: StockRow): StockResponse {
  const shares        = parseFloat(row.units);
  const buyPrice      = parseFloat(row.purchase_price ?? '0');
  const currPrice     = row.current_price ? parseFloat(row.current_price) : null;
  const investedValue = Math.round(shares * buyPrice * 100) / 100;
  const currentValue  = currPrice != null ? Math.round(shares * currPrice * 100) / 100 : investedValue;
  const gainLoss      = Math.round((currentValue - investedValue) * 100) / 100;
  const gainLossPct   = investedValue > 0 ? Math.round((gainLoss / investedValue) * 10000) / 100 : 0;
  return { ...row, shares, buy_price: buyPrice, invested_value: investedValue, current_value: currentValue, gain_loss: gainLoss, gain_loss_pct: gainLossPct };
}

const SELECT = `
  SELECT a.id, a.account_id, a.user_id, a.name, a.symbol,
         a.units, a.purchase_price, a.current_price, a.price_as_of,
         a.purchase_date, a.meta, a.created_at, a.updated_at,
         acc.name AS account_name
  FROM assets a
  JOIN accounts acc ON acc.id = a.account_id
  WHERE a.asset_type = 'stock'
`;

export class StocksService {
  async list(userId: string): Promise<StockResponse[]> {
    const rows = await query<StockRow>(`${SELECT} AND a.user_id = $1 ORDER BY a.created_at DESC`, [userId]);
    return rows.map(enrich);
  }

  async getOne(id: string, userId: string): Promise<StockResponse> {
    const row = await queryOne<StockRow>(`${SELECT} AND a.id = $1 AND a.user_id = $2`, [id, userId]);
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Stock not found');
    return enrich(row);
  }

  async create(userId: string, data: {
    accountId?: string; symbol: string; name: string; units: number;
    purchasePrice: number; purchaseDate?: string; currentPrice?: number;
    notes?: string; meta: Record<string, unknown>;
  }): Promise<StockResponse> {
    const accountId = data.accountId ??
      await getOrCreatePortfolioAccount(userId, 'stocks', 'Stocks Portfolio');

    const meta = { ...data.meta, ...(data.notes ? { notes: data.notes } : {}) };

    const [row] = await query<{ id: string }>(
      `INSERT INTO assets (account_id, user_id, asset_type, symbol, name, units, purchase_price, purchase_date, current_price, price_as_of, meta)
       VALUES ($1,$2,'stock',$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [accountId, userId, data.symbol, data.name, data.units, data.purchasePrice,
       data.purchaseDate ?? null, data.currentPrice ?? null,
       data.currentPrice ? new Date() : null, JSON.stringify(meta)]
    );
    logger.info('Stock created', { stockId: row.id, userId });
    return this.getOne(row.id, userId);
  }

  async update(id: string, userId: string, data: { name?: string; notes?: string | null; meta?: Record<string, unknown> }): Promise<StockResponse> {
    const existing = await this.getOne(id, userId);
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }

    if (data.notes !== undefined || data.meta !== undefined) {
      const mergedMeta = { ...existing.meta, ...(data.meta ?? {}), ...(data.notes !== undefined ? { notes: data.notes } : {}) };
      fields.push(`meta = $${idx++}`);
      values.push(JSON.stringify(mergedMeta));
    }

    fields.push('updated_at = NOW()');
    values.push(id, userId);
    await query(`UPDATE assets SET ${fields.join(', ')} WHERE id = $${idx++} AND user_id = $${idx} AND asset_type = 'stock'`, values);
    logger.info('Stock updated', { stockId: id, userId });
    return this.getOne(id, userId);
  }

  async updatePrice(id: string, userId: string, currentPrice: number, name?: string): Promise<StockResponse> {
    await this.getOne(id, userId);
    if (name) {
      await query(
        `UPDATE assets SET current_price = $1, price_as_of = NOW(), name = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4 AND asset_type = 'stock'`,
        [currentPrice, name, id, userId]
      );
    } else {
      await query(
        `UPDATE assets SET current_price = $1, price_as_of = NOW(), updated_at = NOW() WHERE id = $2 AND user_id = $3 AND asset_type = 'stock'`,
        [currentPrice, id, userId]
      );
    }
    logger.info('Stock price updated', { stockId: id, userId, currentPrice, name });
    return this.getOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.getOne(id, userId);
    await query(`DELETE FROM assets WHERE id = $1 AND user_id = $2 AND asset_type = 'stock'`, [id, userId]);
    logger.info('Stock deleted', { stockId: id, userId });
  }
}
