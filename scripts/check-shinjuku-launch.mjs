const publicOrigin = (process.env.HANGOUT_NOW_PUBLIC_ORIGIN || 'https://method-more.com').replace(/\/$/, '');
const apiOrigin = (process.env.HANGOUT_NOW_API_ORIGIN || 'https://hangoutnow-api.onrender.com').replace(/\/$/, '');
const cacheBust = Date.now().toString(36);

const checks = [
  {
    name: 'API health',
    url: `${apiOrigin}/health`,
    markers: ['"status":"ok"', '"service":"hangout-now-api"'],
  },
  {
    name: 'First-member page',
    url: `${publicOrigin}/shinjuku-first-members.html`,
    markers: ['index,follow,max-image-preview:large', '新宿の先行参加メンバー募集', '"@type": "WebPage"'],
  },
  {
    name: 'Cafe guide',
    url: `${publicOrigin}/shinjuku-cafe-friends.html`,
    markers: ['新宿でカフェ仲間を探す', 'guide-cafe-search', '"@type": "Article"'],
  },
  {
    name: 'Registration page',
    url: `${publicOrigin}/app.html?mode=register`,
    markers: ['app.js?v=20260821-104', 'attribution.js?v=20260821-2'],
  },
  {
    name: 'Sitemap',
    url: `${publicOrigin}/sitemap.xml`,
    markers: ['shinjuku-first-members.html', 'shinjuku-cafe-friends.html'],
  },
  {
    name: 'Acquisition allowlist',
    url: `${publicOrigin}/attribution.js?v=20260821-2`,
    markers: ['method-more', 'organic-search', 'hangout-now-analytics-consent'],
  },
];

const inspect = async (check) => {
  const url = new URL(check.url);
  url.searchParams.set('launch_check', cacheBust);
  try {
    const response = await fetch(url, {
      headers: { accept: 'text/html,application/json,application/xml,text/javascript;q=0.9,*/*;q=0.8' },
      signal: AbortSignal.timeout(30_000),
    });
    const body = await response.text();
    const missing = check.markers.filter((marker) => !body.includes(marker));
    return {
      name: check.name,
      status: response.status,
      result: response.ok && missing.length === 0 ? 'OK' : 'NG',
      detail: response.ok ? (missing.length ? `missing: ${missing.join(', ')}` : 'markers verified') : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      name: check.name,
      status: '-',
      result: 'NG',
      detail: error instanceof Error ? error.message : 'request failed',
    };
  }
};

const results = await Promise.all(checks.map(inspect));
console.table(results);
if (results.some((result) => result.result !== 'OK')) process.exitCode = 1;
