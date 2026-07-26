import Joi from 'joi';

const FREQUENCIES = ['once', 'monthly', 'quarterly', 'half_yearly', 'annually'];

export const createManualIncomeSchema = Joi.object({
  incomeDate: Joi.string().isoDate().required(),
  amount:     Joi.number().min(0).precision(2).required(),
  notes:      Joi.string().max(2000).trim().allow('', null).optional(),
  frequency:  Joi.string().valid(...FREQUENCIES).default('once'),
  endDate:    Joi.string().isoDate().when('frequency', {
    is: Joi.valid('once'),
    then: Joi.allow('', null).optional(),
    otherwise: Joi.required(),
  }),
});
