import { Request, Response, NextFunction } from 'express';
import { MfService } from './mf.service';
import { fetchNav } from './nav.service';
import { ok, created, noContent } from '../../utils/response';
import { p } from '../../utils/params';

const mfService = new MfService();

export const MfController = {
  async listFunds(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const funds = await mfService.listFunds(req.user!.sub);
      ok(res, { funds });
    } catch (err) { next(err); }
  },

  async createFund(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const fund = await mfService.createFund(req.user!.sub, req.body);
      created(res, { fund });
    } catch (err) { next(err); }
  },

  async updateFund(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const fund = await mfService.updateFund(p(req.params['id']), req.user!.sub, req.body);
      ok(res, { fund });
    } catch (err) { next(err); }
  },

  async deleteFund(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await mfService.deleteFund(p(req.params['id']), req.user!.sub);
      noContent(res);
    } catch (err) { next(err); }
  },

  async addTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const txn = await mfService.addTransaction(p(req.params['fundId']), req.user!.sub, req.body);
      created(res, { transaction: txn });
    } catch (err) { next(err); }
  },

  async deleteTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await mfService.deleteTransaction(p(req.params['txnId']), req.user!.sub);
      noContent(res);
    } catch (err) { next(err); }
  },

  async getNav(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await fetchNav(p(req.params['schemeCode']));
      ok(res, { nav: result });
    } catch (err) { next(err); }
  },
};
