import { Router } from 'express';
import requireAuth from '../middlewares/requireAuth.js';
import requirePermission from '../middlewares/requirePermission.js';
import {validate} from '../middlewares/validate.js';
import {
  listUsersSchema, userIdSchema, setRoleSchema, auditQuerySchema,
} from '../validators/admin.validator.js';
import * as admin from '../controllers/adminController.js';

const router = Router();
router.use(requireAuth);

router.get('/users', requirePermission('users:read'), validate(listUsersSchema), admin.listUsers);
router.post('/users/:id/unlock', requirePermission('users:unlock'), validate(userIdSchema), admin.unlock);
router.post('/users/:id/revoke-sessions', requirePermission('users:revoke_sessions'), validate(userIdSchema), admin.revokeSessions);
router.patch('/users/:id/role', requirePermission('users:set_role'), validate(setRoleSchema), admin.setRole);
router.get('/audit', requirePermission('audit:read'), validate(auditQuerySchema), admin.auditLog);

export default router;