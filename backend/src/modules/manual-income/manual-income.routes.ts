import { Router } from 'express';
import { ManualIncomeController } from './manual-income.controller';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { createManualIncomeSchema } from './manual-income.schemas';

const router = Router();
router.use(authenticate);

router.get('/',       ManualIncomeController.list);
router.post('/',      validate(createManualIncomeSchema), ManualIncomeController.create);
router.delete('/:id', ManualIncomeController.remove);

export { router as manualIncomeRouter };
