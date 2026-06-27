import { Router } from 'express';
import { StocksController } from './stocks.controller';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { createStockSchema, updateStockSchema, updatePriceSchema } from './stocks.schemas';

const router = Router();

router.use(authenticate);

router.get('/',                    StocksController.list);
router.post('/',                   validate(createStockSchema), StocksController.create);
router.get('/quote/:symbol',       StocksController.quote);
router.get('/:id',                 StocksController.getOne);
router.patch('/:id',               validate(updateStockSchema), StocksController.update);
router.patch('/:id/price',         validate(updatePriceSchema), StocksController.updatePrice);
router.delete('/:id',              StocksController.remove);

export { router as stocksRouter };
