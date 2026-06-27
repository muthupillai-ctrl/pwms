import { Router } from 'express';
import { SipController } from './sip.controller';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { createSipSchema, updateSipSchema } from './sip.schemas';

const router = Router();
router.use(authenticate);

router.get('/',       SipController.list);
router.post('/',      validate(createSipSchema), SipController.create);
router.patch('/:id',  validate(updateSipSchema),  SipController.update);
router.delete('/:id', SipController.remove);

export { router as sipRouter };
