import { Router } from 'express';
import * as oauthController from '../controllers/oauthController.js';

const router = Router();

router.get('/:provider', oauthController.start);
router.get('/:provider/callback', oauthController.callback);

export default router;