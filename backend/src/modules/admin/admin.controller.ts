import { Request, Response, NextFunction } from 'express';
import { AdminService } from './admin.service';
import { ok, created, noContent } from '../../utils/response';

const svc = new AdminService();

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const p     = Number(str(req.query.page))  || 1;
    const l     = Number(str(req.query.limit)) || 20;
    const { rows, total } = await svc.listUsers({
      page: p, limit: l,
      search: str(req.query.search),
      role:   str(req.query.role),
      status: str(req.query.status),
    });
    ok(res, rows, { page: p, limit: l, total, totalPages: Math.ceil(total / l) });
  } catch (err) { next(err); }
}

export async function getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await svc.getUser(str(req.params.id)!);
    ok(res, user);
  } catch (err) { next(err); }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await svc.updateStatus(str(req.params.id)!, req.user!.sub, req.body.isActive);
    ok(res, user);
  } catch (err) { next(err); }
}

export async function updateRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await svc.updateRole(str(req.params.id)!, req.user!.sub, req.body.role);
    ok(res, user);
  } catch (err) { next(err); }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.deleteUser(str(req.params.id)!, req.user!.sub);
    noContent(res);
  } catch (err) { next(err); }
}

export async function getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await svc.getStats();
    ok(res, stats);
  } catch (err) { next(err); }
}

export async function listAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const p        = Number(str(req.query.page))  || 1;
    const l        = Number(str(req.query.limit)) || 50;
    const dateFrom = str(req.query.dateFrom);
    const dateTo   = str(req.query.dateTo);
    const { rows, total } = await svc.listAuditLogs({
      page: p, limit: l,
      userId:   str(req.query.userId),
      action:   str(req.query.action),
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo:   dateTo   ? new Date(dateTo)   : undefined,
    });
    ok(res, rows, { page: p, limit: l, total, totalPages: Math.ceil(total / l) });
  } catch (err) { next(err); }
}

export async function listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cats = await svc.listSystemCategories();
    ok(res, cats);
  } catch (err) { next(err); }
}

export async function createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cat = await svc.createSystemCategory(req.body);
    created(res, cat);
  } catch (err) { next(err); }
}

export async function updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cat = await svc.updateSystemCategory(str(req.params.id)!, req.body);
    ok(res, cat);
  } catch (err) { next(err); }
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.deleteSystemCategory(str(req.params.id)!);
    noContent(res);
  } catch (err) { next(err); }
}
