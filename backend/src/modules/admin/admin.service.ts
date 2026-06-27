import { query, queryOne } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { UserRole } from '../auth/jwt.service';

interface UserListRow {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  mfa_enabled: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface AuditLogRow {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  meta: Record<string, unknown>;
  created_at: Date;
}

export class AdminService {
  async listUsers(opts: {
    page: number;
    limit: number;
    search?: string;
    role?: string;
    status?: string;
  }): Promise<{ rows: UserListRow[]; total: number }> {
    const { page, limit, search, role, status } = opts;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (search) {
      conditions.push(`(email ILIKE $${idx} OR full_name ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (role) {
      conditions.push(`role = $${idx++}`);
      params.push(role);
    }
    if (status) {
      conditions.push(`is_active = $${idx++}`);
      params.push(status === 'active');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRow] = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM users ${where}`,
      params
    );

    const rows = await query<UserListRow>(
      `SELECT id, email, full_name, phone, role, mfa_enabled, is_active, created_at, updated_at
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    );

    return { rows, total: parseInt(countRow.count, 10) };
  }

  async getUser(id: string): Promise<UserListRow & { account_count: number; transaction_count: number }> {
    const user = await queryOne<UserListRow & { account_count: number; transaction_count: number }>(
      `SELECT u.id, u.email, u.full_name, u.phone, u.role, u.mfa_enabled, u.is_active,
              u.created_at, u.updated_at,
              COUNT(DISTINCT a.id)::int AS account_count,
              COUNT(DISTINCT t.id)::int AS transaction_count
       FROM users u
       LEFT JOIN accounts a ON a.user_id = u.id
       LEFT JOIN transactions t ON t.user_id = u.id
       WHERE u.id = $1
       GROUP BY u.id`,
      [id]
    );
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
    return user;
  }

  async updateStatus(id: string, adminId: string, isActive: boolean): Promise<UserListRow> {
    if (id === adminId) throw new AppError(400, 'BAD_REQUEST', 'Cannot change your own account status');

    const user = await queryOne<UserListRow>(
      `UPDATE users SET is_active = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, full_name, role, is_active, updated_at`,
      [isActive, id]
    );
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
    return user;
  }

  async updateRole(id: string, adminId: string, role: UserRole): Promise<UserListRow> {
    if (id === adminId) throw new AppError(400, 'BAD_REQUEST', 'Cannot change your own role');

    const user = await queryOne<UserListRow>(
      `UPDATE users SET role = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, full_name, role, is_active, updated_at`,
      [role, id]
    );
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
    return user;
  }

  async deleteUser(id: string, adminId: string): Promise<void> {
    if (id === adminId) throw new AppError(400, 'BAD_REQUEST', 'Cannot delete your own account');

    const user = await queryOne<{ id: string; email: string; role: UserRole }>(
      'SELECT id, email, role FROM users WHERE id = $1',
      [id]
    );
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
    if (user.role === 'admin') throw new AppError(400, 'BAD_REQUEST', 'Cannot delete another admin. Downgrade their role first.');

    // Block deletion if user has active loans as lender or borrower
    const [loanCheck] = await query<{ as_lender: string; as_borrower: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE user_id = $1)                             AS as_lender,
         COUNT(*) FILTER (WHERE meta->>'borrower_email' = $2)             AS as_borrower
       FROM accounts
       WHERE account_type = 'loan_given'
         AND (user_id = $1 OR meta->>'borrower_email' = $2)`,
      [id, user.email.toLowerCase()]
    );

    const lenderCount   = parseInt(loanCheck.as_lender,   10);
    const borrowerCount = parseInt(loanCheck.as_borrower, 10);

    if (lenderCount > 0 || borrowerCount > 0) {
      const parts: string[] = [];
      if (lenderCount   > 0) parts.push(`${lenderCount} loan${lenderCount   > 1 ? 's' : ''} given`);
      if (borrowerCount > 0) parts.push(`${borrowerCount} loan${borrowerCount > 1 ? 's' : ''} received`);
      throw new AppError(
        409,
        'LOAN_LINKED',
        `Cannot delete this user — they have ${parts.join(' and ')} linked to their account. Remove or reassign all loans first.`
      );
    }

    await query('DELETE FROM users WHERE id = $1', [id]);
  }

  async getStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    newToday: number;
    newThisWeek: number;
    mfaEnabled: number;
    byRole: Record<string, number>;
  }> {
    const [totals] = await query<{
      total: string;
      active: string;
      today: string;
      this_week: string;
      mfa: string;
    }>(
      `SELECT
        COUNT(*)                                                        AS total,
        COUNT(*) FILTER (WHERE is_active = TRUE)                       AS active,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)             AS today,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') AS this_week,
        COUNT(*) FILTER (WHERE mfa_enabled = TRUE)                     AS mfa
       FROM users`
    );

    const roleRows = await query<{ role: string; count: string }>(
      `SELECT role, COUNT(*) AS count FROM users GROUP BY role`
    );

    const byRole: Record<string, number> = {};
    for (const r of roleRows) byRole[r.role] = parseInt(r.count, 10);

    return {
      totalUsers:  parseInt(totals.total, 10),
      activeUsers: parseInt(totals.active, 10),
      newToday:    parseInt(totals.today, 10),
      newThisWeek: parseInt(totals.this_week, 10),
      mfaEnabled:  parseInt(totals.mfa, 10),
      byRole,
    };
  }

