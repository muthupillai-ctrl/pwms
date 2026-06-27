import { Router } from 'express';
import { BondsController } from './bonds.controller';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { createBondSchema, updateBondSchema, updateBondPriceSchema, addPayoutSchema } from './bonds.schemas';

const router = Router();

router.use(authenticate);

router.get('/',                                                      BondsController.list);
router.post('/',                    validate(createBondSchema),      BondsController.create);
router.delete('/payouts/:payoutId',                                  BondsController.deletePayout);
router.get('/:id',                                                   BondsController.getOne);
router.patch('/:id',                validate(updateBondSchema),      BondsController.update);
router.patch('/:id/price',          validate(updateBondPriceSchema), BondsController.updatePrice);
router.delete('/:id',                                                BondsController.remove);
router.post('/:bondId/payouts',     validate(addPayoutSchema),       BondsController.addPayout);

export { router as bondsRouter };
