/* TOM — Daily Push Notification Sender | Cloudflare Pages Function */
/* URL: /notify — triggered by cron-job.org */

'use strict';

/* ── NOTIFICATION LIBRARY ─────────────────────────────────── */

const MSGS = {
  menstrual: [
    'Good morning. Menstrual phase underway. A quieter approach is advisable.',
    'Morning. Energy may be lower today. Best to keep things simple.',
    'Menstrual phase in progress. Patience will serve you well.',
    'Today calls for calm handling. TOM recommends a steady pace.',
    'A slower rhythm today. No need to push matters unnecessarily.',
    'Morning. Menstrual phase in play. Proceed gently.',
    'Today may favour patience over problem-solving.',
    'Menstrual phase underway. Sensitivity may be heightened.',
    'A calm approach today may yield better results than enthusiasm.',
    'TOM suggests fewer grand gestures, more quiet competence.',
    'Morning. Conditions are delicate. Best not to test boundaries.',
    'Menstrual phase. Today is not built for heroics.',
    'Proceed carefully. This is not a day for experiments.',
    'Tread lightly. Even good ideas may be poorly received.',
    'TOM advises: say less, do thoughtfully.',
  ],
  follicular: [
    'Good morning. Follicular phase underway. Energy should begin to return.',
    'A gradual lift today. A good time to re-engage.',
    'Conditions improving. Forward motion is reasonable.',
    'Follicular phase in play. A constructive tone is encouraged.',
    'Today may reward light initiative.',
    'Morning. Follicular phase — things are looking up.',
    'A better window for ideas and plans.',
    'Momentum is returning. Sensible optimism is appropriate.',
    'A good day to suggest, rather than insist.',
    'TOM notes improved conditions. Use them wisely.',
    'Morning. Spirits lifting. You may reintroduce yourself.',
    'Follicular phase — cautious confidence may now be tolerated.',
    'A fine day to appear slightly more interesting than usual.',
    'You may find your suggestions oddly well received.',
    "TOM detects opportunity. Don't squander it.",
  ],
  ovulation: [
    'Good morning. Ovulation phase underway. Engagement is favourable.',
    'A positive window for connection today.',
    'Communication should flow more easily.',
    'Ovulation phase in play. A good time for shared moments.',
    'Today may reward attentiveness and presence.',
    "Morning. Ovulation phase — you're in good territory.",
    'A strong day for charm and conversation.',
    'Things may land better today. Take note.',
    'Connection is easier now. Worth leaning into.',
    'TOM approves of engagement today.',
    'Morning. Prime conditions. Do try not to waste them.',
    "Ovulation phase. If you've got charm, now's the time.",
    'Today is forgiving. Even your jokes may succeed.',
    'A rare window where you may appear quite impressive.',
    'TOM suggests making yourself pleasantly noticeable.',
  ],
  luteal: [
    'Good morning. Luteal phase underway. A measured approach is advised.',
    'Expectations may need gentle adjustment today.',
    'A more sensitive period. Proceed with awareness.',
    'Luteal phase in play. Stability is preferable to change.',
    'Today may favour consistency over initiative.',
    'Morning. Luteal phase — manage expectations carefully.',
    'A good day to avoid unnecessary friction.',
    'Things may require a softer touch today.',
    'TOM recommends diplomacy over logic.',
    'Not everything needs solving today.',
    'Morning. Luteal phase. Choose your battles — then avoid them.',
    'Today may not reward boldness. Or honesty, in some cases.',
    'Proceed with charm. And perhaps restraint.',
    'A delicate atmosphere. Best not to poke it.',
    'TOM suggests: less fixing, more agreeing.',
  ],
};

const PHASE_CHANGE_MSGS = {
  menstrual:  'Heads up: menstrual phase begins tomorrow. A quieter approach may be wise.',
  follicular: 'Tomorrow brings the follicular phase. Conditions begin to improve.',
  ovulation:  'Ovulation window opens tomorrow. Timing, as ever, is everything.',
  luteal:     'Luteal phase begins tomorrow. TOM recommends a slight recalibration.',
};

