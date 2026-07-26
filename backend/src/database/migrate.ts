/**
 * PWMS Custom Migration Runner
 * Run: tsx src/database/migrate.ts
 * Rollback: tsx src/database/migrate.ts rollback
 */
import { pool, query } from '../config/db';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs';

const MIGRATIONS_TABLE = 'schema_migrations';

async function ensureMigrationsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getApplied(): Promise<Set<string>> {
  const rows = await query<{ name: string }>(`SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY id`);
  return new Set(rows.map((r) => r.name));
}

interface Migration {
  name: string;
  up: string;
  down: string;
}

// All migrations defined inline — no file scanning needed
const migrations: Migration[] = [
  {
    name: '001_create_users',
    up: `
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE TABLE users (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email         VARCHAR(255) NOT NULL UNIQUE,
        full_name     VARCHAR(255) NOT NULL,
        phone         VARCHAR(20),
        password_hash TEXT NOT NULL,
        mfa_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
        mfa_secret    TEXT,
        currency      CHAR(3) NOT NULL DEFAULT 'INR',
        is_active     BOOLEAN NOT NULL DEFAULT TRUE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX idx_users_email ON users(email);
      CREATE INDEX idx_users_created_at ON users(created_at);
    `,
    down: `DROP TABLE IF EXISTS users;`,
  },
  {
    name: '002_create_accounts',
    up: `
      CREATE TYPE account_type AS ENUM (
        'bank', 'fixed_deposit', 'stocks', 'mutual_fund',
        'bond', 'loan_given', 'liability', 'cash', 'other'
      );

      CREATE TABLE accounts (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name         VARCHAR(255) NOT NULL,
        account_type account_type NOT NULL,
        institution  VARCHAR(255),
        currency     CHAR(3) NOT NULL DEFAULT 'INR',
        balance      NUMERIC(15, 2) NOT NULL DEFAULT 0,
        is_active    BOOLEAN NOT NULL DEFAULT TRUE,
        notes        TEXT,
        meta         JSONB NOT NULL DEFAULT '{}',
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX idx_accounts_user_id ON accounts(user_id);
      CREATE INDEX idx_accounts_type    ON accounts(account_type);
    `,
    down: `
      DROP TABLE IF EXISTS accounts;
      DROP TYPE IF EXISTS account_type;
    `,
  },
  {
    name: '003_create_transactions',
    up: `
      CREATE TYPE transaction_type AS ENUM ('credit', 'debit', 'transfer');

      CREATE TABLE categories (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id    UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL = system category
        name       VARCHAR(100) NOT NULL,
        icon       VARCHAR(50),
        color      CHAR(7),
        parent_id  UUID REFERENCES categories(id),
        is_system  BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE transactions (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount          NUMERIC(15, 2) NOT NULL,
        type            transaction_type NOT NULL,
        category_id     UUID REFERENCES categories(id),
        description     TEXT,
        reference       VARCHAR(255),
        transaction_date DATE NOT NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX idx_transactions_account_id ON transactions(account_id);
      CREATE INDEX idx_transactions_user_id    ON transactions(user_id);
      CREATE INDEX idx_transactions_date       ON transactions(transaction_date);
      CREATE INDEX idx_transactions_type       ON transactions(type);
    `,
    down: `
      DROP TABLE IF EXISTS transactions;
      DROP TABLE IF EXISTS categories;
      DROP TYPE IF EXISTS transaction_type;
    `,
  },
  {
    name: '004_create_assets',
    up: `
      CREATE TYPE asset_type AS ENUM ('stock', 'mutual_fund', 'bond', 'fd', 'other');

      CREATE TABLE assets (
        id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        account_id     UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        asset_type     asset_type NOT NULL,
        symbol         VARCHAR(50),
        name           VARCHAR(255) NOT NULL,
        units          NUMERIC(18, 6) NOT NULL DEFAULT 0,
        purchase_price NUMERIC(15, 4),
        purchase_date  DATE,
        maturity_date  DATE,
        interest_rate  NUMERIC(6, 4),
        current_price  NUMERIC(15, 4),
        price_as_of    TIMESTAMPTZ,
        meta           JSONB NOT NULL DEFAULT '{}',
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX idx_assets_user_id    ON assets(user_id);
      CREATE INDEX idx_assets_account_id ON assets(account_id);
      CREATE INDEX idx_assets_symbol     ON assets(symbol);
      CREATE INDEX idx_assets_type       ON assets(asset_type);
    `,
    down: `
      DROP TABLE IF EXISTS assets;
      DROP TYPE IF EXISTS asset_type;
    `,
  },
  {
    name: '005_create_goals',
    up: `
      CREATE TABLE goals (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name            VARCHAR(255) NOT NULL,
        target_amount   NUMERIC(15, 2) NOT NULL,
        current_amount  NUMERIC(15, 2) NOT NULL DEFAULT 0,
        target_date     DATE NOT NULL,
        description     TEXT,
        icon            VARCHAR(50),
        is_achieved     BOOLEAN NOT NULL DEFAULT FALSE,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX idx_goals_user_id ON goals(user_id);
    `,
    down: `DROP TABLE IF EXISTS goals;`,
  },
  {
    name: '006_create_audit_logs',
    up: `
      CREATE TABLE audit_logs (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
        action      VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100),
        entity_id   UUID,
        ip_address  INET,
        user_agent  TEXT,
        meta        JSONB NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX idx_audit_user_id    ON audit_logs(user_id);
      CREATE INDEX idx_audit_action     ON audit_logs(action);
      CREATE INDEX idx_audit_created_at ON audit_logs(created_at);
    `,
    down: `DROP TABLE IF EXISTS audit_logs;`,
  },
  {
    name: '008_add_savings_current_account_types',
    up: `
      ALTER TYPE account_type ADD VALUE IF NOT EXISTS 'savings';
      ALTER TYPE account_type ADD VALUE IF NOT EXISTS 'current';
    `,
    down: `
      -- Postgres does not support removing enum values; this migration cannot be reversed.
    `,
  },
  {
    name: '009_create_mf_tables',
    up: `
      CREATE TABLE mf_funds (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name        VARCHAR(255) NOT NULL,
        scheme_code VARCHAR(50),
        latest_nav  NUMERIC(15,4) NOT NULL DEFAULT 0,
        notes       TEXT,
        meta        JSONB NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE mf_transactions (
        id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        fund_id  UUID NOT NULL REFERENCES mf_funds(id) ON DELETE CASCADE,
        user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        units    NUMERIC(18,6) NOT NULL,
        nav      NUMERIC(15,4) NOT NULL,
        amount   NUMERIC(15,2) NOT NULL,
        type     VARCHAR(20) NOT NULL DEFAULT 'purchase',
        txn_date DATE NOT NULL,
        notes    TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX idx_mf_funds_user_id ON mf_funds(user_id);
      CREATE INDEX idx_mf_txn_fund_id   ON mf_transactions(fund_id);
      CREATE INDEX idx_mf_txn_user_id   ON mf_transactions(user_id);
    `,
    down: `
      DROP TABLE IF EXISTS mf_transactions;
      DROP TABLE IF EXISTS mf_funds;
    `,
  },
  {
    name: '010_create_loan_repayments',
    up: `
      CREATE TABLE loan_repayments (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        loan_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        repayment_type   VARCHAR(20) NOT NULL DEFAULT 'flexible',
        repayment_date   DATE NOT NULL,
        amount_paid      NUMERIC(15,2) NOT NULL,
        days             INTEGER NOT NULL,
        interest         NUMERIC(15,4) NOT NULL,
        principal        NUMERIC(15,4) NOT NULL,
        notes            TEXT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_loan_repayments_loan_id ON loan_repayments(loan_id);
      CREATE INDEX idx_loan_repayments_user_id ON loan_repayments(user_id);
      UPDATE accounts
        SET meta = meta || jsonb_build_object('original_amount', balance, 'interest_earned', 0)
        WHERE account_type = 'loan_given';
    `,
    down: `DROP TABLE IF EXISTS loan_repayments;`,
  },
  {
    name: '013_sip_add_monthly_and_link',
    up: `
      ALTER TABLE sip_investments
        ADD COLUMN IF NOT EXISTS monthly_sip_amount NUMERIC(15,2),
        ADD COLUMN IF NOT EXISTS fund_link TEXT;
    `,
    down: `
      ALTER TABLE sip_investments
        DROP COLUMN IF EXISTS monthly_sip_amount,
        DROP COLUMN IF EXISTS fund_link;
    `,
  },
  {
    name: '014_sip_add_scheme_code',
    up: `ALTER TABLE sip_investments ADD COLUMN IF NOT EXISTS scheme_code VARCHAR(20);`,
    down: `ALTER TABLE sip_investments DROP COLUMN IF EXISTS scheme_code;`,
  },
  {
    name: '015_create_bond_payouts',
    up: `
      CREATE TABLE IF NOT EXISTS bond_payouts (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        bond_id          UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        payout_date      DATE NOT NULL,
        frequency        VARCHAR(20) NOT NULL DEFAULT 'annually',
        interest_payout  NUMERIC(15,2) NOT NULL DEFAULT 0,
        principal_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
        notes            TEXT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_bond_payouts_bond_id ON bond_payouts(bond_id);
      CREATE INDEX IF NOT EXISTS idx_bond_payouts_user_id ON bond_payouts(user_id);
    `,
    down: `DROP TABLE IF EXISTS bond_payouts;`,
  },
  {
    name: '011_add_user_role',
    up: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'owner';
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    `,
    down: `ALTER TABLE users DROP COLUMN IF EXISTS role;`,
  },
  {
    name: '012_create_sip_table',
    up: `
      CREATE TABLE sip_investments (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        fund_name        VARCHAR(255) NOT NULL,
        date_from        DATE,
        current_nav      NUMERIC(15,4) NOT NULL DEFAULT 0,
        units            NUMERIC(15,6) NOT NULL DEFAULT 0,
        invested_amount  NUMERIC(15,2) NOT NULL DEFAULT 0,
        current_value    NUMERIC(15,2) NOT NULL DEFAULT 0,
        notes            TEXT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_sip_user_id ON sip_investments(user_id);
    `,
    down: `DROP TABLE IF EXISTS sip_investments;`,
  },
  {
    name: '016_add_role_check_constraint',
    up: `
      ALTER TABLE users
        ADD CONSTRAINT chk_users_role CHECK (role IN ('owner', 'admin', 'loan_user'));
    `,
    down: `ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role;`,
  },
  {
    name: '017_bond_payouts_add_tds',
    up: `
      ALTER TABLE bond_payouts
        ADD COLUMN IF NOT EXISTS tds NUMERIC(15,2) NOT NULL DEFAULT 0;
    `,
    down: `ALTER TABLE bond_payouts DROP COLUMN IF EXISTS tds;`,
  },
  {
    name: '018_create_manual_income_entries',
    up: `
      CREATE TABLE IF NOT EXISTS manual_income_entries (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        income_date DATE NOT NULL,
        amount      NUMERIC(15,2) NOT NULL,
        notes       TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_manual_income_user_id ON manual_income_entries(user_id);
      CREATE INDEX IF NOT EXISTS idx_manual_income_date ON manual_income_entries(income_date);
    `,
    down: `DROP TABLE IF EXISTS manual_income_entries;`,
  },
  {
    name: '019_manual_income_add_recurrence',
    up: `
      ALTER TABLE manual_income_entries
        ADD COLUMN IF NOT EXISTS frequency VARCHAR(20) NOT NULL DEFAULT 'once',
        ADD COLUMN IF NOT EXISTS end_date DATE;
      ALTER TABLE manual_income_entries
        ADD CONSTRAINT chk_manual_income_frequency
        CHECK (frequency IN ('once', 'monthly', 'quarterly', 'half_yearly', 'annually'));
    `,
    down: `
      ALTER TABLE manual_income_entries
        DROP CONSTRAINT IF EXISTS chk_manual_income_frequency,
        DROP COLUMN IF EXISTS frequency,
        DROP COLUMN IF EXISTS end_date;
    `,
  },
  {
    name: '007_seed_system_categories',
    up: `
      INSERT INTO categories (name, icon, color, is_system) VALUES
        ('Salary',          'wallet',        '#22C55E', TRUE),
        ('Business Income', 'briefcase',     '#3B82F6', TRUE),
        ('Interest Income', 'percent',       '#8B5CF6', TRUE),
        ('Dividend',        'trending-up',   '#06B6D4', TRUE),
        ('Other Income',    'plus-circle',   '#6B7280', TRUE),
        ('Food & Dining',   'utensils',      '#EF4444', TRUE),
        ('Transport',       'car',           '#F59E0B', TRUE),
        ('Utilities',       'zap',           '#10B981', TRUE),
        ('Healthcare',      'heart',         '#EC4899', TRUE),
        ('Education',       'book',          '#6366F1', TRUE),
        ('Entertainment',   'film',          '#F97316', TRUE),
        ('Shopping',        'shopping-bag',  '#14B8A6', TRUE),
        ('Investment',      'bar-chart-2',   '#8B5CF6', TRUE),
        ('Loan Repayment',  'credit-card',   '#EF4444', TRUE),
        ('Insurance',       'shield',        '#64748B', TRUE),
        ('Other Expense',   'more-horizontal','#9CA3AF', TRUE)
      ON CONFLICT DO NOTHING;
    `,
    down: `DELETE FROM categories WHERE is_system = TRUE;`,
  },
];

async function runMigrations(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await getApplied();

  const pending = migrations.filter((m) => !applied.has(m.name));
  if (pending.length === 0) {
    logger.info('No pending migrations');
    return;
  }

  logger.info(`Running ${pending.length} migration(s)`);
  for (const m of pending) {
    logger.info(`Applying: ${m.name}`);
    await query(m.up);
    await query(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1)`, [m.name]);
    logger.info(`Applied:  ${m.name}`);
  }
  logger.info('All migrations applied successfully');
}

async function rollback(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await getApplied();
  const toRollback = migrations
    .slice()
    .reverse()
    .filter((m) => applied.has(m.name));

  if (toRollback.length === 0) {
    logger.info('Nothing to roll back');
    return;
  }

  const last = toRollback[0];
  logger.info(`Rolling back: ${last.name}`);
  await query(last.down);
  await query(`DELETE FROM ${MIGRATIONS_TABLE} WHERE name = $1`, [last.name]);
  logger.info(`Rolled back: ${last.name}`);
}

const command = process.argv[2];
(async () => {
  try {
    if (command === 'rollback') await rollback();
    else await runMigrations();
  } catch (err: any) {
    logger.error('Migration failed', { error: err.message });
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
