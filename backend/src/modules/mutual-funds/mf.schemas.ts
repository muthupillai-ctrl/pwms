import Joi from 'joi';
import { saneIsoDate } from '../../utils/validators';

export const createFundSchema = Joi.object({
  name:       Joi.string().min(1).max(255).trim().required(),
  schemeCode: Joi.string().max(50).trim().allow('', null).optional(),
  latestNav:  Joi.number().min(0).precision(4).optional(),
  notes:      Joi.string().max(2000).trim().allow('', null).optional(),
});

export const updateFundSchema = Joi.object({
  name:       Joi.string().min(1).max(255).trim(),
  schemeCode: Joi.string().max(50).trim().allow('', null),
  latestNav:  Joi.number().min(0).precision(4),
  notes:      Joi.string().max(2000).trim().allow('', null),
}).min(1);

export const addTransactionSchema = Joi.object({
  units:   Joi.number().positive().precision(6).required(),
  nav:     Joi.number().positive().precision(4).required(),
  amount:  Joi.number().positive().precision(2).required(),
  type:    Joi.string().valid('purchase', 'redemption').default('purchase'),
  txnDate: saneIsoDate.required(),
  notes:   Joi.string().max(2000).trim().optional(),
});
