import { Router } from 'express';
import { PortfolioController } from './portfolio.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();

router.use(authenticate);

router.get('/summary', PortfolioController.getSummary);

export { router as portfolioRouter };