// --- DEBUG: validate VAPID private key format (temporary) ---
async function validateVapidKey(env) {
  try {
    const privB64 = env.VAPID_PRIVATE_KEY;
    if (!privB64) {
      console.log('VAPID_PRIVATE_KEY missing');
      return false;
    }
    // convert base64url to base64
    const b64 = privB64.replace(/-/g, '+').replace(/_/g, '/')
      + '='.repeat((4 - privB64.length % 4) % 4);
    const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    // try import as PKCS8 (Cloudflare Workers / Pages support subtle.importKey)
    await crypto.subtle.importKey('pkcs8', raw.buffer, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    console.log('VAPID private key imported OK');
    return true;
  } catch (e) {
    console.log('VAPID private key import FAILED:', e && e.message ? e.message : e);
    return false;
  }
}
// call it once at startup for debug
validateVapidKey(env);


/* ── PHASE LOGIC ──────────────────────────────────────────── */

function getPhaseKey(day, cycleLen, bleedLen) {
  const ovDay = cycleLen - 14;
  if (day <= bleedLen)        return 'menstrual';
  if (day < ovDay)            return 'follicular';
  if (day <= ovDay + 1)       return 'ovulation';
  return 'luteal';
}

function getCycleDay(startStr, cycleLen) {
  const start = new Date(startStr);
  start.setUTCHours(0, 0, 0, 0);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const diff = Math.floor((today - start) / 86400000);
  if (diff < 0) return 1;
  return (diff % cycleLen) + 1;
}

function pickMessage(arr, seed) {
  return arr[Math.abs(seed) % arr.length];
}

/* ── BASE64URL HELPERS ────────────────────────────────────── */

function b64uEncode(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64uDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...arrays) {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

/* ── CRYPTO: HKDF ─────────────────────────────────────────── */

async function hmacSha256(keyBytes, data) {
  const key = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
}

async function hkdf(salt, ikm, info, length) {
  const prk = await hmacSha256(salt, ikm);
  const infoBytes = typeof info === 'string' ? new TextEncoder().encode(info) : info;
  const n = Math.ceil(length / 32);
  let T = new Uint8Array(0);
  let result = new Uint8Array(0);
  for (let i = 1; i <= n; i++) {
    T = await hmacSha256(prk, concat(T, infoBytes, new Uint8Array([i])));
    result = concat(result, T);
  }
  return result.slice(0, length);
}

/* ── VAPID JWT ────────────────────────────────────────────── */

async function buildVapidJWT(endpoint, privKeyB64u, pubKeyB64u, subject) {
  const { protocol, host } = new URL(endpoint);
  const audience = `${protocol}//${host}`;

  const enc     = new TextEncoder();
  const header  = JSON.stringify({ typ: 'JWT', alg: 'ES256' });
  const payload = JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 43200,
    sub: subject,
  });

  const sigInput = `${b64uEncode(enc.encode(header))}.${b64uEncode(enc.encode(payload))}`;

  const privBytes = b64uDecode(privKeyB64u);
  const pubBytes  = b64uDecode(pubKeyB64u);

  const jwk = {
    kty: 'EC', crv: 'P-256',
    d: b64uEncode(privBytes),
    x: b64uEncode(pubBytes.slice(1, 33)),
    y: b64uEncode(pubBytes.slice(33, 65)),
  };

  const key = await crypto.subtle.importKey(
    'jwk', jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );

  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(sigInput))
  );

  return `${sigInput}.${b64uEncode(sig)}`;
}

/* ── WEB PUSH PAYLOAD ENCRYPTION (aesgcm) ────────────────── */

