import { ROBOREHA_BASE_PATH } from "@/lib/base-path";

export function BasePathFetch() {
  if (!ROBOREHA_BASE_PATH) return null;
  const script = `(()=>{const b=${JSON.stringify(ROBOREHA_BASE_PATH)};const add=v=>typeof v==='string'&&['/api/','/equipment/','/models/','/wasm/'].some(p=>v.startsWith(p))?b+v:Array.isArray(v)?v.map(add):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,add(x)])):v;const j=Response.prototype.json;Response.prototype.json=async function(){return add(await j.call(this))};const f=window.fetch.bind(window);window.fetch=(i,n)=>{if(typeof i==='string'&&i.startsWith('/api/'))i=b+i;else if(i instanceof Request){const u=new URL(i.url);if(u.origin===location.origin&&u.pathname.startsWith('/api/'))i=new Request(b+u.pathname+u.search,i)}return f(i,n)}})();`;
  return <script id="roboreha-base-path-fetch" dangerouslySetInnerHTML={{ __html: script }} />;
}
