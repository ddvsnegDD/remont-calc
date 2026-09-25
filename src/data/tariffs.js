// Единый источник правды по тарифам. Импортируется и фронтом, и бэком (server.js, server/db.js).
// Цены на бэке берутся отсюда — фронту не доверяем.

export const PLANS = {
  club_monthly: { id: 'club_monthly', tier: 'club', price: 99,   days: 30,  label: 'Клуб РПКМ · 1 месяц' },
  club_yearly:  { id: 'club_yearly',  tier: 'club', price: 990,  days: 365, label: 'Клуб РПКМ · 1 год' },
  pro_monthly:  { id: 'pro_monthly',  tier: 'pro',  price: 2900, days: 30,  label: 'РПКМ PRO · 1 месяц' },
  pro_trial:    { id: 'pro_trial',    tier: 'pro',  price: 0,    days: 7,   label: 'РПКМ PRO · пробные 7 дней' },
};

export const TIER_LABEL = { club: 'Клуб', pro: 'PRO' };

// Legacy-планы из БД (до разделения тарифов). Не мигрируем — трактуем на лету.
const LEGACY_TIER = { monthly: 'club', yearly: 'club', trial: 'club' };
const LEGACY_DAYS = { monthly: 30, yearly: 365, trial: 14 };
const LEGACY_LABEL = { monthly: 'Клуб РПКМ · 1 месяц', yearly: 'Клуб РПКМ · 1 год', trial: 'Триал (14 дней)' };

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

// Отображаемое название плана: для актуальных — из PLANS[plan].label,
// для legacy-записей (до разделения тарифов) — из LEGACY_LABEL.
export function labelOf(plan) {
  if (PLANS[plan]) return PLANS[plan].label;
  return LEGACY_LABEL[plan] || 'План';
}

// «2 900» с разделителем разрядов
export function formatPrice(n) {
  return Number(n).toLocaleString('ru-RU');
}

// Лимиты бесплатного плана и чек-листов — часть 3 TASK_server_storage.md.
// Единственное место с этими числами: сервер и фронт берут отсюда, в коде не дублировать.
export const FREE_B2B_CALCS_PER_MONTH = 1;   // бесплатный профи; снимает только уровень pro (включая pro_trial)
export const FREE_CONSULTATIONS_PER_MONTH = 3; // Клуб, календарный месяц по Москве
export const MAX_PHOTOS_PER_ITEM = 5;          // на пункт чек-листа
export const MAX_PHOTOS_TOTAL_MB = 50;         // суммарно на пользователя
