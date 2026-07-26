import Joi from 'joi';
import { saneIsoDate } from '../../utils/validators';

export const createStockSchema = Joi.object({
  accountId:     Joi.string().uuid().optional(),
  symbol:        Joi.string().max(20).trim().uppercase().required(),
  name:          Joi.string().min(1).max(255).trim().required(),
  units:         Joi.number().positive().precision(6).required(),
  purchasePrice: Joi.number().positive().precision(4).required(),
  purchaseDate:  saneIsoDate.optional(),
  currentPrice:  Joi.number().positive().precision(4).optional(),
  broker:        Joi.string().max(200).trim().allow('', null).optional(),
  notes:         Joi.string().max(2000).trim().optional(),
  meta:          Joi.object().default({}),
});

export const updateStockSchema = Joi.object({
  symbol:        Joi.string().max(20).trim().uppercase(),
  name:          Joi.string().min(1).max(255).trim(),
  units:         Joi.number().positive().precision(6),
  purchasePrice: Joi.number().positive().precision(4),
  purchaseDate:  saneIsoDate.allow('', null),
  currentPrice:  Joi.number().positive().precision(4).allow(null),
  broker:        Joi.string().max(200).trim().allow('', null),
  notes:         Joi.string().max(2000).trim().allow('', null),
  meta:          Joi.object(),
}).min(1);

export const updatePriceSchema = Joi.object({
  currentPrice: Joi.number().positive().precision(4).required(),
  name:         Joi.string().min(1).max(255).trim().optional(),
});
