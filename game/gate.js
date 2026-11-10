/* PING PONG MASTER 公開版：無料2回＋購入コードでフル版 */
(function(){
  var FREE = 2, KEY = 'ppm-free-plays', LKEY = 'ppm-license', PID = 'ppm-game';
  var product = null, installEvt = null;
  fetch('../products.json', { cache: 'no-store' }).then(function(r){ return r.json(); }).then(function(l){ product = l.find(function(p){ return p.id === PID; }) || null; if (typeof SCREEN !== 'undefined' && SCREEN === 'title' && window.PPM_AFTER_TITLE) window.PPM_AFTER_TITLE(); }).catch(function(){});
  function lic(){ try { return JSON.parse(localStorage.getItem(LKEY) || 'null'); } catch(e){ return null; } }
  function used(){ try { return +(localStorage.getItem(KEY) || 0); } catch(e){ return 0; } }
  function price(){ return product && product.price ? '¥' + Number(product.price).toLocaleString('ja-JP') : '¥500'; }
  function buyHref(){ if (!product || !product.paymentLink) return ''; var u = new URL(product.paymentLink); u.searchParams.set('client_reference_id', PID); return u.toString(); }
  function e(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  window.PPM_GATE = function(){
    if (lic()) return true;
    var n = used();
    if (n < FREE) {
      try { localStorage.setItem(KEY, String(n + 1)); } catch(err){}
      setTimeout(function(){ try { say('無料プレイ ' + (n + 1) + '回目（のこり' + (FREE - n - 1) + '回）。気に入ったら' + price() + 'でフル版に。', 'FREE PLAY'); } catch(err){} }, 1600);
      return true;
    }
    showPaywall();
    return false;
  };

  window.showPaywall = function(msg){
    var href = buyHref();
    show('paywall', '<button class="btn sm back" data-act="title">← メニュー</button>' +
      '<div class="card"><h2>' + (msg ? e(msg) : '無料プレイは終わりました') + '</h2>' +
      '<p class="hint">フル版にすると、練習・試合・大会・リーグ戦・ランキング挑戦がすべて、回数の制限なしで遊べます。買い切りなので、追加の料金はかかりません。</p>' +
      '<div class="big" style="color:var(--gold)">' + price() + '</div>' +
      (href ? '<a class="btn pri" style="text-align:center;text-decoration:none" href="' + e(href) + '" target="_top">購入する（カード決済）</a>' : '<button class="btn pri" disabled>準備中（まだ購入できません）</button>') +
      '<p class="hint">お支払いが終わると、購入完了ページで自動的にフル版になります。デジタル商品のため、購入後の返品・キャンセルはできません（不具合で遊べない場合は返金します）。<a href="../legal/tokushoho.html" target="_top" style="color:var(--ao)">特定商取引法に基づく表記</a>・<a href="../legal/terms.html" target="_top" style="color:var(--ao)">利用規約</a></p></div>' +
      '<div class="card"><h3>購入コードをお持ちの方</h3><p class="hint">ほかの端末で購入した方は、購入コードを入力するとこの端末もフル版になります。</p>' +
      '<input type="text" id="ppmCode" placeholder="ppm-game.xxxx.xxxx" autocomplete="off">' +
      '<div class="row"><button class="btn pri" id="ppmVerify">フル版にする</button><span class="status" id="ppmSt"></span></div>' +
      '<p class="hint"><a href="../restore.html" target="_top" style="color:var(--ao)">購入コードを忘れた方（再表示）</a></p></div>');
  };

  document.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('#ppmVerify, [data-act="paywall"]');
    if (!b) return;
    if (b.dataset.act === 'paywall') { showPaywall('フル版にする'); return; }
    var code = (document.getElementById('ppmCode').value || '').trim(), st = document.getElementById('ppmSt');
    if (!code) { st.textContent = '購入コードを入力してください。'; return; }
    st.textContent = '確認しています…';
    fetch('../api/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: code }) })
      .then(function(r){ return r.json(); })
      .then(function(d){
        if (d && d.ok && d.pid === PID) { try { localStorage.setItem(LKEY, JSON.stringify({ code: code, pid: PID, at: Date.now() })); } catch(err){} st.textContent = 'フル版になりました！'; setTimeout(showTitle, 800); }
        else st.textContent = '購入コードが正しくありません。コピーし直してお試しください。';
      })
      .catch(function(){ st.textContent = '通信できませんでした。ネットにつないでもう一度お試しください。'; });
  });

  window.PPM_AFTER_TITLE = function(){
    var brand = document.querySelector('#sheet .brand'); if (!brand || brand.querySelector('.ppm-chip')) return;
    var d = document.createElement('div'); d.className = 'ppm-chip'; d.style.cssText = 'margin-top:10px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;align-items:center';
    var back = '<a class="btn sm" href="../index.html" target="_top" style="text-decoration:none">サイトへ戻る</a>';
    if (lic()) d.innerHTML = '<span class="chip on">フル版</span>' + back;
    else d.innerHTML = '<span class="chip">無料プレイ のこり' + Math.max(0, FREE - used()) + '回</span><button class="btn sm pri" data-act="paywall">フル版にする ' + price() + '</button>' + back;
    brand.appendChild(d);
  };

  /* ホーム画面に追加（公開版） */
  window.addEventListener('beforeinstallprompt', function(ev){ ev.preventDefault(); installEvt = ev; });
  window.showInstall = function(){
    var ua = navigator.userAgent || '', ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    var steps = ios
      ? ['Safariでこのページを開いています（ほかのアプリの中で開いている場合は、Safariで開き直してください）。', '共有ボタン（四角から上向きの矢印）を押します。', '「ホーム画面に追加」を選び、「追加」を押します。', 'ホーム画面の「PING PONG」アイコンから起動できます。一度開けば、ネットがなくても遊べます。']
      : ['下の「インストール」ボタンを押します（表示されない場合は、ブラウザのメニューから「アプリをインストール」または「ホーム画面に追加」を選びます）。', 'ホーム画面やデスクトップの「PING PONG」アイコンから起動できます。一度開けば、ネットがなくても遊べます。'];
    show('install', '<button class="btn sm back" data-act="title">← メニュー</button><div class="card"><h2>ホーム画面に追加</h2><ol style="margin:0;padding-left:1.3em;display:flex;flex-direction:column;gap:8px;font-size:14px;line-height:1.6">' +
      steps.map(function(s){ return '<li>' + e(s) + '</li>'; }).join('') + '</ol>' +
      (!ios ? '<div class="row"><button class="btn pri" id="ppmInstall"' + (installEvt ? '' : ' disabled') + '>インストール</button><span class="status">' + (installEvt ? '' : 'このブラウザではメニューから追加してください。') + '</span></div>' : '') + '</div>');
  };
  document.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('#ppmInstall'); if (!b || !installEvt) return;
    installEvt.prompt(); installEvt.userChoice.finally(function(){ installEvt = null; b.disabled = true; });
  });

  /* 保存してある購入コードを、たまに確認（無効と分かったときだけ外す） */
  var L = lic();
  if (L && L.code && navigator.onLine) {
    fetch('../api/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: L.code }) })
      .then(function(r){ return r.json(); }).then(function(d){ if (d && d.ok === false && !d.reason) { localStorage.removeItem(LKEY); } }).catch(function(){});
  }

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function(){});
})();
