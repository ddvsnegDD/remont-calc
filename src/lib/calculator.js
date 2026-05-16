// Pricing engine for РПКМ renovation calculator — ES module version
// Base prices per м² calibrated to Moscow Q1 2026 market analysis

export const TIERS = {
  cosmetic:    { label: 'Косметический',       baseLow:  20000, baseHigh:  30000 },
  capital:     { label: 'Капитальный стандарт', baseLow:  35000, baseHigh:  55000 },
  euro:        { label: 'Евроремонт',          baseLow:  60000, baseHigh:  85000 },
  euro_top:    { label: 'Евроремонт+',         baseLow: 100000, baseHigh: 150000 },
  premium:     { label: 'Премиум',             baseLow: 160000, baseHigh: 220000 },
  luxury:      { label: 'Люкс',                baseLow: 220000, baseHigh: 350000 },
};

export const HOUSE_MOD = {
  nov_monolith:        { label: 'Новостройка · монолит',                   mod: 1.00 },
  nov_monolith_brick:  { label: 'Новостройка · монолитно-кирпичные/блоки', mod: 1.02 },
  nov_panel_new:       { label: 'Новостройка · панель (новая серия)',      mod: 0.96 },
  nov_brick:           { label: 'Новостройка · кирпич/блоки',              mod: 1.06 },
  vtor_panel:          { label: 'Вторичка · панель (П-44, КОПЭ, И-155)',   mod: 1.00 },
  vtor_stalinka:       { label: 'Вторичка · сталинка',                      mod: 1.10 },
  vtor_monolith:       { label: 'Вторичка · монолит (1995–2010)',          mod: 1.05 },
  vtor_brick_old:      { label: 'Вторичка · кирпич старой постройки',       mod: 1.08 },
  historic:            { label: 'Историч. реконструкция',                   mod: 1.18 },
  // Legacy keys
  novostroyka_monolith:{ label: 'Новостройка монолит', mod: 1.00 },
  novostroyka_panel:   { label: 'Новостройка панель',  mod: 0.96 },
  vtorichka_monolith:  { label: 'Вторичка монолит',    mod: 1.03 },
  vtorichka_panel:     { label: 'Вторичка панель',     mod: 0.98 },
  stalinka:            { label: 'Сталинка',            mod: 1.10 },
};

export const FINISH_MOD = {
  no_finish: { label: 'Без отделки (голые стены)', mod: 1.00 },
  whitebox:  { label: 'White Box (предчистовая)',  mod: 0.55 },
};

export const COMMS_MOD = {
  none:      { label: 'Не нужна',                         mod: 1.00 },
  partial:   { label: 'Частичная (электрика ИЛИ сантех)',  mod: 1.05 },
  full:      { label: 'Полная (электрика + сантех)',       mod: 1.10 },
  full_plus: { label: 'Полная + отопление/вентиляция',     mod: 1.16 },
};

export const REPLAN_MOD = {
  no:    { label: 'Не требуется',                     mod: 1.00 },
  light: { label: 'Лёгкая (без затрагивания несущих)', mod: 1.03 },
  full:  { label: 'Полная (со согласованием в МЖИ)',   mod: 1.16 },
};

export const DESIGN_MOD = {
  yes:  { label: 'Есть',                          mod: 1.00 },
  no:   { label: 'Нет, но рассчитайте без него',  mod: 1.03 },
  need: { label: 'Нужно сделать',                 mod: 1.07 },
};

export const TIMING_MOD = {
  flexible: { label: 'Не срочно',                  mod: 1.00 },
  months_3: { label: 'Через 1–3 месяца',           mod: 1.00 },
  asap:     { label: 'Срочно (в течение месяца)',  mod: 1.07 },
};

// B2B modifiers
export const WALL_FINISH = {
  paint:         { label: 'Краска',                  mod: 1.00 },
  wallpaper:     { label: 'Обои',                    mod: 1.00 },
  decor_plaster: { label: 'Декоративная штукатурка', mod: 1.10 },
  panels:        { label: 'Панели (МДФ/буазери)',    mod: 1.18 },
  veneer:        { label: 'Шпон / стеновые панели',  mod: 1.28 },
  stone:         { label: 'Натуральный камень',      mod: 1.40 },
};

export const CEILING_FINISH = {
  stretch:       { label: 'Натяжной',                mod: 1.00 },
  drywall:       { label: 'Гипсокартон одноуровн.',  mod: 1.05 },
  drywall_multi: { label: 'Гипсокартон многоуровн.', mod: 1.12 },
  plaster:       { label: 'Штукатурка',              mod: 1.03 },
  molding:       { label: 'Лепнина / молдинги',      mod: 1.22 },
};

