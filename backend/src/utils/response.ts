import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    [key: string]: unknown;
  };
}

export function ok<T>(res: Response, data: T, meta?: ApiResponse['meta']): Response {
  return res.status(200).json({ success: true, data, ...(meta ? { meta } : {}) } satisfies ApiResponse<T>);
}

export function created<T>(res: Response, data: T): Response {
  return res.status(201).json({ success: true, data } satisfies ApiResponse<T>);
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}

export function badRequest(res: Response, message: string, details?: unknown): Response {
  return res.status(400).json({
    success: false,
    error: { code: 'BAD_REQUEST', message, details },
  } satisfies ApiResponse);
}

export function unauthorized(res: Response, message = 'Unauthorized'): Response {
  return res.status(401).json({
    success: false,
    error: { code: 'UNAUTHORIZED', message },
  } satisfies ApiResponse);
}

export function forbidden(res: Response, message = 'Forbidden'): Response {
  return res.status(403).json({
    success: false,
    error: { code: 'FORBIDDEN', message },
  } satisfies ApiResponse);
}

export function notFound(res: Response, message = 'Resource not found'): Response {
  return res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message },
  } satisfies ApiResponse);
}

export function conflict(res: Response, message: string): Response {
  return res.status(409).json({
    success: false,
    error: { code: 'CONFLICT', message },
  } satisfies ApiResponse);
}

export function serverError(res: Response, message = 'Internal server error'): Response {
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message },
  } satisfies ApiResponse);
}
