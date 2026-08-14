const baseUrl = process.env.HANGOUTNOW_API_URL || 'https://hangoutnow-api.onrender.com';
const password = process.env.HANGOUTNOW_DEMO_PASSWORD || 'HangoutNow-Demo-2026!';
const loginResponse = await fetch(`${baseUrl}/auth/login`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'demo-host@hangoutnow.example', password }),
});
if (!loginResponse.ok) throw new Error(`Demo login failed: ${loginResponse.status}`);
const session = await loginResponse.json();
const response = await fetch(`${baseUrl}/demo/seed-week-history`, {
  method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session.accessToken}` }, body: '{}',
});
const text = await response.text();
if (!response.ok) throw new Error(`Week history seed failed: ${response.status} ${text}`);
process.stdout.write(`${text}\n`);
