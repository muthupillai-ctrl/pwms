import Joi from 'joi';
import { saneIsoDate } from '../../utils/validators';

export const createBondSchema = Joi.object({
  accountId:        Joi.string().uuid().allow(null).optional(),
  name:             Joi.string().min(1).max(255).trim().required(),
  isin:             Joi.string().max(20).trim().uppercase().allow('', null).optional(),
  investmentAmount: Joi.number().positive().precision(2).required(),
  purchaseDate:     saneIsoDate.required(),
  maturityDate:     saneIsoDate.required(),
  notes:            Joi.string().max(2000).trim().allow('', null).optional(),
  meta:             Joi.object().default({}),
});

export const updateBondSchema = Joi.object({
  name:             Joi.string().min(1).max(255).trim(),
  isin:             Joi.string().max(20).trim().uppercase().allow('', null),
  investmentAmount: Joi.number().positive().precision(2),
  purchaseDate:     saneIsoDate.allow('', null),
  maturityDate:     saneIsoDate,
  notes:            Joi.string().max(2000).trim().allow('', null),
  meta:             Joi.object(),
}).min(1);

export const addPayoutSchema = Joi.object({
  payoutDate:      saneIsoDate.required(),
  frequency:       Joi.string().valid('monthly', 'quarterly', 'half_yearly', 'annually', 'one_time').required(),
  interestPayout:  Joi.number().min(0).precision(2).required(),
  tds:             Joi.number().min(0).precision(2).default(0),
  principalAmount: Joi.number().min(0).precision(2).default(0),
  notes:           Joi.string().max(2000).trim().allow('', null).optional(),
});
