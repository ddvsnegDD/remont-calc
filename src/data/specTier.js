// Единый источник правды для перевода уровня, выбранного в квизе (B2C — сырой
// answers.repair_type, B2B — вычисленный calculateB2B().tier), в уровень
// детальной сметы (SpecCalc.compute tier). Не дублировать — правка только здесь.
export const SPEC_TIER_FALLBACK = 'capital';

export const tierMap = {
  cosmetic: 'cosmetic',
  capital: 'capital',
  euro: 'euro',
  euro_top: 'euro',
  premium: 'premium',
  luxury: 'premium',
};

export function toSpecTier(value) {
  return tierMap[value] || SPEC_TIER_FALLBACK;
}
