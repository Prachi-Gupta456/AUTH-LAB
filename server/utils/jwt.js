import jwt from "jsonwebtoken"

export const signAccessToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
        expiresIn: process.env.ACCESS_TOKEN_TTL,
    });
}

export const verifyAccessToken = (token) => {
    return jwt.verify(token, process.env.JWT_ACCESS_SECRET)
}

// MFA token uses a DIFFERENT secret from access tokens.
// So an access token can never be passed off as an mfaToken, and vice versa.
export const signMfaToken = (userId) =>
  jwt.sign({ sub: String(userId), purpose: 'mfa' }, process.env.JWT_MFA_SECRET, {
    expiresIn: '5m',
  });

export const verifyMfaToken = (token) => {
  const payload = jwt.verify(token, process.env.JWT_MFA_SECRET);
  if (payload.purpose !== 'mfa') throw new Error('Wrong token type');
  return payload;
};

// SSO tokens use their OWN secret + a "purpose" claim, so an SSO access token can never
// pass as a first-party access token (/auth/me), and an id_token can never act as an access token.
export const signSsoToken = (purpose, claims, expiresIn, audience) =>
  jwt.sign({ ...claims, purpose }, process.env.JWT_SSO_SECRET, {
    expiresIn,
    audience,
    issuer: process.env.SERVER_URL,
  });

export const verifySsoToken = (token, purpose) => {
  const payload = jwt.verify(token, process.env.JWT_SSO_SECRET, { issuer: process.env.SERVER_URL });
  if (payload.purpose !== purpose) throw new Error('Wrong token type');
  return payload;
};