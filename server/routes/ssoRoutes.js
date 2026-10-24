import { Router } from 'express';
import requireAuth from '../middlewares/requireAuth.js';
import {validate} from '../middlewares/validate.js';
import { ssoTokenLimiter } from '../middlewares/rateLimiter.js';
import {
  authorizeQuerySchema,
  decisionSchema,
  tokenSchema,
  createClientSchema,
  clientIdParamSchema,
} from '../validators/sso.validator.js';
import * as ssoController from '../controllers/ssoController.js';

const router = Router();

// Client app's server talks to these (no user login, the client authenticates itself)
router.post('/token', ssoTokenLimiter, validate(tokenSchema), ssoController.token);
router.get('/userinfo', ssoController.userinfo);

// Everything below: a logged-in Auth Lab user
router.use(requireAuth);

router.get('/authorize/validate', validate(authorizeQuerySchema), ssoController.validateAuthorize);
router.post('/authorize/decision', validate(decisionSchema), ssoController.decision);

router.post('/clients', validate(createClientSchema), ssoController.createClient);
router.get('/clients', ssoController.listClients);
router.delete('/clients/:id', validate(clientIdParamSchema), ssoController.deleteClient);

export default router;