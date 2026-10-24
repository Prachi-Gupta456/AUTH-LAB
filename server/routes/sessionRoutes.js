import { Router } from 'express';
import requireAuth from '../middlewares/requireAuth.js';
import {validate} from '../middlewares/validate.js';
import { sessionIdSchema, revokeAllSchema } from '../validators/session.validator.js';
import * as sessionController from '../controllers/sessionController.js';

const router = Router();

router.use(requireAuth); // every route below is protected

router.get('/', sessionController.list);
router.delete('/', validate(revokeAllSchema), sessionController.revokeAll);
router.delete('/:id', validate(sessionIdSchema), sessionController.revokeOne);

export default router;