import { Request, Response, NextFunction } from 'express';
import { AccountsService } from './accounts.service';
import { ok, created, noContent } from '../../utils/response';
import { p } from '../../utils/params';

const accountsService = new AccountsService();

export const AccountsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const accounts = await accountsService.list(req.user!.sub);
      ok(res, { accounts });
    } catch (err) { next(err); }
  },

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const account = await accountsService.getOne(p(req.params.id), req.user!.sub);
      ok(res, { account });
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const account = await accountsService.create(req.user!.sub, req.body);
      created(res, { account });
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const account = await accountsService.update(p(req.params.id), req.user!.sub, req.body);
      ok(res, { account });
    } catch (err) { next(err); }
  },

  async updateBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { balance, notes } = req.body;
      const account = await accountsService.updateBalance(p(req.params.id), req.user!.sub, balance, notes);
      ok(res, { account });
    } catch (err) { next(err); }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await accountsService.remove(p(req.params.id), req.user!.sub);
      noContent(res);
    } catch (err) { next(err); }
  },
};
