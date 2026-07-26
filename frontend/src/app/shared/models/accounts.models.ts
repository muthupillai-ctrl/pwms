export type AccountType = 'savings' | 'current' | 'cash' | 'other';

export interface Account {
  id:           string;
  user_id:      string;
  name:         string;
  account_type: AccountType;
  institution:  string | null;
  currency:     string;
  balance:      string;
  is_active:    boolean;
  notes:        string | null;
  meta:         Record<string, unknown>;
  created_at:   string;
  updated_at:   string;
}

export interface CreateAccountPayload {
  name:        string;
  accountType: AccountType;
  institution?: string;
  currency?:   string;
  balance?:    number;
  notes?:      string;
  meta?:       Record<string, unknown>;
}

export interface UpdateAccountPayload {
  name?:        string;
  institution?: string | null;
  currency?:    string;
  balance?:     number;
  notes?:       string | null;
  isActive?:    boolean;
  meta?:        Record<string, unknown>;
}
