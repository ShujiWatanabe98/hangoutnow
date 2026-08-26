const CACHE='minnade-kaigo-v2';
const ASSETS=['/minnade-kaigo/','/minnade-kaigo/styles.css','/minnade-kaigo/personas.js','/minnade-kaigo/app.js','/minnade-kaigo/manifest.json','/minnade-kaigo/icon.svg','/minnade-kaigo/personas/demo1-aoki-kazuko.png','/minnade-kaigo/personas/demo2-yoshida-osamu.png','/minnade-kaigo/personas/demo3-fujimoto-chiyo.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('fetch',event=>event.respondWith(fetch(event.request).catch(()=>caches.match(event.request))));
