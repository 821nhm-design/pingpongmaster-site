/* PingPongMaster 共通スクリプト（ヘッダー・フッター・配色切替・商品データ） */
(function(){
  const S = window.SHOP || {};
  const root = document.documentElement.dataset.root || '';
  const CATS = { game:'ゲーム', app:'アプリ', document:'資料・PDF', slides:'プレゼン資料', video:'動画', image:'画像・素材', technique:'卓球の技術', gear:'卓球用具', care:'介護', music:'音楽', other:'その他' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const yen = n => '¥' + Number(n || 0).toLocaleString('ja-JP');
  async function products(){
    try { const r = await fetch(root + 'products.json', { cache:'no-store' }); const all = await r.json(); return all.filter(p => p.status !== 'draft'); }
    catch(e){ return []; }
  }
  function buyUrl(p){
    if (!p.paymentLink) return '';
    const u = new URL(p.paymentLink);
    u.searchParams.set('client_reference_id', p.id);
    return u.toString();
  }
  /* 配色：標準（紺×青緑）と 琉球（砂浜・海・ハイビスカス） */
  const SKIN_KEY = 'ppm-skin';
  function getSkin(){ try { return localStorage.getItem(SKIN_KEY) || 'neon'; } catch(e){ return 'neon'; } }
  function applySkin(s){ if (s === 'ryukyu') document.documentElement.dataset.skin = 'ryukyu'; else delete document.documentElement.dataset.skin; }
  applySkin(getSkin());

  function header(){
    const here = location.pathname.split('/').pop() || 'index.html';
    const L = [['index.html','ホーム'],['pr.html','動画'],['learn.html','技を学ぶ'],['game/','ゲーム'],['store.html','ストア'],['restore.html','購入した商品']];
    const h = document.createElement('header'); h.className = 'site';
    h.innerHTML = `<div class="wrap"><a class="logo" href="${root}index.html">${esc(S.name || 'PingPongMaster')}</a>
      <button class="menu-btn" type="button" aria-expanded="false" aria-controls="mainnav">メニュー</button>
      <nav class="links" id="mainnav" aria-label="メニュー">${L.map(([u,t]) => `<a href="${root}${u}"${here === u ? ' aria-current="page"' : ''}>${t}</a>`).join('')}${S.lineUrl ? `<a class="line" href="${esc(S.lineUrl)}" target="_blank" rel="noopener">LINE</a>` : ''}
      <button class="skin" type="button" id="skinBtn"></button></nav></div>`;
    document.body.prepend(h);
    const btn = h.querySelector('#skinBtn');
    const label = () => { btn.textContent = getSkin() === 'ryukyu' ? '配色：琉球' : '配色：ネオン'; };
    label();
    btn.addEventListener('click', () => { const n = getSkin() === 'ryukyu' ? 'neon' : 'ryukyu'; try { localStorage.setItem(SKIN_KEY, n); } catch(e){} applySkin(n); label(); });
    const mb = h.querySelector('.menu-btn'), nav = h.querySelector('nav.links');
    mb.addEventListener('click', () => { const o = nav.classList.toggle('open'); mb.setAttribute('aria-expanded', String(o)); });
  }
  function footer(){
    const soc = [['youtubeUrl','YouTube'],['xUrl','X'],['instagramUrl','Instagram'],['lineUrl','LINE']].filter(([k]) => S[k]);
    const f = document.createElement('footer'); f.className = 'site';
    f.innerHTML = `<div class="wrap"><div style="display:flex;flex-direction:column;gap:6px"><span>© ${new Date().getFullYear()} ${esc(S.seller || S.name || '')}${S.email ? '　お問い合わせ：' + esc(S.email) : ''}</span>${soc.length ? `<span class="social">${soc.map(([k,t]) => `<a href="${esc(S[k])}" target="_blank" rel="noopener">${t}</a>`).join('')}</span>` : ''}</div>
      <nav aria-label="規約"><a href="${root}legal/tokushoho.html">特定商取引法に基づく表記</a><a href="${root}legal/privacy.html">プライバシーポリシー</a><a href="${root}legal/terms.html">利用規約</a></nav></div>`;
    document.body.append(f);
  }
  window.STORE = { S, CATS, esc, yen, products, buyUrl, root };
  document.addEventListener('DOMContentLoaded', () => { header(); footer(); document.title = document.title.replace('{shop}', S.name || 'PingPongMaster'); });
})();