  async listAuditLogs(opts: {
    page: number;
    limit: number;
    userId?: string;
    action?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<{ rows: AuditLogRow[]; total: number }> {
    const { page, limit, userId, action, dateFrom, dateTo } = opts;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (userId) { conditions.push(`al.user_id = $${idx++}`); params.push(userId); }
    if (action) { conditions.push(`al.action ILIKE $${idx++}`); params.push(`%${action}%`); }
    if (dateFrom) { conditions.push(`al.created_at >= $${idx++}`); params.push(dateFrom); }
    if (dateTo) { conditions.push(`al.created_at <= $${idx++}`); params.push(dateTo); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRow] = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM audit_logs al ${where}`,
      params
    );

    const rows = await query<AuditLogRow>(
      `SELECT al.id, al.user_id, u.email AS user_email, al.action,
              al.entity_type, al.entity_id, al.ip_address, al.user_agent,
              al.meta, al.created_at
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    );

    return { rows, total: parseInt(countRow.count, 10) };
  }

  async listSystemCategories() {
    return query(
      `SELECT id, name, icon, color, parent_id, is_system, created_at
       FROM categories
       WHERE is_system = TRUE
       ORDER BY name ASC`
    );
  }

  async createSystemCategory(data: {
    name: string;
    icon?: string;
    color?: string;
    parentId?: string;
  }) {
    const [cat] = await query(
      `INSERT INTO categories (name, icon, color, parent_id, is_system)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id, name, icon, color, parent_id, is_system, created_at`,
      [data.name, data.icon ?? null, data.color ?? null, data.parentId ?? null]
    );
    return cat;
  }

  async updateSystemCategory(id: string, data: { name?: string; icon?: string | null; color?: string | null }) {
    const cat = await queryOne(
      `UPDATE categories
       SET name  = COALESCE($1, name),
           icon  = COALESCE($2, icon),
           color = COALESCE($3, color)
       WHERE id = $4 AND is_system = TRUE
       RETURNING id, name, icon, color, parent_id, is_system`,
      [data.name ?? null, data.icon ?? null, data.color ?? null, id]
    );
    if (!cat) throw new AppError(404, 'NOT_FOUND', 'System category not found');
    return cat;
  }

  async deleteSystemCategory(id: string): Promise<void> {
    const result = await query(
      `DELETE FROM categories WHERE id = $1 AND is_system = TRUE RETURNING id`,
      [id]
    );
    if (!result.length) throw new AppError(404, 'NOT_FOUND', 'System category not found');
  }
}
