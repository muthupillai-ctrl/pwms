import { Router } from 'express';
import { MfController } from './mf.controller';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { createFundSchema, updateFundSchema, addTransactionSchema } from './mf.schemas';

const router = Router();

router.use(authenticate);

router.get('/',                                                      MfController.listFunds);
router.get('/nav/:schemeCode',                                       MfController.getNav);
router.post('/',               validate(createFundSchema),           MfController.createFund);
router.patch('/:id',           validate(updateFundSchema),           MfController.updateFund);
router.delete('/transactions/:txnId',                                MfController.deleteTransaction);
router.delete('/:id',                                                MfController.deleteFund);
router.post('/:fundId/transactions', validate(addTransactionSchema), MfController.addTransaction);

export { router as mfRouter };
