import { query, queryOne } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

export interface LoanRow {
  id: string;
  user_id: string;
  name: string;
  institution: string | null;
  currency: string;
  balance: string;
  is_active: boolean;
  notes: string | null;
  meta: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export type Compounding = 'monthly' | 'quarterly' | 'half_yearly' | 'annually';

export const COMPOUNDING_PERIODS: Record<Compounding, number> = {
  monthly:     12,
  quarterly:    4,
  half_yearly:  2,
  annually:     1,
};

export function calcCompoundInterest(
  principal: number,
  ratePercent: number,
  days: number,
  compounding: Compounding,
): number {
  if (days <= 0 || ratePercent <= 0 || principal <= 0) return 0;
  const n = COMPOUNDING_PERIODS[compounding];
  const t = days / 365;
  const interest = principal * (Math.pow(1 + ratePercent / (n * 100), n * t) - 1);
  return Math.round(interest * 10000) / 10000;
}

export interface LoanResponse extends LoanRow {
  borrower_name: string;
  borrower_email: string | null;
  interest_rate: number;
  compounding: Compounding;
  loan_date: string | null;
  due_date: string | null;
  loan_type: string;
  outstanding: number;       // principal balance remaining
  accrued_interest: number;  // compound interest on outstanding principal to today
  total_outstanding: number; // outstanding + accrued_interest (displayed as OUTSTANDING)
  interest_earned: number;   // cumulative interest collected via repayments
  total_due: number;
  days_elapsed: number;
  is_overdue: boolean;
  original_amount: number;
  lender_name?: string;
  lender_email?: string;
}

export interface LoanRepayment {
  id: string;
  loan_id: string;
  user_id: string;
  repayment_type: string;
  repayment_date: string;
  amount_paid: number;
  days: number;
  interest: number;
  principal: number;
  notes: string | null;
  created_at: string;
}

function enrich(row: LoanRow): LoanResponse {
  const meta            = row.meta ?? {};
  const outstanding     = parseFloat(row.balance);
  const interestRate    = parseFloat((meta.interest_rate as string) ?? '0');
  const compounding     = ((meta.compounding as Compounding) ?? 'monthly');
  const loanDate        = (meta.loan_date as string) ?? null;
  const dueDate         = (meta.due_date as string) ?? null;
  const loanType        = (meta.loan_type as string) ?? 'personal';
  const borrower        = (meta.borrower_name as string) ?? row.name;
  const borrowerEmail   = (meta.borrower_email as string) ?? null;
  const original_amount = parseFloat(String(meta.original_amount ?? row.balance));
  const interestEarned  = parseFloat(String(meta.interest_earned ?? '0'));

  const today          = new Date().toISOString().slice(0, 10);
  const startDate      = loanDate ?? today;
  const daysElapsed    = Math.max(0, Math.floor((new Date(today).getTime() - new Date(startDate).getTime()) / 86_400_000));
  const accruedInterest   = calcCompoundInterest(outstanding, interestRate, daysElapsed, compounding);
  const totalOutstanding  = Math.round((outstanding + accruedInterest) * 100) / 100;
  const totalDue          = Math.round((totalOutstanding + interestEarned) * 100) / 100;
  const isOverdue         = dueDate ? new Date(today) > new Date(dueDate) : false;

  return { ...row, borrower_name: borrower, borrower_email: borrowerEmail, interest_rate: interestRate, compounding, loan_date: loanDate, due_date: dueDate, loan_type: loanType, outstanding, accrued_interest: accruedInterest, total_outstanding: totalOutstanding, interest_earned: interestEarned, total_due: totalDue, days_elapsed: daysElapsed, is_overdue: isOverdue, original_amount };
}

const SELECT = `
  SELECT id, user_id, name, institution, currency, balance, is_active, notes, meta, created_at, updated_at
  FROM accounts
  WHERE account_type = 'loan_given'
`;

export class LoansService {
  async list(userId: string): Promise<LoanResponse[]> {
    const rows = await query<LoanRow>(`${SELECT} AND user_id = $1 ORDER BY created_at DESC`, [userId]);
    return rows.map(enrich);
  }

  async getOne(id: string, userId: string): Promise<LoanResponse> {
    const row = await queryOne<LoanRow>(`${SELECT} AND id = $1 AND user_id = $2`, [id, userId]);
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Loan not found');
    return enrich(row);
  }

