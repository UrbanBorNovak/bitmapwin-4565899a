import http from 'node:http';
import { randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';
import { authorized, validDraft, verifyProof } from './protocol.mjs';

const secret = process.env.L2_ACCOUNT_BRIDGE_SECRET;
if (!secret || secret.length < 32 || !process.env.L2_DB_USER || !process.env.L2_DB_PASSWORD || !process.env.L2_DB_NAME)
  throw new Error('Set the bridge secret and dedicated local database credentials before starting.');
const pool = mysql.createPool({ host: '127.0.0.1', port: Number(process.env.L2_DB_PORT ?? 3306),
  user: process.env.L2_DB_USER, password: process.env.L2_DB_PASSWORD, database: process.env.L2_DB_NAME,
  connectionLimit: 4, connectTimeout: 5000, multipleStatements: false });
const [tables] = await pool.query("SHOW TABLE STATUS WHERE Name IN ('accounts', 'bitmapwin_l2_wallets', 'bitmapwin_l2_challenges', 'bitmapwin_l2_limits')");
if (tables.length !== 4 || tables.some(t => t.Engine !== 'InnoDB'))
  throw new Error('All four tables must exist and use InnoDB for atomic account creation. Back up before any engine conversion.');
const reply = (res, body, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
const server = http.createServer(async (req, res) => {
  if (!authorized(req.headers.authorization, secret)) { reply(res, { ok: false }, 401); req.resume(); return; }
  if (req.method !== 'POST' || !['/v1/health', '/v1/challenge', '/v1/create'].includes(req.url)) { reply(res, { ok: false }, 404); req.resume(); return; }
  let db;
  try {
    let body = '', size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 8192) { reply(res, { ok: false }, 413); req.destroy(); return; } body += chunk.toString('utf8'); }
    const d = JSON.parse(body || '{}');
    db = await pool.getConnection();
    if (req.url === '/v1/health') { await db.query('SELECT 1'); reply(res, { ok: true }); return; }
    if (!validDraft(d) || (req.url === '/v1/create' && !verifyProof(d))) { reply(res, { ok: false }, 400); return; }
    await db.beginTransaction();
    if (req.url === '/v1/challenge') {
      // One lock per Passport serializes quota checks across bridge instances.
      await db.execute('INSERT INTO bitmapwin_l2_limits (passport_user_id) VALUES (?) ON DUPLICATE KEY UPDATE touched_at=CURRENT_TIMESTAMP', [d.userId]);
      const [counts] = await db.execute('SELECT COUNT(*) AS n FROM bitmapwin_l2_challenges WHERE passport_user_id=? AND created_at > NOW() - INTERVAL 10 MINUTE', [d.userId]);
      if (Number(counts[0].n) >= 5) { await db.rollback(); reply(res, { ok: false, error: 'Too many registration attempts. Try again later.' }); return; }
      const [existing] = await db.execute('SELECT login FROM bitmapwin_l2_wallets WHERE login=? OR bitcoin_address=? OR passport_user_id=?', [d.login, d.address, d.userId]);
      const [accounts] = await db.execute('SELECT login FROM accounts WHERE login=?', [d.login]);
      if (existing.length || accounts.length) { await db.rollback(); reply(res, { ok: false, error: 'This login or wallet already has an account.' }); return; }
      const nonce = randomUUID(), expiresAt = Date.now() + 300_000;
      await db.execute('INSERT INTO bitmapwin_l2_challenges (nonce,passport_user_id,login,bitcoin_address,password_commitment,expires_at) VALUES (?,?,?,?,?,?)', [nonce,d.userId,d.login,d.address,d.passwordCommitment,expiresAt]);
      await db.commit(); reply(res, { ok: true, nonce, expiresAt }); return;
    }
    const [rows] = await db.execute('SELECT * FROM bitmapwin_l2_challenges WHERE nonce=? FOR UPDATE', [d.nonce]);
    const c = rows[0];
    if (!c || c.passport_user_id !== d.userId || c.login !== d.login || c.bitcoin_address !== d.address
      || c.password_commitment !== d.passwordCommitment || Number(c.expires_at) !== d.expiresAt || Number(c.expires_at) <= Date.now()) {
      await db.rollback(); reply(res, { ok: false, error: 'Challenge expired or already used.' }); return;
    }
    // A lost HTTP response can safely be retried with the exact signed request.
    if (c.used) { await db.rollback(); reply(res, { ok: true }); return; }
    await db.execute('INSERT INTO accounts (login,password) VALUES (?,?)', [d.login,d.passwordHash]);
    await db.execute('INSERT INTO bitmapwin_l2_wallets (login,bitcoin_address,passport_user_id) VALUES (?,?,?)', [d.login,d.address,d.userId]);
    await db.execute('UPDATE bitmapwin_l2_challenges SET used=TRUE WHERE nonce=?', [d.nonce]);
    await db.commit(); reply(res, { ok: true });
  } catch (e) {
    if (db) await db.rollback().catch(() => {});
    // Never log request bodies, verifiers, signatures, credentials or SQL errors.
    reply(res, { ok: false, ...(e?.code === 'ER_DUP_ENTRY' ? { error: 'This login or wallet already has an account.' } : {}) });
  } finally { db?.release(); }
});
server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.maxConnections = 20;
server.listen(8091, '127.0.0.1', () => console.log('L2 account bridge listening on localhost:8091'));