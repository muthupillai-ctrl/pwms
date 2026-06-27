import { query } from '../../config/db';
import { calcCompoundInterest, Compounding as LoanCompounding } from '../loans/loans.service';

type AccountType =
  | 'bank' | 'fixed_deposit' | 'stocks' | 'mutual_fund'
  | 'bond' | 'loan_given' | 'liability' | 'cash' | 'other';

type FdCompounding = 'simple' | 'monthly' | 'quarterly' | 'half_yearly' | 'annual';

interface AccountSummaryRow {
  account_type: AccountType;
  total_balance: string;
  count: string;
}

interface FdAssetRow {
  units: string;
  interest_rate: string | null;
  purchase_date: string | null;
  maturity_date: string | null;
  meta: Record<string, unknown>;
}

interface LoanRow {
  balance: string;
  meta: Record<string, unknown>;
  created_at: Date;
}

interface MfFundRow {
  latest_nav:  string;
  total_units: string;  // computed from mf_transactions
}

interface SipRow {
  current_value: string;
}

const FD_COMPOUNDING_PERIODS: Record<FdCompounding, number> = {
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
  compounding: FdCompounding
): number {
  const tenureDays = Math.max(
    0,
    Math.floor((new Date(maturityDate).getTime() - new Date(startDate).getTime()) / 86_400_000)
  );
  const years = tenureDays / 365;
  const rate  = ratePercent / 100;

  if (compounding === 'simple') {
    return Math.round(principal * (1 + rate * years) * 100) / 100;
  }
  const n = FD_COMPOUNDING_PERIODS[compounding];
  return Math.round(principal * Math.pow(1 + rate / n, n * years) * 100) / 100;
}

export interface BreakdownEntry {
  balance: number;
  count: number;
}

export interface FdBreakdownEntry extends BreakdownEntry {
  maturityValue: number;
  interestEarned: number;
}

export interface PortfolioSummary {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  breakdown: {
    bank:           BreakdownEntry;
    fixed_deposit:  FdBreakdownEntry;
    stocks:         BreakdownEntry;
    mutual_fund:    BreakdownEntry;
    bond:           BreakdownEntry;
    loan_given:     BreakdownEntry;
    sip:            BreakdownEntry;
    cash:           BreakdownEntry;
    liability:      BreakdownEntry;
    other:          BreakdownEntry;
  };
  asOf: string;
}

const EMPTY: BreakdownEntry = { balance: 0, count: 0 };
const EMPTY_FD: FdBreakdownEntry = { balance: 0, count: 0, maturityValue: 0, interestEarned: 0 };

