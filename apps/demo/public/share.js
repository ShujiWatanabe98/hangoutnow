(() => {
  const shareable = /^\/(news(?:-[a-z-]+)?|shinjuku-drinking-friends|shinjuku-cafe-friends|shibuya-cafe-friends|tokyo-running-friends|find-friends-now|hobby-friends-nearby|shinjuku-working-adult-friends|shinjuku-first-members)\.html$/.test(location.pathname);
  if (!shareable) return;
  const main = document.querySelector('main');
  const canonical = document.querySelector('link[rel="canonical"]')?.href || location.href;
  const title = document.querySelector('meta[property="og:title"]')?.content || document.title;
  const campaign = location.pathname.startsWith('/shinjuku-') ? 'shinjuku-launch-202609' : 'page-share-202608';
  if (!main) return;
  const trackedUrl = (network) => {
    const url = new URL(canonical);
    url.searchParams.set('utm_source', network);
    url.searchParams.set('utm_medium', network === 'web_share' ? 'referral' : 'organic-social');
    url.searchParams.set('utm_campaign', campaign);
    url.searchParams.set('utm_id', campaign);
    url.searchParams.set('utm_source_platform', network);
    url.searchParams.set('utm_content', location.pathname.replace(/^\//, '').replace(/\.html$/, ''));
    return url.toString();
  };
  const section = document.createElement('section');
  section.className = 'share-panel';
  section.setAttribute('aria-label', 'このページを共有');
  section.innerHTML = `<strong>このページを共有</strong><div><a data-share-network="x" target="_blank" rel="noopener noreferrer">X</a><a data-share-network="line" target="_blank" rel="noopener noreferrer">LINE</a><a data-share-network="facebook" target="_blank" rel="noopener noreferrer">Facebook</a><button type="button" data-share-network="copy">リンクをコピー</button>${navigator.share ? '<button type="button" data-share-network="native">その他</button>' : ''}</div><p class="share-status" role="status" aria-live="polite"></p>`;
  section.querySelector('[data-share-network="x"]').href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(trackedUrl('x'))}`;
  section.querySelector('[data-share-network="line"]').href = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(trackedUrl('line'))}`;
  section.querySelector('[data-share-network="facebook"]').href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(trackedUrl('facebook'))}`;
  section.querySelector('[data-share-network="copy"]').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const status = section.querySelector('.share-status');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(trackedUrl('web_share'));
      button.textContent = 'コピー済み';
      status.textContent = '募集ページのリンクをコピーしました。';
    } catch {
      status.textContent = 'コピーできませんでした。共有先を選ぶか、ブラウザのアドレスをコピーしてください。';
    }
  });
  section.querySelector('[data-share-network="native"]')?.addEventListener('click', async () => {
    try { await navigator.share({ title, url: trackedUrl('web_share') }); } catch { /* User cancelled the share sheet. */ }
  });
  main.append(section);
})();
