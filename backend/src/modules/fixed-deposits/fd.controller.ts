import { Request, Response, NextFunction } from 'express';
import { FdService } from './fd.service';
import { ok, created, noContent } from '../../utils/response';

const fdService = new FdService();

export const FdController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const fds = await fdService.list(req.user!.sub);
      ok(res, { fixedDeposits: fds });
    } catch (err) { next(err); }
  },

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const fd = await fdService.getOne(req.params.id, req.user!.sub);
      ok(res, { fixedDeposit: fd });
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const fd = await fdService.create(req.user!.sub, req.body);
      created(res, { fixedDeposit: fd });
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const fd = await fdService.update(req.params.id, req.user!.sub, req.body);
      ok(res, { fixedDeposit: fd });
    } catch (err) { next(err); }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await fdService.remove(req.params.id, req.user!.sub);
      noContent(res);
    } catch (err) { next(err); }
  },
};