export class PortfolioService {
  async getSummary(userId: string): Promise<PortfolioSummary> {
    // Run all queries in parallel
    const [accountRows, fdAssets, loanRows, mfFunds, sipRows] = await Promise.all([
      // Bank accounts only (savings/current/cash/other) — other modules own their own tables
      query<AccountSummaryRow>(
        `SELECT 'bank' AS account_type, COALESCE(SUM(balance), 0) AS total_balance, COUNT(*)::text AS count
         FROM accounts
         WHERE user_id = $1 AND is_active = TRUE
           AND account_type IN ('savings', 'current', 'cash', 'other', 'bank')`,
        [userId]
      ),
      // FD maturity values from assets table
      query<FdAssetRow>(
        `SELECT units, interest_rate, purchase_date, maturity_date, meta
         FROM assets WHERE user_id = $1 AND asset_type = 'fd'`,
        [userId]
      ),
      // Loan rows — compute outstanding (balance + accrued compound interest) per loan
      query<LoanRow>(
        `SELECT balance, meta, created_at
         FROM accounts
         WHERE user_id = $1 AND is_active = TRUE AND account_type = 'loan_given'`,
        [userId]
      ),
      // MF current value = units × latest_nav, where units are computed from transactions
      query<MfFundRow>(
        `SELECT f.latest_nav,
                COALESCE(SUM(CASE WHEN t.type = 'purchase'   THEN t.units
                                  WHEN t.type = 'redemption' THEN -t.units
                                  ELSE 0 END), 0) AS total_units
         FROM mf_funds f
         LEFT JOIN mf_transactions t ON t.fund_id = f.id
         WHERE f.user_id = $1
         GROUP BY f.id, f.latest_nav`,
        [userId]
      ),
      // SIP current values (nav × units, stored by sip service)
      query<SipRow>(
        `SELECT current_value FROM sip_investments WHERE user_id = $1`,
        [userId]
      ),
    ]);

    // Build breakdown map
    const breakdown: PortfolioSummary['breakdown'] = {
      bank:          { ...EMPTY },
      fixed_deposit: { ...EMPTY_FD },
      stocks:        { ...EMPTY },
      mutual_fund:   { ...EMPTY },
      bond:          { ...EMPTY },
      loan_given:    { ...EMPTY },
      sip:           { ...EMPTY },
      cash:          { ...EMPTY },
      liability:     { ...EMPTY },
      other:         { ...EMPTY },
    };

    for (const row of accountRows) {
      const type = row.account_type;
      if (type in breakdown) {
        breakdown[type].balance = Math.round(parseFloat(row.total_balance) * 100) / 100;
        breakdown[type].count   = parseInt(row.count, 10);
      }
    }

    // Loans: sum balance + accrued compound interest across all loan accounts
    const today = new Date();
    let loanOutstanding = 0;
    for (const loan of loanRows) {
      const principal   = parseFloat(loan.balance);
      const rate        = parseFloat((loan.meta?.interest_rate as string) ?? '0');
      const compounding = ((loan.meta?.compounding as LoanCompounding) ?? 'monthly');
      const loanDate    = (loan.meta?.loan_date as string) ?? loan.created_at.toISOString().slice(0, 10);
      const daysElapsed = Math.max(0, Math.floor((today.getTime() - new Date(loanDate).getTime()) / 86_400_000));
      const accrued     = calcCompoundInterest(principal, rate, daysElapsed, compounding);
      loanOutstanding  += principal + accrued;
    }
    breakdown.loan_given.balance = Math.round(loanOutstanding * 100) / 100;
    breakdown.loan_given.count   = loanRows.length;

    // MF: current value from mf_funds (not raw account balance)
    let mfValue = 0;
    for (const f of mfFunds) mfValue += parseFloat(f.latest_nav) * parseFloat(f.total_units);
    breakdown.mutual_fund.balance = Math.round(mfValue * 100) / 100;
    breakdown.mutual_fund.count   = mfFunds.length;

    // SIP: own breakdown slot so it shows separately in the dashboard
    let sipValue = 0;
    for (const s of sipRows) sipValue += parseFloat(s.current_value);
    breakdown.sip.balance = Math.round(sipValue * 100) / 100;
    breakdown.sip.count   = sipRows.length;

    // FD: principal + maturity value — both come from assets table (not accounts)
    let fdPrincipal  = 0;
    let totalMaturity = 0;
    for (const fd of fdAssets) {
      const principal   = parseFloat(fd.units);
      const rate        = parseFloat(fd.interest_rate ?? '0');
      const compounding = ((fd.meta?.compounding as FdCompounding) ?? 'quarterly');
      const start       = fd.purchase_date ?? new Date().toISOString().slice(0, 10);
      const maturity    = fd.maturity_date ?? start;
      fdPrincipal  += principal;
      totalMaturity += calcMaturityAmount(principal, rate, start, maturity, compounding);
    }
    fdPrincipal   = Math.round(fdPrincipal  * 100) / 100;
    totalMaturity = Math.round(totalMaturity * 100) / 100;
    breakdown.fixed_deposit = {
      balance:        fdPrincipal,
      count:          fdAssets.length,
      maturityValue:  totalMaturity,
      interestEarned: Math.round((totalMaturity - fdPrincipal) * 100) / 100,
    };

    // Net worth
    const LIABILITY_TYPES = ['liability'] as const;
    const ASSET_TYPES     = ['bank', 'fixed_deposit', 'stocks', 'mutual_fund', 'bond', 'loan_given', 'sip', 'cash', 'other'] as const;

    const totalAssets      = ASSET_TYPES.reduce((sum, t) => sum + breakdown[t].balance, 0);
    const totalLiabilities = LIABILITY_TYPES.reduce((sum, t) => sum + breakdown[t].balance, 0);
    const netWorth         = Math.round((totalAssets - totalLiabilities) * 100) / 100;

    return {
      netWorth,
      totalAssets:      Math.round(totalAssets * 100) / 100,
      totalLiabilities: Math.round(totalLiabilities * 100) / 100,
      breakdown,
      asOf: new Date().toISOString(),
    };
  }
}
