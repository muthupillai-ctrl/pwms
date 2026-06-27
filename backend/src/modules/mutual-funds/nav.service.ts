import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

export interface NavResult {
  schemeCode: string;
  schemeName: string;
  nav: number;
  date: string;
}

export async function fetchNav(schemeCode: string): Promise<NavResult> {
  const url = `https://api.mfapi.in/mf/${encodeURIComponent(schemeCode)}`;
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch (err: any) {
    throw new AppError(503, 'NAV_FETCH_ERROR', `Could not reach mfapi.in: ${err.message}`);
  }
  if (!res.ok) {
    throw new AppError(404, 'NAV_NOT_FOUND', `No fund found for scheme code "${schemeCode}"`);
  }
  const json = await res.json() as any;
  if (json.status !== 'SUCCESS' || !json.data?.length) {
    throw new AppError(404, 'NAV_NOT_FOUND', `No NAV data for scheme code "${schemeCode}"`);
  }
  const latest = json.data[0];
  logger.debug('NAV fetched', { schemeCode, nav: latest.nav, date: latest.date });
  return {
    schemeCode,
    schemeName: json.meta?.scheme_name ?? '',
    nav:        parseFloat(latest.nav),
    date:       latest.date,
  };
}