  async create(userId: string, data: {
    borrowerName: string; borrowerEmail?: string; amount: number; interestRate: number;
    compounding?: Compounding;
    loanDate: string; dueDate?: string; loanType: string;
    currency: string; notes?: string;
  }): Promise<LoanResponse> {
    const meta = {
      borrower_name:   data.borrowerName,
      interest_rate:   data.interestRate,
      compounding:     data.compounding ?? 'monthly',
      loan_date:       data.loanDate,
      loan_type:       data.loanType,
      original_amount: data.amount,
      interest_earned: 0,
      ...(data.dueDate       ? { due_date:       data.dueDate }       : {}),
      ...(data.notes         ? { notes:           data.notes }         : {}),
      ...(data.borrowerEmail ? { borrower_email:  data.borrowerEmail } : {}),
    };

    const [row] = await query<{ id: string }>(
      `INSERT INTO accounts (user_id, name, account_type, currency, balance, notes, meta)
       VALUES ($1, $2, 'loan_given', $3, $4, $5, $6)
       RETURNING id`,
      [userId, data.borrowerName, data.currency, data.amount, data.notes ?? null, JSON.stringify(meta)]
    );
    logger.info('Loan created', { loanId: row.id, userId });
    return this.getOne(row.id, userId);
  }

  async update(id: string, userId: string, data: {
    borrowerName?: string; borrowerEmail?: string | null; interestRate?: number; compounding?: Compounding;
    dueDate?: string | null; loanType?: string; notes?: string | null; isActive?: boolean;
  }): Promise<LoanResponse> {
    const existing = await this.getOne(id, userId);
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.borrowerName !== undefined) { fields.push(`name = $${idx++}`);      values.push(data.borrowerName); }
    if (data.isActive !== undefined)     { fields.push(`is_active = $${idx++}`); values.push(data.isActive); }

    const metaUpdate: Record<string, unknown> = { ...existing.meta };
    if (data.borrowerName  !== undefined) metaUpdate.borrower_name  = data.borrowerName;
    if (data.borrowerEmail !== undefined) metaUpdate.borrower_email = data.borrowerEmail;
    if (data.interestRate  !== undefined) metaUpdate.interest_rate  = data.interestRate;
    if (data.compounding   !== undefined) metaUpdate.compounding    = data.compounding;
    if (data.dueDate       !== undefined) metaUpdate.due_date       = data.dueDate;
    if (data.loanType      !== undefined) metaUpdate.loan_type      = data.loanType;
    if (data.notes         !== undefined) metaUpdate.notes          = data.notes;

    fields.push(`meta = $${idx++}`, 'updated_at = NOW()');
    values.push(JSON.stringify(metaUpdate), id, userId);

    await query(
      `UPDATE accounts SET ${fields.join(', ')} WHERE id = $${idx++} AND user_id = $${idx} AND account_type = 'loan_given'`,
      values
    );

    // Propagate borrower_email to all other loans for the same borrower
    if (data.borrowerEmail !== undefined) {
      const borrowerName = data.borrowerName ?? existing.borrower_name;
      await query(
        `UPDATE accounts
         SET meta = meta || jsonb_build_object('borrower_email', $1::text), updated_at = NOW()
         WHERE account_type = 'loan_given'
           AND user_id = $2
           AND id != $3
           AND (meta->>'borrower_name') = $4`,
        [data.borrowerEmail, userId, id, borrowerName]
      );
    }

    logger.info('Loan updated', { loanId: id, userId });
    return this.getOne(id, userId);
  }

  async recordRepayment(id: string, userId: string, amount: number, notes?: string): Promise<LoanResponse> {
    const loan = await this.getOne(id, userId);
    const newBalance = Math.max(0, loan.outstanding - amount);

    const metaUpdate = { ...loan.meta };
    if (notes) metaUpdate.last_repayment_note = notes;
    metaUpdate.last_repayment_date = new Date().toISOString().slice(0, 10);

    await query(
      `UPDATE accounts SET balance = $1, meta = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4`,
      [newBalance, JSON.stringify(metaUpdate), id, userId]
    );
    logger.info('Loan repayment recorded', { loanId: id, userId, amount, newBalance });
    return this.getOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.getOne(id, userId);
    await query(`DELETE FROM accounts WHERE id = $1 AND user_id = $2 AND account_type = 'loan_given'`, [id, userId]);
    logger.info('Loan deleted', { loanId: id, userId });
  }

  // ── Loan-user read paths (no user_id ownership check) ────
  async listByEmail(email: string): Promise<LoanResponse[]> {
    const rows = await query<LoanRow & { lender_full_name: string; lender_email_col: string }>(
      `SELECT a.id, a.user_id, a.name, a.institution, a.currency, a.balance,
              a.is_active, a.notes, a.meta, a.created_at, a.updated_at,
              u.full_name AS lender_full_name, u.email AS lender_email_col
       FROM accounts a
       JOIN users u ON u.id = a.user_id
       WHERE a.account_type = 'loan_given'
         AND a.meta->>'borrower_email' = $1
       ORDER BY a.created_at DESC`,
      [email.toLowerCase()]
    );
    return rows.map(r => {
      const enriched = enrich(r);
      enriched.lender_name  = r.lender_full_name;
      enriched.lender_email = r.lender_email_col;
      return enriched;
    });
  }

