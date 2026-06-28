/** Extract a route param as a plain string (Express 5 types `req.params` as `string | string[]`). */
export const p = (v: string | string[]): string => (Array.isArray(v) ? v[0]! : v);
