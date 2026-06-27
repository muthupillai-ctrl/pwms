import Joi from 'joi';

export const createBondSchema = Joi.object({
  accountId:         Joi.string().uuid().optional(),
  name:              Joi.string().min(1).max(255).trim().required(),
  isin:              Joi.string().max(20).trim().uppercase().optional(),
  quantity:          Joi.number().positive().integer().required(),
  purchasePrice:     Joi.number().positive().precision(4).required(),
  couponRate:        Joi.number().min(0).max(30).precision(4).required(),
  purchaseDate:      Joi.string().isoDate().optional(),
  maturityDate:      Joi.string().isoDate().required(),
  faceValuePerUnit:  Joi.number().positive().precision(2).default(1000),
  currentPrice:      Joi.number().positive().precision(4).optional(),
  notes:             Joi.string().max(2000).trim().optional(),
  meta:              Joi.object().default({}),
});

export const updateBondSchema = Joi.object({
  name:         Joi.string().min(1).max(255).trim(),
  couponRate:   Joi.number().min(0).max(30).precision(4),
  maturityDate: Joi.string().isoDate(),
  notes:        Joi.string().max(2000).trim().allow('', null),
  meta:         Joi.object(),
}).min(1);

export const updateBondPriceSchema = Joi.object({
  currentPrice: Joi.number().positive().precision(4).required(),
});

export const addPayoutSchema = Joi.object({
  payoutDate:      Joi.string().isoDate().required(),
  frequency:       Joi.string().valid('monthly', 'quarterly', 'half_yearly', 'annually', 'one_time').required(),
  interestPayout:  Joi.number().min(0).precision(2).required(),
  principalAmount: Joi.number().min(0).precision(2).default(0),
  notes:           Joi.string().max(2000).trim().allow('', null).optional(),
});
