/**
 * HTTP integration test for auth routes.
 * Requires the backend to be running (with real DB).
 * Run: node test-auth-http.js [base_url]
 * Example: node test-auth-http.js http://localhost:3001
 */
const BASE = process.argv[2] || 'http://localhost:3001';

let passed = 0; let failed = 0;
let cookies = '';

function assert(label, condition, extra) {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ ${label}`, extra || ''); failed++; }
}

async function req(method, path, body, cookieHeader) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie') || '';
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, setCookie };
}

async function run() {
  console.log(`\n── Auth HTTP Tests → ${BASE} ──────────────────────\n`);
  const email = `test_${Date.now()}@opseazy.com`;
  const password = 'TestPass123!';

  // 1. Health
  console.log('1. Health check');
  const health = await req('GET', '/api/health');
  assert('server responds', health.status === 200);
  assert('db connected', health.data.db === 'connected');

  // 2. Register
  console.log('\n2. Register');
  const reg = await req('POST', '/api/auth/register', { name: 'Test User', email, password });
  assert('register 201', reg.status === 201, reg.data);
  assert('user returned', reg.data.user?.email === email);
  assert('access cookie set', reg.setCookie.includes('access_token'));
  cookies = reg.setCookie.split(',').map(c => c.split(';')[0]).join('; ');

  // 3. Register duplicate
  console.log('\n3. Duplicate registration');
  const reg2 = await req('POST', '/api/auth/register', { name: 'Test', email, password });
  assert('duplicate returns 409', reg2.status === 409);

  // 4. GET /me with cookie
  console.log('\n4. GET /api/auth/me');
  const me = await req('GET', '/api/auth/me', null, cookies);
  assert('me returns 200', me.status === 200, me.data);
  assert('me email correct', me.data.user?.email === email);

  // 5. GET /me without token
  console.log('\n5. Protected route without token');
  const meUnauth = await req('GET', '/api/auth/me');
  assert('returns 401 without token', meUnauth.status === 401);

  // 6. Logout
  console.log('\n6. Logout');
  const logout = await req('POST', '/api/auth/logout', null, cookies);
  assert('logout 200', logout.status === 200);

  // 7. Login
  console.log('\n7. Login');
  const login = await req('POST', '/api/auth/login', { email, password });
  assert('login 200', login.status === 200, login.data);
  assert('user returned on login', login.data.user?.email === email);
  assert('access cookie on login', login.setCookie.includes('access_token'));
  cookies = login.setCookie.split(',').map(c => c.split(';')[0]).join('; ');

  // 8. Wrong password
  console.log('\n8. Wrong credentials');
  const bad = await req('POST', '/api/auth/login', { email, password: 'wrongpassword' });
  assert('wrong password returns 401', bad.status === 401);

  // 9. Refresh token
  console.log('\n9. Token refresh');
  const refresh = await req('POST', '/api/auth/refresh', null, cookies);
  assert('refresh 200', refresh.status === 200, refresh.data);
  assert('user returned on refresh', refresh.data.user?.email === email);

  // 10. Validation
  console.log('\n10. Input validation');
  const badEmail = await req('POST', '/api/auth/register', { name: 'X', email: 'notanemail', password: 'pass' });
  assert('invalid email returns 422', badEmail.status === 422);
  const shortPw = await req('POST', '/api/auth/register', { name: 'X', email: 'new@test.com', password: '123' });
  assert('short password returns 422', shortPw.status === 422);

  console.log(`\n── Results: ${passed} passed, ${failed} failed ──────────────────\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error('Test error:', err.message); process.exit(1); });
