import { Router } from 'express';
import { FdController } from './fd.controller';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { createFdSchema, updateFdSchema } from './fd.schemas';

const router = Router();

router.use(authenticate);

router.get('/',      FdController.list);
router.post('/',     validate(createFdSchema), FdController.create);
router.get('/:id',   FdController.getOne);
router.patch('/:id', validate(updateFdSchema), FdController.update);
router.delete('/:id', FdController.remove);

export { router as fdRouter };
