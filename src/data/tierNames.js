// Единственный источник названий уровня. Маркетинговое имя ведёт на витрине,
// инженерное уточняет состав работ. Совпадают — показываем одно.
// Цены low/high собраны из TIERS (calculator.js), а не вписаны руками — карточка
// на главной не может разойтись с расчётом (см. docs/TASK_tier_naming.md, раздел 2).
import { TIERS } from '../lib/calculator';

const NAMES = {
  cosmetic: { marketing: 'Старт',   engineering: 'Косметический' },
  capital:  { marketing: 'Эконом',  engineering: 'Капитальный' },
  euro:     { marketing: 'Комфорт', engineering: 'Евроремонт' },
  euro_top: { marketing: 'Бизнес',  engineering: 'Евроремонт+' },
  premium:  { marketing: 'Премиум', engineering: 'Премиум' },
};

export const TIER_NAMES = Object.fromEntries(
  Object.entries(NAMES).map(([key, n]) => [
    key,
    { ...n, low: TIERS[key].baseLow, high: TIERS[key].baseHigh },
  ])
);

// «Комфорт · Евроремонт», но для премиума просто «Премиум».
export function tierTitle(key) {
  const t = TIER_NAMES[key];
  if (!t) return '';
  return t.marketing === t.engineering ? t.marketing : `${t.marketing} · ${t.engineering}`;
}
