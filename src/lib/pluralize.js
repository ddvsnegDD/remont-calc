// Склонение существительного по числу (русский язык).
// forms: [форма для 1 (кроме 11), форма для 2–4 (кроме 12–14), форма для остальных].
// pluralRu(1, ['консультация','консультации','консультаций']) → 'консультация'
// pluralRu(3, [...]) → 'консультации'
// pluralRu(5, [...]) → 'консультаций'
export function pluralRu(n, forms) {
  const abs = Math.abs(Math.trunc(n)) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

// «N + согласованное слово», например withCount(3, ['расчёт','расчёта','расчётов']) → '3 расчёта'.
export function withCount(n, forms) {
  return `${n} ${pluralRu(n, forms)}`;
}
