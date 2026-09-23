// Единый источник правды по надбавке за перепланировку. Импортируется и
// src/lib/spec-calculator.js (детальная смета), и src/lib/calculator.js (быстрый квиз).
// Не дублировать эти четыре числа — ровно такое дублирование уже дало расхождение
// в HOUSE_MOD (legacy-ключи повторяют основные с другими значениями).
export const REPLAN_SURCHARGE = {
  no:    { label: 'Не требуется',                          fixed: 0,      pct: 0,    perM2: 0,   perRoom: 0 },
  light: { label: 'Лёгкая (без затрагивания несущих)',     fixed: 80000,  pct: 0,    perM2: 0,   perRoom: 0 },
  full:  { label: 'Полная (со согласованием в МЖИ)',       fixed: 80000,  pct: 0.05, perM2: 500, perRoom: 15000 },
};
