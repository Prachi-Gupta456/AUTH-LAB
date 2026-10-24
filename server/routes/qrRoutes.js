import { Router } from 'express';
import requireAuth from '../middlewares/requireAuth.js';
import {validate} from '../middlewares/validate.js';
import { qrGenerateLimiter, qrPollLimiter } from '../middlewares/rateLimiter.js';
import { qrIdSchema, qrActionSchema } from '../validators/qr.validator.js';
import * as qrController from '../controllers/qrController.js';

const router = Router();

// Desktop (no login yet)
router.post('/generate', qrGenerateLimiter, qrController.generate);
router.get('/status/:id', qrPollLimiter, validate(qrIdSchema), qrController.status);

// Phone (already logged in)
router.post('/scan', requireAuth, validate(qrActionSchema), qrController.scan);
router.post('/approve', requireAuth, validate(qrActionSchema), qrController.approve);
router.post('/reject', requireAuth, validate(qrActionSchema), qrController.reject);

export default router;