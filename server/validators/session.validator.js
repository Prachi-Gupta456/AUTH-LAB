import { z } from 'zod';

// Mongo ObjectId = 24 hex characters.
// Validating here stops invalid ids from reaching Mongoose (which would throw a CastError).
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid session id');

export const sessionIdSchema = z.object({
  params: z.object({ id: objectId }),
});

export const revokeAllSchema = z.object({
  query: z.object({
    includeCurrent: z.enum(['true', 'false']).optional(),
  }),
});