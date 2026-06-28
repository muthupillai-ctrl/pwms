import { Request, Response, NextFunction } from 'express';
import { SipService } from './sip.service';
import { ok, created, noContent } from '../../utils/response';
import { p } from '../../utils/params';

const sipService = new SipService();

export const SipController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sips = await sipService.list(req.user!.sub);
      ok(res, { sips });
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sip = await sipService.create(req.user!.sub, req.body);
      created(res, { sip });
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sip = await sipService.update(p(req.params.id), req.user!.sub, req.body);
      ok(res, { sip });
    } catch (err) { next(err); }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await sipService.remove(p(req.params.id), req.user!.sub);
      noContent(res);
    } catch (err) { next(err); }
  },
};
