import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid QR id');
const secret = z.string().min(20, 'Invalid secret').max(100, 'Invalid secret');

export const qrIdSchema = z.object({ params: z.object({ id: objectId }) });
export const qrActionSchema = z.object({ body: z.object({ id: objectId, secret }) });