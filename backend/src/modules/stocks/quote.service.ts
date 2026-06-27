import yahooFinanceClass from 'yahoo-finance2';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

const yahooFinance = new (yahooFinanceClass as any)({ suppressNotices: ['yahooSurvey'] });

export interface QuoteResult {
  symbol:   string;
  price:    number;
  currency: string;
  name:     string;
  exchange: string;
}

// Try NSE (.NS) first, then BSE (.BO), then raw symbol as-is.
// Indian symbols stored without suffix (e.g. "RELIANCE") are resolved automatically.
const SUFFIXES = ['.NS', '.BO', ''];

export async function fetchQuote(rawSymbol: string): Promise<QuoteResult> {
  const base = rawSymbol.toUpperCase().replace(/\.(NS|BO|L|AX|TO)$/i, '');

  for (const suffix of SUFFIXES) {
    const sym = base + suffix;
    try {
      const q = await yahooFinance.quote(sym, {}, { validateResult: false });
      if (q && q.regularMarketPrice != null) {
        return {
          symbol:   sym,
          price:    q.regularMarketPrice,
          currency: q.currency ?? 'INR',
          name:     q.longName ?? q.shortName ?? sym,
          exchange: q.fullExchangeName ?? q.exchange ?? '',
        };
      }
    } catch (err: any) {
      logger.debug('Yahoo Finance quote miss', { sym, err: err.message });
    }
  }

  throw new AppError(404, 'QUOTE_NOT_FOUND', `Could not find a quote for symbol "${rawSymbol}". Try adding the exchange suffix (e.g. RELIANCE.NS)`);
}
