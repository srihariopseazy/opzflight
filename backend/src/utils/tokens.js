const jwt = require('jsonwebtoken');

const ACCESS_SECRET  = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_SECRET + '_refresh';
const ACCESS_TTL     = process.env.JWT_ACCESS_EXPIRES  || '15m';
const REFRESH_TTL    = process.env.JWT_REFRESH_EXPIRES || '7d';

function signAccess(payload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

function signRefresh(payload) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_TTL });
}

function verifyRefresh(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

function isSecureRequest(req) {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

function issueTokens(res, userPayload, req) {
  const secure  = isSecureRequest(req);
  const access  = signAccess(userPayload);
  const refresh = signRefresh({ id: userPayload.id });
  res.cookie('access_token', access, {
    httpOnly: true,
    sameSite: 'strict',
    secure,
    maxAge: 15 * 60 * 1000,
  });
  res.cookie('refresh_token', refresh, {
    httpOnly: true,
    sameSite: 'strict',
    secure,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });
  return { access, refresh };
}

function clearTokens(res) {
  res.clearCookie('access_token',  { path: '/' });
  res.clearCookie('refresh_token', { path: '/api/auth' });
}

module.exports = { signAccess, signRefresh, verifyRefresh, issueTokens, clearTokens };
