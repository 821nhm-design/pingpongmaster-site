/* PING PONG MASTER 公開版：無料2回＋購入コードでフル版（1台まで・機種変更の引っ越し1回）＋段位認定証 */
(function(){
  var FREE = 2, KEY = 'ppm-free-plays', LKEY = 'ppm-license', DKEY = 'ppm-device', PID = 'ppm-game';
  var SITE = location.origin + '/';
  var product = null, installEvt = null;
  fetch('../products.json', { cache: 'no-store' }).then(function(r){ return r.json(); }).then(function(l){ product = l.find(function(p){ return p.id === PID; }) || null; if (typeof SCREEN !== 'undefined' && SCREEN === 'title' && window.PPM_AFTER_TITLE) window.PPM_AFTER_TITLE(); }).catch(function(){});
  function lic(){ try { return JSON.parse(localStorage.getItem(LKEY) || 'null'); } catch(e){ return null; } }
  function used(){ try { return +(localStorage.getItem(KEY) || 0); } catch(e){ return 0; } }
  function price(){ return product && product.price ? '¥' + Number(product.price).toLocaleString('ja-JP') : '¥500'; }
  function buyHref(){ if (!product || !product.paymentLink) return ''; var u = new URL(product.paymentLink); u.searchParams.set('client_reference_id', PID); return u.toString(); }
  function e(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function device(){
    try {
      var d = localStorage.getItem(DKEY);
      if (!d) { d = (crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2))).replace(/[^A-Za-z0-9-]/g, ''); localStorage.setItem(DKEY, d); }
      return d;
    } catch(err){ return ''; }
  }
  window.PPM_DEVICE = device;

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

  var RULES = '1つの購入コードで遊べるのは<b>1台</b>です。機種変更のときは、新しい端末で入力すると<b>引っ越し</b>できます（<b>1回まで</b>。前の端末では遊べなくなります）。';
  window.showPaywall = function(msg){
    var href = buyHref();
    show('paywall', '<button class="btn sm back" data-act="title">← メニュー</button>' +
      '<div class="card"><h2>' + (msg ? e(msg) : '無料プレイは終わりました') + '</h2>' +
      '<p class="hint">フル版にすると、練習・試合・大会・リーグ戦・ランキング挑戦がすべて、回数の制限なしで遊べます。買い切りなので、追加の料金はかかりません。</p>' +
      '<div style="text-align:center"><span class="chip on">発売記念価格</span></div>' +
      '<div class="big" style="color:var(--gold)">' + price() + '</div>' +
      (href ? '<a class="btn pri" style="text-align:center;text-decoration:none" href="' + e(href) + '" target="_top">購入する（カード決済）</a>' : '<button class="btn pri" disabled>準備中（まだ購入できません）</button>') +
      '<p class="hint">' + RULES + '</p>' +
      '<p class="hint">お支払いが終わると、購入完了ページで自動的にこの端末がフル版になります。デジタル商品のため、購入後の返品・キャンセルはできません（不具合で遊べない場合は返金します）。<a href="../legal/tokushoho.html" target="_top" style="color:var(--ao)">特定商取引法に基づく表記</a>・<a href="../legal/terms.html" target="_top" style="color:var(--ao)">利用規約</a></p></div>' +
      '<div class="card"><h3>購入コードをお持ちの方（機種変更など）</h3><p class="hint">購入したときのメールアドレスと、購入コードを入れてください。</p>' +
      '<input type="text" inputmode="email" id="ppmMail" placeholder="購入時のメールアドレス" autocomplete="email" autocapitalize="off">' +
      '<input type="text" id="ppmCode" placeholder="購入コード（ppm-game.から始まる文字）" autocomplete="off">' +
      '<div class="row"><button class="btn pri" id="ppmVerify">この端末で遊ぶ</button></div><div class="status" id="ppmSt" style="line-height:1.6"></div>' +
      '<p class="hint"><a href="../restore.html" target="_top" style="color:var(--ao)">購入コードを忘れた方（再表示）</a></p></div>');
  };

  function saveLic(code){ try { localStorage.setItem(LKEY, JSON.stringify({ code: code, pid: PID, at: Date.now() })); } catch(err){} }
  function activate(code, mail, confirmMove){
    return fetch('../api/activate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: code, email: mail, device: device(), confirmMove: !!confirmMove }) }).then(function(r){ return r.json(); });
  }
  function handle(d, code, mail, st){
    if (d && d.ok && d.pid === PID) {
      saveLic(code);
      st.innerHTML = d.moved ? 'この端末に引っ越しました。前の端末では遊べなくなりました。<br>引っ越しは、これで使い終わりました。' : 'この端末がフル版になりました！';
      setTimeout(showTitle, d.moved ? 2600 : 900);
      return;
    }
    var r = d && d.reason;
    if (r === 'move_needed') {
      st.innerHTML = 'この購入コードは、ほかの端末で使われています。<br><b>この端末に引っ越しますか？</b> 前の端末では遊べなくなります。引っ越しは<b>1回だけ</b>です。' +
        '<div class="row" style="margin-top:8px"><button class="btn pri" id="ppmMove">引っ越す</button><button class="btn" data-act="title">やめる</button></div>';
      document.getElementById('ppmMove').onclick = function(){ st.textContent = '引っ越しています…'; activate(code, mail, true).then(function(x){ handle(x, code, mail, st); }).catch(function(){ st.textContent = '通信できませんでした。ネットにつないでもう一度お試しください。'; }); };
      return;
    }
    st.innerHTML = r === 'limit' ? 'この購入コードは、引っ越し（1回）を使い終わっています。<br>この端末で遊ぶには、もう一度ご購入ください。'
      : r === 'email' ? 'メールアドレスが、購入したときのものと違います。'
      : '購入コードが正しくありません。コピーし直してお試しください。';
  }

  document.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('#ppmVerify, [data-act="paywall"], [data-act="cert"]');
    if (!b) return;
    if (b.dataset.act === 'paywall') { showPaywall('フル版にする'); return; }
    if (b.dataset.act === 'cert') { showCert(); return; }
    var code = (document.getElementById('ppmCode').value || '').trim(), mail = (document.getElementById('ppmMail').value || '').trim(), st = document.getElementById('ppmSt');
    if (!mail) { st.textContent = '購入したときのメールアドレスを入力してください。'; return; }
    if (!code) { st.textContent = '購入コードを入力してください。'; return; }
    st.textContent = '確認しています…';
    activate(code, mail, false).then(function(d){ handle(d, code, mail, st); })
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

  /* ---------- 段位認定証 ---------- */
  function rr(c, x, y, w, h, r){ c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function nopi(c, x, y, s){
    c.save(); c.translate(x, y); c.scale(s, s);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(0, 108, 70, 12, 0, 0, Math.PI * 2); c.fill();
    var g = c.createRadialGradient(-30, -40, 10, 0, 0, 100); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#ffe6c7');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, 95, 0, Math.PI * 2); c.fill();
    c.lineWidth = 5; c.strokeStyle = '#f2b36b'; c.stroke();
    c.fillStyle = '#16255a'; c.beginPath(); c.moveTo(-96, -38); c.quadraticCurveTo(0, -62, 96, -38); c.lineTo(94, -12); c.quadraticCurveTo(0, -36, -94, -12); c.closePath(); c.fill();
    c.fillStyle = '#2fd9cf'; c.beginPath(); c.moveTo(92, -32); c.lineTo(132, -52); c.lineTo(124, -22); c.closePath(); c.fill(); c.beginPath(); c.moveTo(92, -22); c.lineTo(128, -6); c.lineTo(104, 4); c.closePath(); c.fill();
    c.fillStyle = '#1b1b2e'; c.beginPath(); c.ellipse(-32, 6, 9, 13, 0, 0, Math.PI * 2); c.ellipse(32, 6, 9, 13, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(-29, 1, 3.5, 0, Math.PI * 2); c.arc(35, 1, 3.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,120,140,.45)'; c.beginPath(); c.ellipse(-55, 30, 13, 8, 0, 0, Math.PI * 2); c.ellipse(55, 30, 13, 8, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#1b1b2e'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.arc(0, 28, 18, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    c.fillStyle = '#e8324a'; c.beginPath(); c.ellipse(118, 52, 30, 34, -0.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#7a4a22'; c.save(); c.translate(100, 82); c.rotate(-0.5); c.fillRect(-7, 0, 14, 34); c.restore();
    c.fillStyle = '#16255a'; c.font = '900 34px "Chakra Petch", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('P', 0, 66);
    c.restore();
  }
  function makeCert(){
    var LD = (typeof LAST_DRILL !== 'undefined' && LAST_DRILL) ? LAST_DRILL : null;
    var name = (typeof PROF !== 'undefined' && PROF.char && PROF.char.name) || 'プレイヤー';
    var lv = LD ? LD.level : 10, drill = LD && LD.d ? LD.d.name : '多球練習';
    var cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1350; var c = cv.getContext('2d');
    var bg = c.createLinearGradient(0, 0, 0, 1350); bg.addColorStop(0, '#070b22'); bg.addColorStop(0.62, '#0b1d4a'); bg.addColorStop(1, '#0a6f86'); c.fillStyle = bg; c.fillRect(0, 0, 1080, 1350);
    c.fillStyle = 'rgba(47,217,207,.18)'; for (var i = 0; i < 6; i++){ c.beginPath(); c.ellipse(540, 1220 + i * 22, 760 - i * 40, 40, 0, 0, Math.PI * 2); c.fill(); }
    rr(c, 60, 60, 960, 1230, 36); c.lineWidth = 6; c.strokeStyle = '#2fd9cf'; c.stroke();
    rr(c, 82, 82, 916, 1186, 26); c.lineWidth = 2; c.strokeStyle = 'rgba(255,209,102,.7)'; c.stroke();
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.fillStyle = '#2fd9cf'; c.font = '700 40px "Chakra Petch", sans-serif'; c.fillText('PING PONG MASTER', 540, 170);
    c.fillStyle = '#ffffff'; c.font = '900 92px "Dela Gothic One", "Zen Kaku Gothic New", sans-serif'; c.fillText('段位認定証', 540, 290);
    nopi(c, 540, 520, 1.25);
    c.fillStyle = '#ffd166'; c.font = '900 170px "Dela Gothic One", "Zen Kaku Gothic New", sans-serif'; c.fillText(lv + '級', 540, 830);
    c.fillStyle = '#ffffff'; c.font = '700 46px "Zen Kaku Gothic New", sans-serif'; c.fillText(drill, 540, 905);
    c.font = '900 64px "Zen Kaku Gothic New", sans-serif'; c.fillText(String(name).slice(0, 14) + ' 殿', 540, 1010);
    c.fillStyle = 'rgba(255,255,255,.85)'; c.font = '500 30px "Zen Kaku Gothic New", sans-serif'; c.fillText('琉球ビーチ練習場にて、上記の級に合格したことを', 540, 1066); c.fillText('認定します', 540, 1106);
    var dt = new Date(); c.fillText(dt.getFullYear() + '年' + (dt.getMonth() + 1) + '月' + dt.getDate() + '日', 540, 1156);
    c.fillStyle = '#2fd9cf'; c.font = '700 34px "Chakra Petch", sans-serif'; c.fillText('#ピンポンマスター挑戦　' + location.host, 540, 1230);
    return { canvas: cv, lv: lv, drill: drill, name: name };
  }
  function showCert(){
    var C = makeCert(); var url = C.canvas.toDataURL('image/png');
    var text = 'PING PONG MASTER で「' + C.drill + '」' + C.lv + '級に合格！ あなたは何級？ #ピンポンマスター挑戦';
    var su = encodeURIComponent(SITE + 'game/'), st = encodeURIComponent(text);
    show('cert', '<button class="btn sm back" data-act="title">← メニュー</button>' +
      '<div class="card" style="align-items:center"><h2>段位認定証</h2><img src="' + url + '" alt="段位認定証" style="width:100%;max-width:380px;border-radius:14px;display:block;margin:0 auto">' +
      '<div class="row" style="justify-content:center;flex-wrap:wrap">' +
      '<button class="btn pri" id="ppmShareImg">画像をシェア・保存</button>' +
      '<a class="btn" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=' + st + '&url=' + su + '">Xでシェア</a>' +
      '<a class="btn" target="_blank" rel="noopener" href="https://social-plugins.line.me/lineit/share?url=' + su + '&text=' + st + '">LINEで送る</a></div>' +
      '<p class="hint" style="text-align:center">Xに画像を付けるときは、先に「画像をシェア・保存」で画像を保存してから、投稿に添付してください。</p>' +
      '<div class="row" style="justify-content:center"><button class="btn" data-act="practice">練習メニューへ</button></div><div class="status" id="ppmCertSt"></div></div>');
    document.getElementById('ppmShareImg').onclick = function(){
      var s = document.getElementById('ppmCertSt');
      C.canvas.toBlob(function(blob){
        var file = null; try { file = new File([blob], 'pingpongmaster-' + C.lv + 'kyu.png', { type: 'image/png' }); } catch(err){}
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], text: text + ' ' + SITE + 'game/' }).catch(function(){}); return; }
        var a = document.createElement('a'); a.href = url; a.download = 'pingpongmaster-' + C.lv + 'kyu.png'; document.body.appendChild(a); a.click(); a.remove();
        s.textContent = '画像を保存しました。保存できない場合は、画像を長押しして「写真に保存」を選んでください。';
      }, 'image/png');
    };
  }
  window.PPM_SHOW_CERT = showCert;

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

  /* 保存してある購入コードが、まだこの端末で使えるか確認（ほかの端末に引っ越したときは外す） */
  var L = lic();
  if (L && L.code && navigator.onLine) {
    fetch('../api/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: L.code, device: device() }) })
      .then(function(r){ return r.json(); }).then(function(d){
        if (d && d.ok === false && (d.reason === 'other_device' || d.reason === 'bad_code')) {
          localStorage.removeItem(LKEY);
          if (d.reason === 'other_device') setTimeout(function(){ try { showPaywall('この購入コードは、ほかの端末に引っ越しました'); } catch(err){} }, 400);
        }
      }).catch(function(){});
  }

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function(){});
})();
