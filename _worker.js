/*
 * PingPongMaster STORE — 購入確認・受け渡し・メール通知（Cloudflare Pages の _worker.js）
 * このファイルは編集しなくて大丈夫です。設定は Cloudflare の「変数とシークレット」と「バインディング」に入れます。
 *
 * 必須（シークレット）
 *   STRIPE_SECRET_KEY    Stripe の制限付きキー（Checkout Sessions・Products・Prices・PaymentIntents・PaymentMethods の「読み取り」だけ許可）
 *   LICENSE_SECRET       購入コード・ダウンロードリンクを作る合言葉（最初に1回だけ決めて、変えない）
 *   SELLER_NAME          販売事業者名（氏名）
 *   SELLER_ADDRESS       住所（購入者にだけ、購入完了画面とメールで表示）
 *   SELLER_PHONE         電話番号（同上）
 *   SELLER_EMAIL         お問い合わせ・通知を受け取るメールアドレス
 *   ADMIN_KEY            注文一覧ページ（/orders.html）を見るための合言葉
 * 任意
 *   PAID_FILES           ファイル商品の本当のダウンロード先。例: {"care-guide":"https://drive.google.com/..."}
 *   SHOP_NAME            お店の名前
 *   STRIPE_WEBHOOK_SECRET  Stripe の Webhook 署名シークレット（whsec_...）。メール送信に必要
 *   RESEND_API_KEY / MAIL_FROM  メール送信（独自ドメインを取ったあと）
 * バインディング（任意・おすすめ）
 *   STORE_KV             KV ネームスペース。注文と「受け取り済み」を記録する
 */
