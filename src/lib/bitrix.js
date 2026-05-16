/**
 * Битрикс24 CRM — отправка лидов через входящий вебхук.
 * REST API docs: https://apidocs.bitrix24.ru/api-reference/crm/leads/
 */

const WEBHOOK = 'https://b24-0ouhlh.bitrix24.ru/rest/1/j3vt2f9w9lh6s23x';

/**
 * Создать лид в CRM.
 * @param {Object} params
 * @param {string} params.name      — имя клиента
 * @param {string} params.phone     — телефон
 * @param {string} [params.email]   — email (опционально)
 * @param {string} params.title     — заголовок лида (например «B2C · Быстрый расчёт · 60 м²»)
 * @param {string} [params.comment] — комментарий с деталями расчёта
 * @param {string} [params.source]  — источник (WEB, CALLBACK, OTHER)
 * @returns {Promise<{ok: boolean, id?: number, error?: string}>}
 */
export async function createLead({ name, phone, email, title, comment, source = 'WEB' }) {
  const fields = {
    TITLE: title || 'Заявка с сайта РПКМ',
    NAME: name,
    PHONE: [{ VALUE: phone, VALUE_TYPE: 'WORK' }],
    SOURCE_ID: source,
    OPENED: 'Y',
    STATUS_ID: 'NEW',
  };

  if (email) {
    fields.EMAIL = [{ VALUE: email, VALUE_TYPE: 'WORK' }];
  }

  if (comment) {
    fields.COMMENTS = comment;
  }

  try {
    const res = await fetch(`${WEBHOOK}/crm.lead.add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });

    const data = await res.json();

    if (data.result) {
      return { ok: true, id: data.result };
    }
    return { ok: false, error: data.error_description || 'Неизвестная ошибка' };
  } catch (err) {
    console.error('Bitrix24 lead error:', err);
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
