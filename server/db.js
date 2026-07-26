import pg from 'pg';
import { daysOf } from '../src/data/tariffs.js';

const dbUrl = process.env.DATABASE_URL || '';
// Локальная БД на VPS (localhost / unix-socket) не требует SSL; облачная (Railway) — требует.
const isLocalDB = /localhost|127\.0\.0\.1|\/var\/run/.test(dbUrl);
const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: process.env.NODE_ENV === 'production' && !isLocalDB ? { rejectUnauthorized: false } : false,
});

export async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        phone VARCHAR(50),
        role VARCHAR(20) DEFAULT 'b2c',
        organization VARCHAR(255),
        position VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      -- Миграция: добавляем новые колонки если их нет
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'b2c';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS organization VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS position VARCHAR(255);
      CREATE TABLE IF NOT EXISTS auth_codes (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code VARCHAR(6) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        plan VARCHAR(50) NOT NULL DEFAULT 'monthly',
        status VARCHAR(50) NOT NULL DEFAULT 'trial',
        started_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        payment_label VARCHAR(255),
        payment_id VARCHAR(255),
        amount INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('DB tables ready');
  } finally {
    client.release();
  }
}

// --- Users ---
export async function findUserByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  return rows[0] || null;
}

export async function createUser(email, name, phone, { role, organization, position } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, name, phone, role, organization, position)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (email) DO UPDATE SET
       name = COALESCE(EXCLUDED.name, users.name),
       phone = COALESCE(EXCLUDED.phone, users.phone),
       role = CASE WHEN EXCLUDED.role = 'b2b' THEN 'b2b' ELSE users.role END,
       organization = COALESCE(EXCLUDED.organization, users.organization),
       position = COALESCE(EXCLUDED.position, users.position)
     RETURNING *`,
    [email.toLowerCase(), name || null, phone || null, role || 'b2c', organization || null, position || null]
  );
  return rows[0];
}

// --- Auth codes ---
export async function saveAuthCode(email, code) {
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  await pool.query(
    'INSERT INTO auth_codes (email, code, expires_at) VALUES ($1, $2, $3)',
    [email.toLowerCase(), code, expires]
  );
}

export async function verifyAuthCode(email, code) {
  const { rows } = await pool.query(
    `SELECT * FROM auth_codes WHERE email = $1 AND code = $2 AND used = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
    [email.toLowerCase(), code]
  );
  if (!rows[0]) return false;
  await pool.query('UPDATE auth_codes SET used = TRUE WHERE id = $1', [rows[0].id]);
  return true;
}

// --- Subscriptions ---
export async function getActiveSubscription(userId) {
  const { rows } = await pool.query(
    `SELECT * FROM subscriptions WHERE user_id = $1 AND status IN ('trial', 'active') AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

export async function createTrialSubscription(userId) {
  const existing = await getActiveSubscription(userId);
  if (existing) return existing;
  // Check if user ever had a trial
  const { rows: past } = await pool.query(
    `SELECT id FROM subscriptions WHERE user_id = $1 AND status = 'trial' LIMIT 1`,
    [userId]
  );
  if (past.length > 0) return null; // trial already used
  const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days
  const { rows } = await pool.query(
    `INSERT INTO subscriptions (user_id, plan, status, expires_at) VALUES ($1, 'trial', 'trial', $2) RETURNING *`,
    [userId, expires]
  );
  return rows[0];
}

export async function createPendingSubscription(userId, plan, label, amount) {
  const { rows } = await pool.query(
    `INSERT INTO subscriptions (user_id, plan, status, payment_label, amount, expires_at) VALUES ($1, $2, 'pending', $3, $4, NOW()) RETURNING *`,
    [userId, plan, label, amount]
  );
  return rows[0];
}

export async function activateSubscription(label) {
  // Срок берём из плана pending-подписки (PLANS.days), с фолбэком для legacy-планов
  const { rows: pending } = await pool.query(
    `SELECT plan FROM subscriptions WHERE payment_label = $1 AND status = 'pending' LIMIT 1`,
    [label]
  );
  if (!pending[0]) return null;
  const days = daysOf(pending[0].plan);
  const { rows } = await pool.query(
    `UPDATE subscriptions SET status = 'active', started_at = NOW(), expires_at = NOW() + INTERVAL '1 day' * $2 WHERE payment_label = $1 AND status = 'pending' RETURNING *`,
    [label, days]
  );
  return rows[0] || null;
}

// --- Grant subscription manually (admin) ---
export async function grantSubscription(userId, plan = 'yearly', days = 365) {
  // завершаем текущие активные/триал/pending, чтобы не было дублей
  await pool.query(
    `UPDATE subscriptions SET status = 'cancelled', expires_at = NOW()
     WHERE user_id = $1 AND status IN ('trial', 'active', 'pending')`,
    [userId]
  );
  const { rows } = await pool.query(
    `INSERT INTO subscriptions (user_id, plan, status, started_at, expires_at)
     VALUES ($1, $2, 'active', NOW(), NOW() + INTERVAL '1 day' * $3) RETURNING *`,
    [userId, plan, days]
  );
  return rows[0];
}

// --- Cancel subscription ---
export async function cancelSubscription(userId) {
  const { rows } = await pool.query(
    `UPDATE subscriptions SET status = 'cancelled', expires_at = NOW()
     WHERE user_id = $1 AND status IN ('trial', 'active') AND expires_at > NOW()
     RETURNING *`,
    [userId]
  );
  return rows[0] || null;
}

// --- Delete user ---
export async function deleteUser(userId) {
  await pool.query('DELETE FROM subscriptions WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM auth_codes WHERE email = (SELECT email FROM users WHERE id = $1)', [userId]);
  const { rows } = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [userId]);
  return rows[0] || null;
}

// --- Admin ---
export async function getAllUsers() {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.name, u.phone, u.role, u.organization, u.position, u.created_at,
       s.plan AS sub_plan, s.status AS sub_status, s.expires_at AS sub_expires
     FROM users u
     LEFT JOIN LATERAL (
       SELECT plan, status, expires_at FROM subscriptions
       WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1
     ) s ON true
     ORDER BY u.created_at DESC`
  );
  return rows;
}

export async function getAdminStats() {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users) AS total_users,
      (SELECT COUNT(*) FROM users WHERE role = 'b2c') AS b2c_users,
      (SELECT COUNT(*) FROM users WHERE role = 'b2b') AS b2b_users,
      (SELECT COUNT(*) FROM subscriptions WHERE status = 'trial' AND expires_at > NOW()) AS active_trials,
      (SELECT COUNT(*) FROM subscriptions WHERE status = 'active' AND expires_at > NOW()) AS active_paid,
      (SELECT COUNT(*) FROM subscriptions WHERE status = 'pending') AS pending_payments
  `);
  return rows[0];
}

export default pool;
