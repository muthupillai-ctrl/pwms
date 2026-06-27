import { Router } from 'express';
import { LoansController } from './loans.controller';
import { authenticate, requireOwner } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { createLoanSchema, updateLoanSchema, recordRepaymentSchema, addRepaymentSchema } from './loans.schemas';

const router = Router();
router.use(authenticate);

// ── Loan-user read endpoints (any authenticated role) ─────
router.get('/my',         LoansController.myLoans);
router.get('/my/:id/repayments', LoansController.myRepayments);

// ── Owner-only endpoints ─────────────────────────────────
router.get('/',    requireOwner, LoansController.list);
router.post('/',   requireOwner, validate(createLoanSchema), LoansController.create);

// Static repayment routes before /:id
router.delete('/repayments/:repaymentId', requireOwner, LoansController.deleteRepayment);
router.get('/:id/repayments',             requireOwner, LoansController.listRepayments);
router.post('/:id/repayments', requireOwner, validate(addRepaymentSchema), LoansController.addRepayment);

router.get('/:id',             requireOwner, LoansController.getOne);
router.patch('/:id',           requireOwner, validate(updateLoanSchema),      LoansController.update);
router.patch('/:id/repayment', requireOwner, validate(recordRepaymentSchema), LoansController.recordRepayment);
router.delete('/:id',          requireOwner, LoansController.remove);

export { router as loansRouter };
