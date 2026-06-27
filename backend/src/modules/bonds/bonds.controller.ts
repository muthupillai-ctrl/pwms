import { Request, Response, NextFunction } from 'express';
import { BondsService } from './bonds.service';
import { ok, created, noContent } from '../../utils/response';

const bondsService = new BondsService();

export const BondsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const bonds = await bondsService.list(req.user!.sub);
      ok(res, { bonds });
    } catch (err) { next(err); }
  },

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const bond = await bondsService.getOne(req.params.id, req.user!.sub);
      ok(res, { bond });
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const bond = await bondsService.create(req.user!.sub, req.body);
      created(res, { bond });
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const bond = await bondsService.update(req.params.id, req.user!.sub, req.body);
      ok(res, { bond });
    } catch (err) { next(err); }
  },

  async updatePrice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const bond = await bondsService.updatePrice(req.params.id, req.user!.sub, req.body.currentPrice);
      ok(res, { bond });
    } catch (err) { next(err); }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await bondsService.remove(req.params.id, req.user!.sub);
      noContent(res);
    } catch (err) { next(err); }
  },

  async addPayout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payout = await bondsService.addPayout(req.params['bondId'], req.user!.sub, req.body);
      created(res, { payout });
    } catch (err) { next(err); }
  },

  async deletePayout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await bondsService.deletePayout(req.params['payoutId'], req.user!.sub);
      noContent(res);
    } catch (err) { next(err); }
  },
};
