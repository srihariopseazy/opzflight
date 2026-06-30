/**
 * Auth integration smoke test — runs without a real DB.
 * Tests JWT token generation, verification, and middleware logic.
 * Run: node test-auth.js
 */
require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_for_auth_test_32chars!!';

const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { signAccess, signRefresh, verifyRefresh } = require('./src/utils/tokens');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ ${label}`); failed++; }
}

async function run() {
  console.log('\n── Auth Unit Tests ──────────────────────────────────\n');

  // 1. bcrypt
  console.log('1. Password hashing');
  const hash = await bcrypt.hash('MyPassword123', 12);
  assert('hash is generated', hash.startsWith('$2a$'));
  assert('correct password matches', await bcrypt.compare('MyPassword123', hash));
  assert('wrong password rejected', !(await bcrypt.compare('wrongpassword', hash)));

  // 2. Access token
  console.log('\n2. Access token (JWT)');
  const payload = { id: 42, email: 'test@opseazy.com', name: 'Test User', role: 'user' };
  const accessToken = signAccess(payload);
  assert('access token is a string', typeof accessToken === 'string');
  const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
  assert('decoded id matches',    decoded.id === 42);
  assert('decoded email matches', decoded.email === 'test@opseazy.com');
  assert('decoded role matches',  decoded.role === 'user');

  // 3. Refresh token
  console.log('\n3. Refresh token');
  const refreshToken = signRefresh({ id: 42 });
  assert('refresh token is a string', typeof refreshToken === 'string');
  const rdecoded = verifyRefresh(refreshToken);
  assert('refresh decoded id matches', rdecoded.id === 42);

  // 4. Token tampering
  console.log('\n4. Token tampering / invalid tokens');
  try {
    jwt.verify(accessToken + 'tampered', process.env.JWT_SECRET);
    assert('tampered token rejected', false);
  } catch {
    assert('tampered token rejected', true);
  }
  try {
    jwt.verify('garbage.token.here', process.env.JWT_SECRET);
    assert('garbage token rejected', false);
  } catch {
    assert('garbage token rejected', true);
  }

  // 5. Middleware logic (simulate req/res)
  console.log('\n5. authenticate middleware');
  const { authenticate } = require('./src/middleware/authenticate');
  const mockReq  = { cookies: { access_token: accessToken }, headers: {} };
  const mockRes  = { status: (c) => ({ json: (b) => { mockRes._status = c; mockRes._body = b; } }) };
  let nextCalled = false;
  authenticate(mockReq, mockRes, () => { nextCalled = true; });
  assert('next() called for valid token', nextCalled);
  assert('req.user populated',           mockReq.user?.id === 42);

  const mockReqBad = { cookies: {}, headers: {} };
  let nextCalledBad = false;
  authenticate(mockReqBad, mockRes, () => { nextCalledBad = true; });
  assert('next() NOT called without token', !nextCalledBad);
  assert('401 returned without token',      mockRes._status === 401);

  // 6. Admin middleware
  console.log('\n6. requireAdmin middleware');
  const { requireAdmin } = require('./src/middleware/authenticate');
  const adminToken = signAccess({ id: 1, email: 'admin@opseazy.com', name: 'Admin', role: 'admin' });
  const adminReq  = { cookies: { access_token: adminToken }, headers: {} };
  const adminRes  = { status: (c) => ({ json: (b) => { adminRes._status = c; adminRes._body = b; } }) };
  let adminNextCalled = false;
  requireAdmin(adminReq, adminRes, () => { adminNextCalled = true; });
  assert('admin next() called for admin role', adminNextCalled);

  const userReq  = { cookies: { access_token: accessToken }, headers: {} };
  const userRes  = { status: (c) => ({ json: (b) => { userRes._status = c; userRes._body = b; } }) };
  let userNextCalled = false;
  requireAdmin(userReq, userRes, () => { userNextCalled = true; });
  assert('admin next() NOT called for user role', !userNextCalled);
  assert('403 returned for non-admin',            userRes._status === 403);

  console.log(`\n── Results: ${passed} passed, ${failed} failed ──────────────────\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error('Test runner error:', err); process.exit(1); });
