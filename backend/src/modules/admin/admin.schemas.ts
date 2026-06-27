import Joi from 'joi';

export const listUsersSchema = Joi.object({
  page:   Joi.number().integer().min(1).default(1),
  limit:  Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(100).optional(),
  role:   Joi.string().valid('owner', 'admin', 'loan_user').optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
});

export const updateStatusSchema = Joi.object({
  isActive: Joi.boolean().required(),
});

export const updateRoleSchema = Joi.object({
  role: Joi.string().valid('owner', 'admin', 'loan_user').required(),
});

export const listAuditLogsSchema = Joi.object({
  page:     Joi.number().integer().min(1).default(1),
  limit:    Joi.number().integer().min(1).max(100).default(50),
  userId:   Joi.string().uuid().optional(),
  action:   Joi.string().trim().max(100).optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo:   Joi.date().iso().min(Joi.ref('dateFrom')).optional(),
});

export const createCategorySchema = Joi.object({
  name:     Joi.string().trim().min(1).max(100).required(),
  icon:     Joi.string().trim().max(50).optional(),
  color:    Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
  parentId: Joi.string().uuid().optional(),
});

export const updateCategorySchema = Joi.object({
  name:     Joi.string().trim().min(1).max(100).optional(),
  icon:     Joi.string().trim().max(50).allow(null).optional(),
  color:    Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).allow(null).optional(),
}).min(1);
