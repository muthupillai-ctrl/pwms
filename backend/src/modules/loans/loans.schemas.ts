import Joi from 'joi';

const COMPOUNDING = ['monthly', 'quarterly', 'half_yearly', 'annually'] as const;

export const createLoanSchema = Joi.object({
  borrowerName:  Joi.string().min(1).max(255).trim().required(),
  borrowerEmail: Joi.string().email().lowercase().trim().allow('', null).optional(),
  amount:        Joi.number().positive().precision(2).required(),
  interestRate:  Joi.number().min(0).max(100).precision(4).default(0),
  compounding:   Joi.string().valid(...COMPOUNDING).default('monthly'),
  loanDate:      Joi.string().isoDate().required(),
  dueDate:       Joi.string().isoDate().optional(),
  loanType:      Joi.string().valid('personal', 'business', 'other').default('personal'),
  currency:      Joi.string().length(3).uppercase().default('INR'),
  notes:         Joi.string().max(2000).trim().optional(),
});

export const updateLoanSchema = Joi.object({
  borrowerName:  Joi.string().min(1).max(255).trim(),
  borrowerEmail: Joi.string().email().lowercase().trim().allow('', null),
  interestRate:  Joi.number().min(0).max(100).precision(4),
  compounding:   Joi.string().valid(...COMPOUNDING),
  dueDate:       Joi.string().isoDate().allow(null),
  loanType:      Joi.string().valid('personal', 'business', 'other'),
  notes:         Joi.string().max(2000).trim().allow('', null),
  isActive:      Joi.boolean(),
}).min(1);

export const recordRepaymentSchema = Joi.object({
  amount: Joi.number().positive().precision(2).required(),
  notes:  Joi.string().max(2000).trim().optional(),
});

export const addRepaymentSchema = Joi.object({
  repaymentDate: Joi.string().isoDate().required(),
  amountPaid:    Joi.number().positive().precision(2).required(),
  notes:         Joi.string().max(2000).trim().allow('', null).optional(),
});
