import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { badRequest } from '../utils/response';

type Target = 'body' | 'query' | 'params';

export function validate(schema: Joi.ObjectSchema, target: Target = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[target], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      badRequest(
        res,
        'Validation failed',
        error.details.map((d) => d.message)
      );
      return;
    }

    if (target === 'query') {
      // Express 5: req.query is a read-only getter on the prototype; shadow it on the instance
      Object.defineProperty(req, 'query', { value, writable: true, configurable: true, enumerable: true });
    } else {
      req[target] = value;
    }
    next();
  };
}
