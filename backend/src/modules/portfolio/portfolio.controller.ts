import { Request, Response, NextFunction } from 'express';
import { PortfolioService } from './portfolio.service';
import { ok } from '../../utils/response';

const portfolioService = new PortfolioService();

export const PortfolioController = {
  async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await portfolioService.getSummary(req.user!.sub);
      ok(res, { summary });
    } catch (err) { next(err); }
  },
};