export const FLOOR_FINISH = {
  laminate:      { label: 'Ламинат',                mod: 1.00 },
  parquet_eng:   { label: 'Паркет инженерный',      mod: 1.10 },
  parquet_solid: { label: 'Паркет массив',          mod: 1.22 },
  porcelain:     { label: 'Керамогранит',           mod: 1.05 },
  marble:        { label: 'Мрамор / натур. камень', mod: 1.32 },
};

export const ENGINEERING = {
  standard:  { label: 'Стандарт',                                    mod: 1.00 },
  smart_home:{ label: 'Smart home',                                  mod: 1.12 },
  climate:   { label: 'Climate control + smart',                     mod: 1.20 },
  special:   { label: 'Спец. системы (кинотеатр, винотека)',          mod: 1.30 },
};

export const SUPERVISION = {
  included: { label: 'Входит в проект',  mod: 1.00 },
  separate: { label: 'Нужен отдельно',   mod: 1.05 },
  none:     { label: 'Не требуется',     mod: 1.00 },
};

export const FLOOR_LEVEL = {
  low:  { label: '1–5 этаж',        mod: 1.00 },
  mid:  { label: '6–15 этаж',       mod: 1.02 },
  high: { label: '16–25 этаж',      mod: 1.05 },
  top:  { label: '25+ / пентхаус',  mod: 1.08 },
};

export const WINDOW_COST_PER_TIER = {
  cosmetic: 65000, capital: 65000,
  euro: 95000, euro_top: 95000,
  premium: 170000, luxury: 170000,
};

export function getSplit(tier) {
  if (tier === 'cosmetic' || tier === 'capital') return { works: 0.45, rough: 0.20, finish: 0.35 };
  if (tier === 'euro' || tier === 'euro_top') return { works: 0.40, rough: 0.18, finish: 0.42 };
  return { works: 0.35, rough: 0.15, finish: 0.50 };
}

export function estimateDays(area, tier) {
  const factor = { cosmetic: 0.45, capital: 0.85, euro: 1.0, euro_top: 1.2, premium: 1.5, luxury: 1.9 }[tier] || 1.0;
  return Math.max(30, Math.round(area * factor));
}

function tierFromAnswers(answers) {
  if (answers.repair_type === 'cosmetic') return 'cosmetic';
  if (answers.repair_type === 'capital')  return 'capital';
  if (answers.repair_type === 'euro')     return 'euro';
  if (answers.repair_type === 'premium')  return 'premium';
  return 'capital';
}

export function calculateB2C(answers) {
  const tier = tierFromAnswers(answers);
  const tierDef = TIERS[tier];
  const area = parseFloat(answers.area) || 60;

  const houseMod = (HOUSE_MOD[answers.house_type] || { mod: 1.00 }).mod;
  const commsMod = (COMMS_MOD[answers.comms] || { mod: 1.00 }).mod;
  const replanMod = (REPLAN_MOD[answers.replan] || { mod: 1.00 }).mod;
  const designMod = (DESIGN_MOD[answers.design] || { mod: 1.00 }).mod;
  const timingMod = (TIMING_MOD[answers.timing] || { mod: 1.00 }).mod;
  const finishMod = answers.apartment_type === 'novostroyka' && answers.finish_type
    ? (FINISH_MOD[answers.finish_type] || { mod: 1.00 }).mod : 1.00;

  let densityMod = 1.00;
  if (area < 35) densityMod = 1.20;
  else if (area < 50) densityMod = 1.12;
  else if (area < 65) densityMod = 1.05;

  const totalMod = houseMod * commsMod * replanMod * designMod * timingMod * finishMod * densityMod;
  const lowPerM2 = Math.round(tierDef.baseLow * totalMod);
  const highPerM2 = Math.round(tierDef.baseHigh * totalMod);
  const totalLow = lowPerM2 * area;
  const totalHigh = highPerM2 * area;
  const split = getSplit(tier);

  return {
    tier, tierLabel: tierDef.label, area, lowPerM2, highPerM2,
    totalLow, totalHigh, avgTotal: Math.round((totalLow + totalHigh) / 2),
    breakdown: {
      works:  { low: Math.round(totalLow * split.works),  high: Math.round(totalHigh * split.works),  pct: split.works },
      rough:  { low: Math.round(totalLow * split.rough),  high: Math.round(totalHigh * split.rough),  pct: split.rough },
      finish: { low: Math.round(totalLow * split.finish), high: Math.round(totalHigh * split.finish), pct: split.finish },
    },
    days: estimateDays(area, tier),
    modifiers: Object.fromEntries(Object.entries({
      'Тип дома': HOUSE_MOD[answers.house_type]?.label,
      'Отделка': answers.apartment_type === 'novostroyka' ? FINISH_MOD[answers.finish_type]?.label : null,
      'Коммуникации': COMMS_MOD[answers.comms]?.label,
      'Перепланировка': REPLAN_MOD[answers.replan]?.label,
      'Дизайн-проект': DESIGN_MOD[answers.design]?.label,
      'Сроки': TIMING_MOD[answers.timing]?.label,
    }).filter(([, v]) => !!v)),
  };
}

