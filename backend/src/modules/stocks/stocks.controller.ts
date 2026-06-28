import { Request, Response, NextFunction } from 'express';
import { StocksService } from './stocks.service';
import { fetchQuote } from './quote.service';
import { ok, created, noContent } from '../../utils/response';
import { p } from '../../utils/params';

const stocksService = new StocksService();

export const StocksController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stocks = await stocksService.list(req.user!.sub);
      ok(res, { stocks });
    } catch (err) { next(err); }
  },

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stock = await stocksService.getOne(p(req.params.id), req.user!.sub);
      ok(res, { stock });
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stock = await stocksService.create(req.user!.sub, req.body);
      created(res, { stock });
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stock = await stocksService.update(p(req.params.id), req.user!.sub, req.body);
      ok(res, { stock });
    } catch (err) { next(err); }
  },

  async updatePrice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stock = await stocksService.updatePrice(p(req.params.id), req.user!.sub, req.body.currentPrice, req.body.name);
      ok(res, { stock });
    } catch (err) { next(err); }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await stocksService.remove(p(req.params.id), req.user!.sub);
      noContent(res);
    } catch (err) { next(err); }
  },

  async quote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await fetchQuote(p(req.params.symbol));
      ok(res, { quote: result });
    } catch (err) { next(err); }
  },
};
