import { Request, Response, NextFunction } from 'express';
import { LoansService } from './loans.service';
import { ok, created, noContent } from '../../utils/response';

const loansService = new LoansService();

export const LoansController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const loans = await loansService.list(req.user!.sub);
      ok(res, { loans });
    } catch (err) { next(err); }
  },

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const loan = await loansService.getOne(req.params.id, req.user!.sub);
      ok(res, { loan });
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const loan = await loansService.create(req.user!.sub, req.body);
      created(res, { loan });
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const loan = await loansService.update(req.params.id, req.user!.sub, req.body);
      ok(res, { loan });
    } catch (err) { next(err); }
  },

  async recordRepayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { amount, notes } = req.body;
      const loan = await loansService.recordRepayment(req.params.id, req.user!.sub, amount, notes);
      ok(res, { loan });
    } catch (err) { next(err); }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await loansService.remove(req.params.id, req.user!.sub);
      noContent(res);
    } catch (err) { next(err); }
  },

  async listRepayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const repayments = await loansService.listRepayments(req.params.id, req.user!.sub);
      ok(res, { repayments });
    } catch (err) { next(err); }
  },

  async addRepayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const repayment = await loansService.addRepayment(req.params.id, req.user!.sub, req.body);
      created(res, { repayment });
    } catch (err) { next(err); }
  },

  async deleteRepayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await loansService.deleteRepayment(req.params.repaymentId, req.user!.sub);
      noContent(res);
    } catch (err) { next(err); }
  },

  // ── Loan-user endpoints (read-only, matched by email) ────
  async myLoans(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const loans = await loansService.listByEmail(req.user!.email);
      ok(res, { loans });
    } catch (err) { next(err); }
  },

  async myRepayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const repayments = await loansService.listRepaymentsByEmail(req.params.id, req.user!.email);
      ok(res, { repayments });
    } catch (err) { next(err); }
  },
};
