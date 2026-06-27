export interface BreakdownEntry {
  balance: number;
  count: number;
}

export interface FdBreakdownEntry extends BreakdownEntry {
  maturityValue: number;
  interestEarned: number;
}

export interface PortfolioBreakdown {
  bank:          BreakdownEntry;
  fixed_deposit: FdBreakdownEntry;
  stocks:        BreakdownEntry;
  mutual_fund:   BreakdownEntry;
  bond:          BreakdownEntry;
  loan_given:    BreakdownEntry;
  sip:           BreakdownEntry;
  cash:          BreakdownEntry;
  liability:     BreakdownEntry;
  other:         BreakdownEntry;
}

export interface PortfolioSummary {
  netWorth:         number;
  totalAssets:      number;
  totalLiabilities: number;
  breakdown:        PortfolioBreakdown;
  asOf:             string;
}

export const ASSET_TYPE_LABELS: Record<string, string> = {
  bank:          'Bank / Cash',
  fixed_deposit: 'Fixed Deposits',
  stocks:        'Stocks',
  mutual_fund:   'Mutual Funds',
  bond:          'Bonds',
  loan_given:    'Loans Given',
  sip:           'SIP Investments',
  cash:          'Cash',
  liability:     'Liabilities',
  other:         'Other',
};

export const ASSET_TYPE_COLORS: Record<string, string> = {
  bank:          '#3B82F6',
  fixed_deposit: '#8B5CF6',
  stocks:        '#10B981',
  mutual_fund:   '#06B6D4',
  bond:          '#F59E0B',
  loan_given:    '#22C55E',
  sip:           '#A855F7',
  cash:          '#6B7280',
  liability:     '#EF4444',
  other:         '#9CA3AF',
};