const enc = new TextEncoder();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
function page(title, body, status = 200) {
  return new Response(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="stylesheet" href="/style.css"></head><body><main class="wrap doc"><h1>${title}</h1><div class="panel">${body}</div></main></body></html>`, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
const h = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function safeEqual(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
async function stripe(env, path) {
  const r = await fetch('https://api.stripe.com/v1/' + path, { headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY } });
  const j = await r.json();
  if (!r.ok) throw new Error((j.error && j.error.message) || 'Stripe error');
  return j;
}
async function loadProducts(env, origin) {
  try { const r = await env.ASSETS.fetch(new Request(origin + '/products.json')); return r.ok ? await r.json() : []; } catch (e) { return []; }
}
function paidFiles(env) { try { return JSON.parse(env.PAID_FILES || '{}'); } catch (e) { return {}; } }
const shopName = env => env.SHOP_NAME || 'PingPongMaster STORE';
function seller(env) { return { name: env.SELLER_NAME || shopName(env), address: env.SELLER_ADDRESS || '', phone: env.SELLER_PHONE || '', email: env.SELLER_EMAIL || '' }; }

/* KV（注文の記録） */
async function kvGet(env, k) { try { return env.STORE_KV ? JSON.parse((await env.STORE_KV.get(k)) || 'null') : null; } catch (e) { return null; } }
async function kvPut(env, k, v) { try { if (env.STORE_KV) await env.STORE_KV.put(k, JSON.stringify(v)); } catch (e) {} }

/* 購入コード：商品ID.注文IDの末尾.署名（ダウンロードリンクにも使う） */
async function makeCode(env, pid, sessionId) {
  const tail = sessionId.slice(-16);
  const sig = (await hmacHex(env.LICENSE_SECRET, pid + '.' + tail)).slice(0, 20);
  return `${pid}.${tail}.${sig}`;
}
async function checkCode(env, code) {
  const parts = String(code || '').trim().split('.');
  if (parts.length !== 3) return null;
  const [pid, tail, sig] = parts;
  const good = (await hmacHex(env.LICENSE_SECRET, pid + '.' + tail)).slice(0, 20);
  return safeEqual(good, sig) ? pid : null;
}

/* ゲームの利用端末：1つの購入コードで同時に使えるのは1台。機種変更（引っ越し）は1回だけ */
const MAX_MOVES = 1;
const normEmail = s => String(s || '').trim().toLowerCase();
const goodDevice = s => /^[A-Za-z0-9-]{16,64}$/.test(String(s || ''));
async function orderEmail(env, code) { const o = await kvGet(env, 'o:' + code); return o ? normEmail(o.email) : ''; }
async function activate(env, code, email, device, confirmMove) {
  const pid = await checkCode(env, code);
  if (!pid) return { ok: false, reason: 'bad_code' };
  if (!goodDevice(device)) return { ok: false, reason: 'bad_device' };
  if (!env.STORE_KV) return { ok: true, pid, nokv: true };
  const owner = await orderEmail(env, code);
  if (owner && email !== null && normEmail(email) !== owner) return { ok: false, reason: 'email' };
  const key = 'lic:' + code;
  const lic = (await kvGet(env, key)) || null;
  if (!lic) { await kvPut(env, key, { device, moves: 0, at: new Date().toISOString() }); return { ok: true, pid, movesLeft: MAX_MOVES }; }
  if (lic.device === device) return { ok: true, pid, movesLeft: Math.max(0, MAX_MOVES - (lic.moves || 0)) };
  if ((lic.moves || 0) >= MAX_MOVES) return { ok: false, reason: 'limit' };
  if (!confirmMove) return { ok: false, reason: 'move_needed', movesLeft: MAX_MOVES - (lic.moves || 0) };
  lic.device = device; lic.moves = (lic.moves || 0) + 1; lic.movedAt = new Date().toISOString();
  await kvPut(env, key, lic);
  return { ok: true, pid, moved: true, movesLeft: Math.max(0, MAX_MOVES - lic.moves) };
}

/* 支払い済みの注文から、渡すものを作り、注文を記録する */
async function deliverables(env, origin, session) {
  const paid = session.payment_status === 'paid' || session.payment_status === 'no_payment_required';
  if (!paid) return { ok: false, reason: 'unpaid' };
  const products = await loadProducts(env, origin);
  const files = paidFiles(env);
  const email = (session.customer_details && session.customer_details.email) || '';
  const lines = (session.line_items && session.line_items.data) || [];
  const ids = lines.map(li => { const prod = li.price && li.price.product; return { pid: (prod && prod.metadata && prod.metadata.site_id) || session.client_reference_id || '', name: li.description || (prod && prod.name) || '', amount: li.amount_total }; });
  if (!ids.length && session.client_reference_id) ids.push({ pid: session.client_reference_id, name: '', amount: session.amount_total });
  const items = [];
  for (const it of ids) {
    const p = products.find(x => x.id === it.pid) || {};
    const code = await makeCode(env, it.pid, session.id);
    const out = { pid: it.pid, name: p.title || it.name, type: p.type || 'download', code };
    if (out.type === 'game' || out.type === 'license') out.url = origin + '/' + (p.playUrl || '');
    else if (files[it.pid]) { out.url = origin + '/api/download?t=' + encodeURIComponent(code); delete out.code; }
    else { out.note = 'ダウンロード先の準備ができていません。お手数ですが、お問い合わせください。'; delete out.code; }
    items.push(out);
    if (env.STORE_KV && !(await kvGet(env, 'o:' + code))) {
      await kvPut(env, 'o:' + code, { code, pid: it.pid, name: out.name, type: out.type, email, amount: it.amount || 0, session: session.id, at: new Date().toISOString(), received: false });
    }
  }
  return { ok: true, email, items, seller: seller(env), mail: !!(env.RESEND_API_KEY && env.MAIL_FROM), shop: shopName(env) };
}

/* ---------- メール ---------- */
async function sendMail(env, to, subject, html) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM || !to) return false;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [to], reply_to: env.SELLER_EMAIL || undefined, subject, html })
  });
  return r.ok;
}
function mailFooter(env, origin) {
  const s = seller(env);
  return `<hr><p style="font-size:12px;color:#555">販売事業者：${h(s.name)}<br>所在地：${h(s.address)}<br>電話番号：${h(s.phone)}<br>お問い合わせ：${h(s.email)}<br>${h(shopName(env))}　${h(origin)}</p>
  <p style="font-size:12px;color:#555">このメールは、ご注文と商品のお受け取りに関するお知らせです。今後、新しい商品のご案内が不要な場合は、このメールに「配信停止」とご返信ください。</p>`;
}
function itemsHtml(items) {
  return items.map(i => `<p><b>${h(i.name)}</b><br>${i.code ? `購入コード：<code>${h(i.code)}</code><br>` : ''}${i.url ? `<a href="${h(i.url)}">${i.type === 'game' ? 'ゲームを開く' : 'ダウンロードする'}</a>` : h(i.note || '')}</p>`).join('');
}
async function mailOrder(env, origin, d, session) {
  const shop = shopName(env);
  await sendMail(env, d.email, `【${shop}】ご購入ありがとうございます（ご注文の確認）`,
    `<p>このたびは${h(shop)}でご購入いただき、ありがとうございます。お支払いを確認しました。</p>${itemsHtml(d.items)}
     <p>ゲームは、1つの購入コードで1台の端末で遊べます。機種変更のときは、新しい端末でこのメールアドレスと購入コードを入力すると、引っ越しできます（引っ越しは1回まで。前の端末では遊べなくなります）。購入コードは人に教えないでください。</p>
     <p>デジタル商品のため、お支払い後の返品・キャンセルはお受けしていません。不具合で使えない場合は、このメールにご返信ください。</p>${mailFooter(env, origin)}`);
  if (env.SELLER_EMAIL) await sendMail(env, env.SELLER_EMAIL, `【${shop}】注文が入りました：${d.items.map(i => i.name).join('、')}`,
    `<p>新しい注文がありました。</p><p>商品：${h(d.items.map(i => i.name).join('、'))}<br>金額：¥${Number(session.amount_total || 0).toLocaleString('ja-JP')}<br>購入者：${h(d.email)}<br>日時：${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</p><p>受け取り（ダウンロード）されると、もう一度お知らせします。注文一覧：${h(origin)}/orders.html</p>`);
}
async function markReceived(env, origin, code) {
  const rec = await kvGet(env, 'o:' + code);
  if (!rec || rec.received) return;
  rec.received = true; rec.receivedAt = new Date().toISOString();
  await kvPut(env, 'o:' + code, rec);
  const shop = shopName(env);
  const products = (await loadProducts(env, origin)).filter(p => p.status !== 'draft' && p.id !== rec.pid).slice(0, 3);
  const shareText = encodeURIComponent(`${shop}で「${rec.name}」を手に入れました！`);
  const shareUrl = encodeURIComponent(origin + '/');
  const recs = products.length ? `<p><b>こちらもおすすめです</b></p>${products.map(p => `<p><a href="${h(origin)}/item.html?id=${encodeURIComponent(p.id)}">${h(p.title)}</a>（${p.price ? '¥' + Number(p.price).toLocaleString('ja-JP') : '無料'}）<br>${h(p.short || '')}</p>`).join('')}` : '';
  await sendMail(env, rec.email, `【${shop}】${rec.type === 'game' ? 'フル版の受け取り' : 'ダウンロード'}完了のお知らせ`,
    `<p>「${h(rec.name)}」の${rec.type === 'game' ? 'フル版への切り替え' : 'ダウンロード'}が完了しました。ご利用いただき、ありがとうございます。</p>
     <p>気に入っていただけたら、ご家族やお友だちにも教えていただけるとうれしいです。<br>
     <a href="https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}">Xでシェア</a>　｜　<a href="https://social-plugins.line.me/lineit/share?url=${shareUrl}">LINEで送る</a>　｜　<a href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}">Facebookでシェア</a></p>
     ${recs}
     <p>新しいゲームやコンテンツは、お店でお知らせしていきます：<a href="${h(origin)}/">${h(origin)}</a></p>${mailFooter(env, origin)}`);
  if (env.SELLER_EMAIL) await sendMail(env, env.SELLER_EMAIL, `【${shop}】受け取り完了：${rec.name}`,
    `<p>購入者が商品を受け取りました。</p><p>商品：${h(rec.name)}<br>購入者：${h(rec.email)}<br>受け取り日時：${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</p>`);
}

async function verifyWebhook(env, body, header) {
  if (!env.STRIPE_WEBHOOK_SECRET || !header) return false;
  const parts = Object.fromEntries(header.split(',').map(kv => kv.split('=')));
  if (!parts.t || !parts.v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 600) return false;
  return safeEqual(await hmacHex(env.STRIPE_WEBHOOK_SECRET, parts.t + '.' + body), parts.v1);
}
const SESSION_EXPAND = 'expand[]=line_items.data.price.product';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = url.origin;
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    // 設定の確認用（秘密の値は出さず、入っているかどうかだけ）
    if (url.pathname === '/api/health') {
      const k = String(env.STRIPE_SECRET_KEY || '');
      return json({ ok: true, stripe: !!k, stripeMode: k.includes('_live_') ? 'live' : k.includes('_test_') ? 'test' : 'none', license: !!env.LICENSE_SECRET, admin: !!env.ADMIN_KEY, kv: !!env.STORE_KV, mail: !!(env.RESEND_API_KEY && env.MAIL_FROM), webhook: !!env.STRIPE_WEBHOOK_SECRET });
    }
    if (!env.STRIPE_SECRET_KEY || !env.LICENSE_SECRET) return json({ ok: false, reason: 'not_configured' }, 503);
    const later = p => { if (ctx && ctx.waitUntil) ctx.waitUntil(p); else return p; };
    try {
      // 購入完了ページ：支払いを確認して受け渡し
      if (url.pathname === '/api/claim') {
        const sid = url.searchParams.get('session_id') || '';
        if (!/^cs_[A-Za-z0-9_]+$/.test(sid)) return json({ ok: false, reason: 'bad_session' }, 400);
        const s = await stripe(env, `checkout/sessions/${sid}?${SESSION_EXPAND}`);
        const d = await deliverables(env, origin, s);
        if (d.ok) for (const it of d.items) if (it.type === 'game' && it.code) await later(markReceived(env, origin, it.code));
        return json(d);
      }
      // ファイル商品のダウンロード（受け取りを記録してから本当の保存先へ）
      if (url.pathname === '/api/download') {
        const code = url.searchParams.get('t') || '';
        const pid = await checkCode(env, code);
        const target = pid && paidFiles(env)[pid];
        if (!target) return page('ダウンロードできませんでした', '<p>リンクが正しくないか、期限が切れています。購入完了ページ、または「購入した商品を再表示」からもう一度お試しください。</p><p><a class="btn pri" href="/restore.html">購入した商品を再表示</a></p>', 403);
        await later(markReceived(env, origin, code));
        return Response.redirect(target, 302);
      }
      // ゲーム：この端末で使えるようにする（メールアドレス＋購入コード）
      if (url.pathname === '/api/activate' && request.method === 'POST') {
        const b = await request.json();
        const code = String(b.code || '').trim();
        const r = await activate(env, code, String(b.email || ''), String(b.device || ''), !!b.confirmMove);
        if (r.ok) await later(markReceived(env, origin, code));
        return json(r);
      }
      // ゲーム：保存してある購入コードが、まだこの端末で使えるか確認
      if (url.pathname === '/api/verify' && request.method === 'POST') {
        const b = await request.json();
        const code = String(b.code || '').trim();
        const pid = await checkCode(env, code);
        if (!pid) return json({ ok: false, reason: 'bad_code' });
        if (!env.STORE_KV || !goodDevice(b.device)) return json({ ok: true, pid });
        const lic = await kvGet(env, 'lic:' + code);
        if (!lic) { const r = await activate(env, code, null, String(b.device), false); return json(r); }
        if (lic.device !== b.device) return json({ ok: false, reason: 'other_device' });
        return json({ ok: true, pid, movesLeft: Math.max(0, MAX_MOVES - (lic.moves || 0)) });
      }
      // 販売者用：端末の登録を消す（お問い合わせで特別に戻すとき）
      if (url.pathname === '/api/license-reset' && request.method === 'POST') {
        if (!env.ADMIN_KEY || !safeEqual(request.headers.get('x-admin-key') || '', env.ADMIN_KEY)) return json({ ok: false, reason: 'auth' }, 401);
        if (!env.STORE_KV) return json({ ok: false, reason: 'no_kv' });
        const { code } = await request.json();
        await env.STORE_KV.delete('lic:' + String(code || '').trim());
        return json({ ok: true });
      }
      // 購入情報の再表示：メールアドレス＋カード下4桁
      if (url.pathname === '/api/restore' && request.method === 'POST') {
        const { email, last4 } = await request.json();
        if (!email || !/^\d{4}$/.test(String(last4 || ''))) return json({ ok: false, reason: 'input' }, 400);
        const list = await stripe(env, `checkout/sessions?limit=20&customer_details[email]=${encodeURIComponent(email)}&expand[]=data.payment_intent.payment_method`);
        const out = [];
        for (const s of list.data) {
          const pm = s.payment_intent && s.payment_intent.payment_method;
          if (!(pm && pm.card && pm.card.last4 === String(last4))) continue;
          const d = await deliverables(env, origin, await stripe(env, `checkout/sessions/${s.id}?${SESSION_EXPAND}`));
          if (d.ok) out.push(...d.items);
        }
        return json({ ok: true, items: out, seller: out.length ? seller(env) : null });
      }
      // 注文一覧（販売者用）
      if (url.pathname === '/api/orders') {
        if (!env.ADMIN_KEY || !safeEqual(request.headers.get('x-admin-key') || '', env.ADMIN_KEY)) return json({ ok: false, reason: 'auth' }, 401);
        if (!env.STORE_KV) return json({ ok: false, reason: 'no_kv' });
        const keys = await env.STORE_KV.list({ prefix: 'o:', limit: 200 });
        const orders = [];
        for (const k of keys.keys) { const v = await kvGet(env, k.name); if (v) { if (v.type === 'game') v.lic = await kvGet(env, 'lic:' + v.code); orders.push(v); } }
        orders.sort((a, b) => String(b.at).localeCompare(String(a.at)));
        return json({ ok: true, orders });
      }
      // Stripe からの通知：購入確認メールと販売者への通知
      if (url.pathname === '/api/stripe-webhook' && request.method === 'POST') {
        const body = await request.text();
        if (!(await verifyWebhook(env, body, request.headers.get('stripe-signature')))) return json({ ok: false }, 400);
        const ev = JSON.parse(body);
        if (ev.type === 'checkout.session.completed' || ev.type === 'checkout.session.async_payment_succeeded') {
          const s = await stripe(env, `checkout/sessions/${ev.data.object.id}?${SESSION_EXPAND}`);
          const d = await deliverables(env, origin, s);
          if (d.ok) await mailOrder(env, origin, d, s);
        }
        return json({ ok: true });
      }
      return json({ ok: false, reason: 'not_found' }, 404);
    } catch (e) {
      return json({ ok: false, reason: 'error', message: String(e.message || e) }, 500);
    }
  }
};
