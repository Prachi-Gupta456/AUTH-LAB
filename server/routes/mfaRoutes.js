import { Router } from 'express';
import requireAuth from '../middlewares/requireAuth.js';
import {validate} from '../middlewares/validate.js';
import { mfaLimiter } from '../middlewares/rateLimiter.js';
import { codeSchema, mfaLoginSchema, disableSchema } from '../validators/mfa.validator.js';
import * as mfaController from '../controllers/mfaController.js';

const router = Router();

// Public: the user has no access token yet, they only have an mfaToken
router.post('/login-verify', mfaLimiter, validate(mfaLoginSchema), mfaController.loginVerify);

// Everything below needs a logged-in user
router.use(requireAuth);

router.get('/status', mfaController.status);
router.post('/setup', mfaController.setup);
router.post('/verify-setup', mfaLimiter, validate(codeSchema), mfaController.verifySetup);
router.post('/disable', mfaLimiter, validate(disableSchema), mfaController.disable);
router.post('/backup-codes', mfaLimiter, validate(codeSchema), mfaController.regenerateBackupCodes);

export default router;