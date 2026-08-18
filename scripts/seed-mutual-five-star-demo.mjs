const baseUrl = process.env.HANGOUTNOW_API_URL || 'https://hangoutnow-api.onrender.com';
const password = process.env.HANGOUTNOW_DEMO_PASSWORD || 'HangoutNow-Demo-2026!';

async function call(path, options = {}, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} -> ${response.status}: ${text}`);
  return body;
}

async function login(email) {
  return call('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

const host = await login('demo-host@hangoutnow.example');
const member = await login('demo-masaya@hangoutnow.example');
const hostRooms = await call('/chat-rooms', {}, host.accessToken);
const room = hostRooms.find((item) => item.members.some((user) => user.id === member.user.id));
if (!room) throw new Error('主催者と参加者の共通Hangoutが見つかりません');

const hangout = await call(`/hangouts/${room.hangout.id}`, {}, host.accessToken);
if (['OPEN', 'FULL'].includes(hangout.status)) await call(`/hangouts/${hangout.id}/start`, { method: 'POST', body: '{}' }, host.accessToken);
if (hangout.status !== 'FINISHED') await call(`/hangouts/${hangout.id}/finish`, { method: 'POST', body: '{}' }, host.accessToken);

await call(`/hangouts/${hangout.id}/ratings`, { method: 'POST', body: JSON.stringify({ ratedUserId: member.user.id, score: 5 }) }, host.accessToken);
await call(`/hangouts/${hangout.id}/ratings`, { method: 'POST', body: JSON.stringify({ ratedUserId: host.user.id, score: 5 }) }, member.accessToken);

const direct = await call('/direct-chats', { method: 'POST', body: JSON.stringify({ userId: member.user.id }) }, host.accessToken);
const messages = await call(`/direct-chats/${direct.id}/messages`, {}, host.accessToken);
if (!messages.some((message) => message.body === '相互★5で1対1トークが解放されました。')) {
  await call(`/direct-chats/${direct.id}/messages`, { method: 'POST', body: JSON.stringify({ body: '相互★5で1対1トークが解放されました。' }) }, host.accessToken);
}

const [hostDirects, memberDirects] = await Promise.all([
  call('/direct-chats', {}, host.accessToken),
  call('/direct-chats', {}, member.accessToken),
]);
if (!hostDirects.some((item) => item.id === direct.id) || !memberDirects.some((item) => item.id === direct.id)) {
  throw new Error('1対1トークが双方に表示されません');
}

process.stdout.write(`${JSON.stringify({ ok: true, hangoutId: hangout.id, directChatId: direct.id, mutualRating: 5, visibleToBoth: true }, null, 2)}\n`);
