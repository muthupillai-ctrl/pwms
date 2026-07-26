import { Request, Response, NextFunction } from 'express';
import { ManualIncomeService } from './manual-income.service';
import { ok, created, noContent } from '../../utils/response';
import { p } from '../../utils/params';

const manualIncomeService = new ManualIncomeService();

export const ManualIncomeController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entries = await manualIncomeService.list(req.user!.sub);
      ok(res, { entries });
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entry = await manualIncomeService.create(req.user!.sub, req.body);
      created(res, { entry });
    } catch (err) { next(err); }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await manualIncomeService.remove(p(req.params.id), req.user!.sub);
      noContent(res);
    } catch (err) { next(err); }
  },
};
