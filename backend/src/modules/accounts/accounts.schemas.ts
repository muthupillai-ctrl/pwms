import Joi from 'joi';

const ACCOUNT_TYPES = ['savings', 'current', 'cash', 'other'] as const;

export const createAccountSchema = Joi.object({
  name:        Joi.string().min(1).max(255).trim().required(),
  accountType: Joi.string().valid(...ACCOUNT_TYPES).required(),
  institution: Joi.string().max(255).trim().optional(),
  currency:    Joi.string().length(3).uppercase().default('INR'),
  balance:     Joi.number().precision(2).default(0),
  notes:       Joi.string().max(2000).trim().optional(),
  meta:        Joi.object().default({}),
});

export const updateAccountSchema = Joi.object({
  name:        Joi.string().min(1).max(255).trim(),
  institution: Joi.string().max(255).trim().allow('', null),
  currency:    Joi.string().length(3).uppercase(),
  balance:     Joi.number().precision(2),
  notes:       Joi.string().max(2000).trim().allow('', null),
  meta:        Joi.object(),
  isActive:    Joi.boolean(),
}).min(1);

export const updateBalanceSchema = Joi.object({
  balance: Joi.number().precision(2).required(),
  notes:   Joi.string().max(2000).trim().optional(),
});
