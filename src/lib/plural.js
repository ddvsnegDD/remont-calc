// Русское склонение существительного при числительном.
// forms: [1 позиция, 2 позиции, 5 позиций]
export function plural(n, forms) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

export const positions = n => `${n} ${plural(n, ['позиция', 'позиции', 'позиций'])}`;

// «N + согласованное слово» для произвольного существительного,
// например withCount(3, ['расчёт', 'расчёта', 'расчётов']) → '3 расчёта'.
export const withCount = (n, forms) => `${n} ${plural(n, forms)}`;
