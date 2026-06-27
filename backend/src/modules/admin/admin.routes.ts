import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import {
  listUsersSchema,
  updateStatusSchema,
  updateRoleSchema,
  listAuditLogsSchema,
  createCategorySchema,
  updateCategorySchema,
} from './admin.schemas';
import {
  listUsers,
  getUser,
  updateStatus,
  updateRole,
  deleteUser,
  getStats,
  listAuditLogs,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from './admin.controller';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

// ── Stats ────────────────────────────────────────────────────
router.get('/stats', getStats);

// ── Users ────────────────────────────────────────────────────
router.get('/users',             validate(listUsersSchema, 'query'), listUsers);
router.get('/users/:id',         getUser);
router.patch('/users/:id/status', validate(updateStatusSchema), updateStatus);
router.patch('/users/:id/role',   validate(updateRoleSchema),   updateRole);
router.delete('/users/:id',       deleteUser);

// ── Audit Logs ───────────────────────────────────────────────
router.get('/audit-logs', validate(listAuditLogsSchema, 'query'), listAuditLogs);

// ── System Categories ────────────────────────────────────────
router.get('/categories',        listCategories);
router.post('/categories',       validate(createCategorySchema), createCategory);
router.patch('/categories/:id',  validate(updateCategorySchema), updateCategory);
router.delete('/categories/:id', deleteCategory);

export { router as adminRouter };
