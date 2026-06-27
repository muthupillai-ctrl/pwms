import { Router } from 'express';
import { AccountsController } from './accounts.controller';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { createAccountSchema, updateAccountSchema, updateBalanceSchema } from './accounts.schemas';

const router = Router();

router.use(authenticate);

router.get('/',              AccountsController.list);
router.post('/',             validate(createAccountSchema),  AccountsController.create);
router.get('/:id',           AccountsController.getOne);
router.patch('/:id',         validate(updateAccountSchema),  AccountsController.update);
router.patch('/:id/balance', validate(updateBalanceSchema),  AccountsController.updateBalance);
router.delete('/:id',        AccountsController.remove);

export { router as accountsRouter };
