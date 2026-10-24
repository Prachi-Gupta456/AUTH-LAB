import { z } from 'zod';

const str = (max = 500) => z.string().max(max); // z.string() also rejects arrays (?state=a&state=b)

// Loose shape check only. ssoService.parseAuthRequest does the real, ORDERED validation
// (it must decide fatal-vs-redirectable errors, which zod can't).
const authorizeFields = {
  client_id: str(100),
  redirect_uri: str(2000),
  response_type: str(20).optional(),
  scope: str(200).optional(),
  state: str(500).optional(),
  code_challenge: str(100).optional(),
  code_challenge_method: str(10).optional(),
  nonce: str(200).optional(),
};

export const authorizeQuerySchema = z.object({ query: z.object(authorizeFields) });

export const decisionSchema = z.object({
  body: z.object({ ...authorizeFields, approve: z.boolean() }),
});

export const tokenSchema = z.object({
  body: z.object({
    grant_type: str(40),
    code: str(200),
    redirect_uri: str(2000),
    client_id: str(100),
    client_secret: str(200).optional(),
    code_verifier: z.string().min(43).max(128),
  }),
});

// Allowed redirect URIs: https anywhere, http ONLY for localhost, no fragments.
const redirectUri = z
  .string()
  .max(2000)
  .refine((s) => {
    try {
      const u = new URL(s);
      const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
      return (u.protocol === 'https:' || (u.protocol === 'http:' && local)) && !u.hash;
    } catch {
      return false;
    }
  }, 'Must be https:// (http:// only for localhost) and must not contain a #fragment');

export const createClientSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(60),
    redirectUris: z.array(redirectUri).min(1).max(5),
    confidential: z.boolean().default(true),
  }),
});

export const clientIdParamSchema = z.object({
  params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid client id') }),
});