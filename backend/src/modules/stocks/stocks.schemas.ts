import Joi from 'joi';

export const createStockSchema = Joi.object({
  accountId:     Joi.string().uuid().optional(),
  symbol:        Joi.string().max(20).trim().uppercase().required(),
  name:          Joi.string().min(1).max(255).trim().required(),
  units:         Joi.number().positive().precision(6).required(),
  purchasePrice: Joi.number().positive().precision(4).required(),
  purchaseDate:  Joi.string().isoDate().optional(),
  currentPrice:  Joi.number().positive().precision(4).optional(),
  notes:         Joi.string().max(2000).trim().optional(),
  meta:          Joi.object().default({}),
});

export const updateStockSchema = Joi.object({
  name:    Joi.string().min(1).max(255).trim(),
  notes:   Joi.string().max(2000).trim().allow('', null),
  meta:    Joi.object(),
}).min(1);

export const updatePriceSchema = Joi.object({
  currentPrice: Joi.number().positive().precision(4).required(),
  name:         Joi.string().min(1).max(255).trim().optional(),
});
