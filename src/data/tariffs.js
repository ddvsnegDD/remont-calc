// Единый источник правды по тарифам. Импортируется и фронтом, и бэком (server.js, server/db.js).
// Цены на бэке берутся отсюда — фронту не доверяем.

export const PLANS = {
  club_monthly: { id: 'club_monthly', tier: 'club', price: 99,   days: 30,  label: 'Клуб РПКМ · 1 месяц' },
  club_yearly:  { id: 'club_yearly',  tier: 'club', price: 990,  days: 365, label: 'Клуб РПКМ · 1 год' },
  pro_monthly:  { id: 'pro_monthly',  tier: 'pro',  price: 2900, days: 30,  label: 'РПКМ PRO · 1 месяц' },
};

export const TIER_LABEL = { club: 'Клуб', pro: 'PRO' };

// Legacy-планы из БД (до разделения тарифов). Не мигрируем — трактуем на лету.
const LEGACY_TIER = { monthly: 'club', yearly: 'club', trial: 'club' };
const LEGACY_DAYS = { monthly: 30, yearly: 365, trial: 14 };

// Уровень плана: 'club' | 'pro' | null
export function tierOf(plan) {
  if (!plan) return null;
  if (PLANS[plan]) return PLANS[plan].tier;
  return LEGACY_TIER[plan] || 'club'; // неизвестный legacy — считаем клубным (не отбираем доступ)
}

// Срок действия в днях. Фолбэк 30 для неизвестных планов.
export function daysOf(plan) {
  if (PLANS[plan]) return PLANS[plan].days;
  return LEGACY_DAYS[plan] || 30;
}

// «2 900» с разделителем разрядов
export function formatPrice(n) {
  return Number(n).toLocaleString('ru-RU');
}