async function encryptPayload(subscription, message) {
  const enc      = new TextEncoder();
  const msgBytes = enc.encode(message);

  // Ephemeral sender key pair
  const serverKP = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  );
  const serverPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', serverKP.publicKey));

  // Client (receiver) public key
  const clientPubRaw = b64uDecode(subscription.keys.p256dh);
  const clientPubKey = await crypto.subtle.importKey(
    'raw', clientPubRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']
  );

  // ECDH shared secret
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPubKey }, serverKP.privateKey, 256
  );
  const sharedSecret = new Uint8Array(sharedBits);

  const authSecret = b64uDecode(subscription.keys.auth);
  const salt       = crypto.getRandomValues(new Uint8Array(16));

  // IKM from auth secret
  const authInfo = enc.encode('Content-Encoding: auth\0');
  const ikm      = await hkdf(authSecret, sharedSecret, authInfo, 32);

  // Receiver context
  const receiverContext = concat(
    enc.encode('P-256\0'),
    new Uint8Array([0x00, clientPubRaw.length]),
    clientPubRaw,
    new Uint8Array([0x00, serverPubRaw.length]),
    serverPubRaw,
  );

  const cek   = await hkdf(salt, ikm, concat(enc.encode('Content-Encoding: aesgcm\0'),  receiverContext), 16);
  const nonce = await hkdf(salt, ikm, concat(enc.encode('Content-Encoding: nonce\0'),   receiverContext), 12);

  // Encrypt: [2-byte padding prefix = 0x0000] + message
  const padded = concat(new Uint8Array(2), msgBytes);
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded)
  );

  return { cipher, salt, serverPubRaw };
}

/* ── SEND ONE PUSH NOTIFICATION ───────────────────────────── */

async function sendPush(subscription, message, vapidPriv, vapidPub, vapidSubject) {
  const jwt = await buildVapidJWT(subscription.endpoint, vapidPriv, vapidPub, vapidSubject);
  const { cipher, salt, serverPubRaw } = await encryptPayload(subscription, message);

  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type':     'application/octet-stream',
      'Content-Encoding': 'aesgcm',
      'Encryption':       `salt=${b64uEncode(salt)}`,
      'Crypto-Key':       `dh=${b64uEncode(serverPubRaw)};p256ecdsa=${vapidPub}`,
      'Authorization':    `WebPush ${jwt}`,
      'TTL':              '86400',
    },
    body: cipher,
  });

  return res.status;
}

/* ── MAIN HANDLER ─────────────────────────────────────────── */

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Authenticate the cron request
  const token = url.searchParams.get('token') || '';
  if (!env.NOTIFY_TOKEN || token !== env.NOTIFY_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }

  const vapidPriv    = env.VAPID_PRIVATE_KEY;
  const vapidPub     = env.VAPID_PUBLIC_KEY;
  const vapidSubject = env.VAPID_SUBJECT || 'mailto:change@me.com';

  if (!vapidPriv || !vapidPub)         return new Response('VAPID keys not configured', { status: 500 });
  if (!env.TOM_SUBSCRIPTIONS)          return new Response('KV not bound', { status: 500 });

  const list = await env.TOM_SUBSCRIPTIONS.list();

  const today   = new Date();
  const daySeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

  const results = [];

  for (const { name } of list.keys) {
    try {
      const raw = await env.TOM_SUBSCRIPTIONS.get(name);
      if (!raw) continue;

      const { subscription, cycleStart, cycleLength, bleedLength } = JSON.parse(raw);

      const cycleDay    = getCycleDay(cycleStart, cycleLength);
      const phaseKey    = getPhaseKey(cycleDay,     cycleLength, bleedLength);
      const tomorrowDay = cycleDay >= cycleLength ? 1 : cycleDay + 1;
      const tomorrowKey = getPhaseKey(tomorrowDay,  cycleLength, bleedLength);

      // Phase-change alert takes priority over daily briefing
      const message = (tomorrowKey !== phaseKey)
        ? PHASE_CHANGE_MSGS[tomorrowKey]
        : pickMessage(MSGS[phaseKey], daySeed + cycleDay);

      const status = await sendPush(subscription, message, vapidPriv, vapidPub, vapidSubject);
      results.push({ key: name, status });

      // Clean up dead subscriptions automatically
      if (status === 410 || status === 404) {
        await env.TOM_SUBSCRIPTIONS.delete(name);
      }

    } catch (err) {
      results.push({ key: name, error: err.message });
    }
  }

  return new Response(JSON.stringify({ dispatched: results.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
