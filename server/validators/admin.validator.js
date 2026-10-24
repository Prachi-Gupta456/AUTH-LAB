import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(50).default(20); // hard cap: no "limit=1000000"

export const listUsersSchema = z.object({
  query: z.object({ page, limit, q: z.string().trim().max(100).optional() }),
});

export const userIdSchema = z.object({ params: z.object({ id: objectId }) });

export const setRoleSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({ role: z.enum(['user', 'moderator', 'admin']) }),
});

export const auditQuerySchema = z.object({
  query: z.object({ page, limit, userId: objectId.optional(), event: z.string().max(50).optional() }),
});