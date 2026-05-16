/**
 * Битрикс24 CRM — создание сделок через серверный прокси /api/lead.
 * Фронтенд → /api/lead (наш Express) → Битрикс24 (crm.deal.add + crm.contact.add).
 * CRM в «Простом режиме» — лидов нет, работаем только со сделками.
 */

/**
 * Создать сделку в CRM через серверный прокси.
 * Сервер сам создаст контакт и привяжет к сделке.
 */
export async function createLead({ name, phone, email, title, comment, source = 'WEB' }) {
  try {
    const res = await fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, name, phone, email, comment, source }),
    });

    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Lead send error:', err);
    return { ok: false, error: err.message };
  }
}

/**
 * Форматирует результат быстрого расчёта в комментарий для лида.
 */
export function formatQuickComment(result) {
  if (!result) return '';
  const lines = [
    `Тип расчёта: Быстрый (вилка цен)`,
    `Категория: ${result.tierLabel || result.tier}`,
    `Площадь: ${result.area} м²`,
    `Стоимость: ${result.totalLow?.toLocaleString('ru-RU')} — ${result.totalHigh?.toLocaleString('ru-RU')} ₽`,
    `Цена за м²: ${result.lowPerM2?.toLocaleString('ru-RU')} — ${result.highPerM2?.toLocaleString('ru-RU')} ₽/м²`,
    `Сроки: ~${result.days} раб. дней`,
  ];
  if (result.modifiers) {
    lines.push('', 'Параметры:');
    for (const [k, v] of Object.entries(result.modifiers)) {
      lines.push(`  ${k}: ${v}`);
    }
  }
  return lines.join('\n');
}

/**
 * Форматирует результат детальной сметы в комментарий для лида.
 */
export function formatDetailComment(result) {
  if (!result) return '';
  const inp = result.inputs || {};
  const lines = [
    `Тип расчёта: Детальная смета`,
    `Режим: ${result.mode === 'whitebox' ? 'WhiteBox' : 'Полная отделка'}`,
    `Площадь: ${inp.area || '—'} м²`,
    `Комнат: ${inp.rooms || '—'}, Санузлов: ${inp.sanitary || '—'}, Окон: ${inp.windows || '—'}`,
    `Итого: ${result.totals?.grand?.toLocaleString('ru-RU')} ₽`,
    `Цена за м²: ${result.perM2?.toLocaleString('ru-RU')} ₽/м²`,
    `Работы: ${result.totals?.works?.toLocaleString('ru-RU')} ₽ (${result.totals?.worksPct}%)`,
    `Материалы: ${result.totals?.materials?.toLocaleString('ru-RU')} ₽ (${result.totals?.matPct}%)`,
    `Позиций в смете: ${result.lines?.length || 0}`,
  ];
  return lines.join('\n');
}