  async listRepaymentsByEmail(loanId: string, email: string): Promise<LoanRepayment[]> {
    const rows = await query<any>(
      `SELECT lr.id, lr.loan_id, lr.user_id, lr.repayment_type, lr.repayment_date,
              lr.amount_paid, lr.days, lr.interest, lr.principal, lr.notes, lr.created_at
       FROM loan_repayments lr
       JOIN accounts a ON a.id = lr.loan_id
       WHERE lr.loan_id = $1
         AND a.account_type = 'loan_given'
         AND a.meta->>'borrower_email' = $2
       ORDER BY lr.repayment_date ASC`,
      [loanId, email.toLowerCase()]
    );
    return rows.map((r: any) => ({
      ...r,
      amount_paid: parseFloat(r.amount_paid),
      interest:    parseFloat(r.interest),
      principal:   parseFloat(r.principal),
    }));
  }

  async listRepayments(loanId: string, userId: string): Promise<LoanRepayment[]> {
    // Verify loan belongs to user
    await this.getOne(loanId, userId);
    const rows = await query<any>(
      `SELECT id, loan_id, user_id, repayment_type, repayment_date, amount_paid, days, interest, principal, notes, created_at
       FROM loan_repayments WHERE loan_id = $1 AND user_id = $2 ORDER BY repayment_date ASC`,
      [loanId, userId]
    );
    return rows.map((r: any) => ({
      ...r,
      amount_paid: parseFloat(r.amount_paid),
      interest:    parseFloat(r.interest),
      principal:   parseFloat(r.principal),
    }));
  }

  async addRepayment(loanId: string, userId: string, data: {
    repaymentDate: string;
    amountPaid: number;
    notes?: string;
  }): Promise<LoanRepayment> {
    const loan = await this.getOne(loanId, userId);

    const loanDate = loan.loan_date ?? data.repaymentDate;
    const days = Math.max(0, Math.floor(
      (new Date(data.repaymentDate).getTime() - new Date(loanDate).getTime()) / 86_400_000
    ));

    // Compound interest: P × [(1 + r/n)^(n×t) − 1]
    const interest  = calcCompoundInterest(data.amountPaid, loan.interest_rate, days, loan.compounding);
    const principal = Math.round((data.amountPaid - interest) * 10000) / 10000;

    const [repayment] = await query<any>(
      `INSERT INTO loan_repayments (loan_id, user_id, repayment_type, repayment_date, amount_paid, days, interest, principal, notes)
       VALUES ($1, $2, 'flexible', $3, $4, $5, $6, $7, $8)
       RETURNING id, loan_id, user_id, repayment_type, repayment_date, amount_paid, days, interest, principal, notes, created_at`,
      [loanId, userId, data.repaymentDate, data.amountPaid, days, interest, principal, data.notes ?? null]
    );

    const newBalance        = Math.max(0, Math.round((loan.outstanding - principal) * 100) / 100);
    const newInterestEarned = Math.round(((loan.interest_earned || 0) + interest) * 10000) / 10000;
    const metaUpdate = { ...loan.meta, interest_earned: newInterestEarned };

    await query(
      `UPDATE accounts SET balance = $1, meta = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4`,
      [newBalance, JSON.stringify(metaUpdate), loanId, userId]
    );

    logger.info('Loan repayment added', { loanId, userId, days, interest, principal });
    return { ...repayment, amount_paid: parseFloat(repayment.amount_paid), interest: parseFloat(repayment.interest), principal: parseFloat(repayment.principal) };
  }

  async deleteRepayment(repaymentId: string, userId: string): Promise<void> {
    const rows = await query<any>(
      `DELETE FROM loan_repayments WHERE id = $1 AND user_id = $2
       RETURNING loan_id, principal, interest`,
      [repaymentId, userId]
    );
    if (rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Repayment not found');

    const { loan_id, principal, interest } = rows[0];
    const principalNum = parseFloat(principal);
    const interestNum  = parseFloat(interest);

    const loan = await this.getOne(loan_id, userId);
    const restoredBalance  = Math.round((loan.outstanding + principalNum) * 100) / 100;
    const restoredInterest = Math.max(0, Math.round(((loan.interest_earned || 0) - interestNum) * 10000) / 10000);
    const metaUpdate = { ...loan.meta, interest_earned: restoredInterest };

    await query(
      `UPDATE accounts SET balance = $1, meta = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4`,
      [restoredBalance, JSON.stringify(metaUpdate), loan_id, userId]
    );
    logger.info('Loan repayment deleted', { repaymentId, userId });
  }
}
