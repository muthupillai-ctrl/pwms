import Joi from 'joi';

export const createSipSchema = Joi.object({
  fundName:         Joi.string().min(1).max(255).trim().required(),
  schemeCode:       Joi.string().max(20).trim().allow('', null).optional(),
  dateFrom:         Joi.string().isoDate().allow('', null).optional(),
  currentNav:       Joi.number().min(0).precision(4).required(),
  units:            Joi.number().min(0).precision(6).required(),
  investedAmount:   Joi.number().min(0).precision(2).required(),
  monthlySipAmount: Joi.number().min(0).precision(2).allow(null).optional(),
  fundLink:         Joi.string().uri().max(1000).allow('', null).optional(),
  notes:            Joi.string().max(2000).trim().allow('', null).optional(),
});

export const updateSipSchema = Joi.object({
  fundName:         Joi.string().min(1).max(255).trim(),
  schemeCode:       Joi.string().max(20).trim().allow('', null),
  dateFrom:         Joi.string().isoDate().allow('', null),
  currentNav:       Joi.number().min(0).precision(4),
  units:            Joi.number().min(0).precision(6),
  investedAmount:   Joi.number().min(0).precision(2),
  monthlySipAmount: Joi.number().min(0).precision(2).allow(null),
  fundLink:         Joi.string().uri().max(1000).allow('', null),
  notes:            Joi.string().max(2000).trim().allow('', null),
}).min(1);