export function calculateB2B(answers) {
  let tier = 'premium';
  let luxScore = 0;
  if (answers.wall_finish === 'stone') luxScore++;
  if (answers.floor_finish === 'marble') luxScore++;
  if (answers.ceiling_finish === 'molding') luxScore++;
  if (answers.engineering === 'special') luxScore++;
  if (luxScore >= 3) tier = 'luxury';

  const tierDef = TIERS[tier];
  const area = parseFloat(answers.area) || 150;
  const houseMod = (HOUSE_MOD[answers.house_type] || { mod: 1.00 }).mod;
  const floorLvl = (FLOOR_LEVEL[answers.floor_level] || { mod: 1.00 }).mod;
  const wallMod  = (WALL_FINISH[answers.wall_finish] || { mod: 1.00 }).mod;
  const ceilMod  = (CEILING_FINISH[answers.ceiling_finish] || { mod: 1.00 }).mod;
  const flrMod   = (FLOOR_FINISH[answers.floor_finish] || { mod: 1.00 }).mod;
  const engMod   = (ENGINEERING[answers.engineering] || { mod: 1.00 }).mod;
  const supMod   = (SUPERVISION[answers.supervision] || { mod: 1.00 }).mod;
  const baths = parseInt(answers.bathrooms || 1);
  const rooms = parseInt(answers.rooms || 3);
  const bathMod = 1 + Math.max(0, baths - 1) * 0.025;
  const roomMod = 1 + Math.max(0, rooms - 3) * 0.012;
  const finishMod = (wallMod * 0.4 + ceilMod * 0.25 + flrMod * 0.35);
  const totalMod = houseMod * floorLvl * finishMod * engMod * supMod * bathMod * roomMod;

  const lowPerM2 = Math.round(tierDef.baseLow * totalMod);
  const highPerM2 = Math.round(tierDef.baseHigh * totalMod);
  const baseLow = lowPerM2 * area;
  const baseHigh = highPerM2 * area;

  const windowsCount = Math.max(0, parseInt(answers.windows || 0));
  const windowUnitCost = WINDOW_COST_PER_TIER[tier] || WINDOW_COST_PER_TIER.euro;
  const windowsLow = Math.round(windowsCount * windowUnitCost * 0.92);
  const windowsHigh = Math.round(windowsCount * windowUnitCost * 1.08);
  const totalLow = baseLow + windowsLow;
  const totalHigh = baseHigh + windowsHigh;
  const split = getSplit(tier);

  const breakdown = {
    demo:        { low: Math.round(baseLow * 0.06),  high: Math.round(baseHigh * 0.06),  label: 'Демонтаж' },
    rough:       { low: Math.round(baseLow * split.rough), high: Math.round(baseHigh * split.rough), label: 'Черновые работы и материалы' },
    engineering: { low: Math.round(baseLow * 0.18),  high: Math.round(baseHigh * 0.18),  label: 'Инженерные системы' },
    finishing:   { low: Math.round(baseLow * (split.works + split.finish - 0.24)), high: Math.round(baseHigh * (split.works + split.finish - 0.24)), label: 'Отделка и чистовые материалы' },
  };
  if (windowsCount > 0) {
    breakdown.windows = { low: windowsLow, high: windowsHigh, label: `Окна (${windowsCount} шт)` };
  }

  return {
    tier, tierLabel: tierDef.label, area, lowPerM2, highPerM2,
    totalLow, totalHigh, avgTotal: Math.round((totalLow + totalHigh) / 2),
    breakdown, days: estimateDays(area, tier),
    windows: { count: windowsCount, unitCost: windowUnitCost, low: windowsLow, high: windowsHigh },
    modifiers: {
      'Тип здания': HOUSE_MOD[answers.house_type]?.label,
      'Этажность': FLOOR_LEVEL[answers.floor_level]?.label,
      'Стены': WALL_FINISH[answers.wall_finish]?.label,
      'Потолки': CEILING_FINISH[answers.ceiling_finish]?.label,
      'Полы': FLOOR_FINISH[answers.floor_finish]?.label,
      'Инженерия': ENGINEERING[answers.engineering]?.label,
      'Авторский надзор': SUPERVISION[answers.supervision]?.label,
      'Санузлы': baths + ' шт', 'Окна': windowsCount + ' шт', 'Комнаты': rooms + ' шт',
    },
  };
}

export function formatRub(n) {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return m.toFixed(m >= 10 ? 1 : 2).replace('.', ',') + ' млн ₽';
  }
  return n.toLocaleString('ru-RU') + ' ₽';
}

export function formatRubFull(n) { return Math.round(n).toLocaleString('ru-RU') + ' ₽'; }

export function formatDays(days) {
  const months = Math.round(days / 22 * 10) / 10;
  return `~${days} раб. дней (${months.toString().replace('.', ',')} мес)`;
}
