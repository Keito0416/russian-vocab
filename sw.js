/* ロシア語単語帳：電波がなくても開けるように、中身をスマホに保存しておく仕組み。
   電波があれば新しい版を取りに行き、なければ保存してある版を出す。
   中身を直して送るたびに、下の VERSION の数字を1つ上げる（古い保存を片付けるため）。 */
const VERSION='v5';
const CACHE='rv-'+VERSION;
const FILES=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',e=>{
  // 前の版の保存を消して、開いている画面にもすぐ新しい仕組みを効かせる
  e.waitUntil(
    caches.keys()
      .then(ks=>Promise.all(ks.filter(k=>k.startsWith('rv-')&&k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  const req=e.request;
  // このアプリ自身のファイルだけを扱う。YouGlish などの外のリンクには手を出さない
  if(req.method!=='GET'||new URL(req.url).origin!==location.origin) return;
  // 保存してある版。ページそのものを開く要求なら、保存がなくても index.html を出す
  const saved=()=>caches.match(req,{ignoreSearch:true}).then(r=>r||(req.mode==='navigate'?caches.match('index.html'):undefined));
  // 新しい版を取りに行き、取れたら保存も入れ替える
  const net=fetch(req,{cache:'no-cache'}).then(res=>{
    if(!res||!res.ok) return res;
    const copy=res.clone();
    return caches.open(CACHE).then(c=>c.put(req,copy)).then(()=>res);
  });
  // 電波が弱くて返事が来ないときは、4秒で見切って保存してある版を出す（新しい版は裏で取り続ける）
  const slow=new Promise(r=>setTimeout(r,4000)).then(saved).then(r=>r||net);
  e.respondWith(Promise.race([net.catch(()=>saved().then(r=>r||Response.error())),slow]));
  e.waitUntil(net.catch(()=>{}));
});
