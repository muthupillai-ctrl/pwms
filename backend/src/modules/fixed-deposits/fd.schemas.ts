import Joi from 'joi';
import { saneIsoDate } from '../../utils/validators';

const COMPOUNDING = ['simple', 'monthly', 'quarterly', 'half_yearly', 'annual'] as const;

export const createFdSchema = Joi.object({
  accountId:      Joi.string().uuid().optional(),
  name:           Joi.string().min(1).max(255).trim().required(),
  fdNumber:       Joi.string().max(100).trim().optional(),
  principal:      Joi.number().positive().precision(2).required(),
  interestRate:   Joi.number().positive().max(100).precision(4).required(),
  startDate:      saneIsoDate.required(),
  maturityDate:   saneIsoDate.required(),
  compounding:            Joi.string().valid(...COMPOUNDING).default('quarterly'),
  assuredMaturityAmount:  Joi.number().positive().precision(2).optional(),
  platform:               Joi.string().max(200).trim().allow('', null).optional(),
  notes:                  Joi.string().max(2000).trim().optional(),
  meta:                   Joi.object().default({}),
});

export const updateFdSchema = Joi.object({
  name:                   Joi.string().min(1).max(255).trim(),
  fdNumber:               Joi.string().max(100).trim().allow('', null),
  interestRate:           Joi.number().positive().max(100).precision(4),
  maturityDate:           saneIsoDate,
  compounding:            Joi.string().valid(...COMPOUNDING),
  assuredMaturityAmount:  Joi.number().positive().precision(2).allow(null),
  platform:               Joi.string().max(200).trim().allow('', null),
  notes:                  Joi.string().max(2000).trim().allow('', null),
  meta:                   Joi.object(),
}).min(1);
