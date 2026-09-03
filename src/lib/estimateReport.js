// Генерация печатных HTML-отчётов сметы (печать / сохранение в PDF)
import { formatRubFull, formatDays } from './calculator';

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtNum(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('ru-RU');
}

function pageWrap({ kicker, title, subtitleHtml, bodyHtml, disclaimer }) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>${esc(title)} — РПКМ</title>
  <style>
    @page { size: A4; margin: 16mm 14mm 20mm 14mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
      color: #1a1a1c;
      font-size: 13px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    table { border-collapse: collapse; width: 100%; }
    th, td { text-align: left; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    @media print {
      .no-print { display: none !important; }
      body { padding: 0; }
      .page-break { page-break-before: always; }
    }
    @media screen {
      body { max-width: 900px; margin: 0 auto; padding: 24px; background: #f5f5f5; }
      .page { background: #fff; padding: 32px; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
    }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:center; margin-bottom:20px; display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
    <button onclick="window.print()" style="padding:12px 28px; background:#B95C38; color:#fff; border:none; border-radius:8px; font-size:15px; font-weight:600; cursor:pointer;">
      🖨️ Распечатать / Сохранить PDF
    </button>
    <button onclick="window.close()" style="padding:12px 28px; background:#e5e7eb; color:#374151; border:none; border-radius:8px; font-size:15px; font-weight:600; cursor:pointer;">
      Закрыть
    </button>
  </div>

  <div class="page">
    <div style="text-align:center; margin-bottom:24px;">
      <div style="font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:2px; margin-bottom:6px;">
        ${esc(kicker)}
      </div>
      <h1 style="font-size:22px; font-weight:800; color:#1a1a1c; margin:0;">
        ${esc(title)}
      </h1>
      ${subtitleHtml ? `<div style="font-size:13px; color:#6b7280; margin-top:6px;">${subtitleHtml}</div>` : ''}
    </div>

    ${bodyHtml}

    ${disclaimer ? `<div style="margin-top:24px; padding:14px 16px; border:1px solid #f3d9c8; background:#fdf3ec; border-radius:6px; font-size:12px; color:#7a4a2f; line-height:1.5;">${esc(disclaimer)}</div>` : ''}

    <div style="margin-top:24px; text-align:center; font-size:10px; color:#9ca3af;">
      Сформировано в РПКМ (ddrpkm.ru) · ${new Date().toLocaleDateString('ru-RU')}
    </div>
  </div>
</body>
</html>`;
}

export function generateB2CSummaryReportHTML(lead) {
  const r = lead.result;
  const labels = { works: 'Работы', rough: 'Черновые материалы', finish: 'Чистовые материалы' };
  const subs = { works: 'Демонтаж, подготовка, монтаж', rough: 'Стяжка, штукатурка, проводка, трубы', finish: 'Краска, плитка, ламинат, сантехника' };

  let rows = '';
  ['works', 'rough', 'finish'].forEach(k => {
    const b = r.breakdown[k];
    rows += `
      <tr>
        <td style="border:1px solid #d1d5db; padding:8px 12px;">
          <div style="font-weight:600;">${esc(labels[k])}</div>
          <div style="font-size:11px; color:#6b7280;">${esc(subs[k])}</div>
        </td>
        <td class="num" style="border:1px solid #d1d5db; padding:8px 12px;">${Math.round(b.pct * 100)}%</td>
        <td class="num" style="border:1px solid #d1d5db; padding:8px 12px;"><strong>${formatRubFull(b.low)} — ${formatRubFull(b.high)}</strong></td>
      </tr>`;
  });

  const body = `
    <div style="text-align:center; margin:20px 0 28px; padding:20px; background:#f8f5f2; border-radius:8px;">
      <div style="font-size:12px; color:#6b7280; text-transform:uppercase; letter-spacing:1px;">Ориентировочная стоимость</div>
      <div style="font-size:28px; font-weight:800; color:#B95C38; margin-top:6px;">${formatRubFull(r.totalLow)} — ${formatRubFull(r.totalHigh)}</div>
    </div>

    <table style="margin-bottom:20px;">
      <tr>
        <td style="border:1px solid #d1d5db; padding:8px 12px;"><span style="color:#6b7280;">Площадь</span><br><strong>${esc(r.area)} м²</strong></td>
        <td style="border:1px solid #d1d5db; padding:8px 12px;"><span style="color:#6b7280;">Категория</span><br><strong>${esc(r.tierLabel)}</strong></td>
        <td style="border:1px solid #d1d5db; padding:8px 12px;"><span style="color:#6b7280;">Цена за м²</span><br><strong>${fmtNum(r.lowPerM2)}–${fmtNum(r.highPerM2)} ₽</strong></td>
      </tr>
    </table>

    <h2 style="font-size:15px; margin-bottom:10px;">Разбивка стоимости</h2>
    <table>
      <thead><tr>
        <th style="background:#1a1a1c; color:#fff; padding:8px 12px; border:1px solid #1a1a1c;">Статья</th>
        <th class="num" style="background:#1a1a1c; color:#fff; padding:8px 12px; border:1px solid #1a1a1c;">Доля</th>
        <th class="num" style="background:#1a1a1c; color:#fff; padding:8px 12px; border:1px solid #1a1a1c;">Сумма</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  return pageWrap({
    kicker: 'РПКМ · ориентировочный расчёт',
    title: 'Смета на ремонт',
    subtitleHtml: lead.contact?.email ? `Расчёт для ${esc(lead.contact.email)}` : '',
    bodyHtml: body,
    disclaimer: 'Расчёт носит предварительный характер. Это вилка стоимости на основе средней цены 1 м² и факторов сложности. Итоговая смета зависит от конкретных материалов и подрядчика.',
  });
}

export function generateB2CDetailReportHTML(lead) {
  const r = lead.result;
  const inp = r.inputs;
  const modeLabel = r.mode === 'whitebox' ? 'WhiteBox' : 'Полная отделка';

  let groupsHtml = '';
  r.groups.forEach(g => {
    let rows = '';
    g.lines.forEach(ln => {
      rows += `
        <tr>
          <td style="border:1px solid #d1d5db; padding:6px 8px; font-size:12px;">${esc(ln.name)}</td>
          <td style="border:1px solid #d1d5db; padding:6px 8px; font-size:12px; color:#6b7280;">${esc(ln.material) || '—'}</td>
          <td class="num" style="border:1px solid #d1d5db; padding:6px 8px; font-size:12px;">${fmtNum(ln.volume)} ${esc(ln.unit)}</td>
          <td class="num" style="border:1px solid #d1d5db; padding:6px 8px; font-size:12px;">${formatRubFull(ln.workCost)}</td>
          <td class="num" style="border:1px solid #d1d5db; padding:6px 8px; font-size:12px;">${formatRubFull(ln.matCost)}</td>
          <td class="num" style="border:1px solid #d1d5db; padding:6px 8px; font-size:12px;"><strong>${formatRubFull(ln.total)}</strong></td>
        </tr>`;
    });
    groupsHtml += `
      <h3 style="font-size:13px; margin:18px 0 8px; display:flex; justify-content:space-between;">
        <span>${g.icon || ''} ${esc(g.title)}</span>
        <span>${formatRubFull(g.total)}</span>
      </h3>
      <table style="margin-bottom:8px;">
        <thead><tr>
          <th style="border:1px solid #d1d5db; padding:6px 8px; font-size:11px; background:#f0f4f8;">Работа</th>
          <th style="border:1px solid #d1d5db; padding:6px 8px; font-size:11px; background:#f0f4f8;">Материал</th>
          <th class="num" style="border:1px solid #d1d5db; padding:6px 8px; font-size:11px; background:#f0f4f8;">Объём</th>
          <th class="num" style="border:1px solid #d1d5db; padding:6px 8px; font-size:11px; background:#f0f4f8;">Работы</th>
          <th class="num" style="border:1px solid #d1d5db; padding:6px 8px; font-size:11px; background:#f0f4f8;">Материалы</th>
          <th class="num" style="border:1px solid #d1d5db; padding:6px 8px; font-size:11px; background:#f0f4f8;">Итого</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  });

  const body = `
    <div style="text-align:center; margin:20px 0 28px; padding:20px; background:#f8f5f2; border-radius:8px;">
      <div style="font-size:12px; color:#6b7280; text-transform:uppercase; letter-spacing:1px;">${esc(modeLabel)} · ${r.lines.length} позиций</div>
      <div style="font-size:28px; font-weight:800; color:#B95C38; margin-top:6px;">${formatRubFull(r.totals.grand)}</div>
      <div style="font-size:13px; color:#6b7280; margin-top:4px;">${fmtNum(r.perM2)} ₽/м²</div>
    </div>

    <table style="margin-bottom:20px;">
      <tr>
        <td style="border:1px solid #d1d5db; padding:8px 12px;"><span style="color:#6b7280;">Площадь</span><br><strong>${esc(inp.area)} м²</strong></td>
        <td style="border:1px solid #d1d5db; padding:8px 12px;"><span style="color:#6b7280;">Комнат</span><br><strong>${esc(inp.rooms)}</strong></td>
        <td style="border:1px solid #d1d5db; padding:8px 12px;"><span style="color:#6b7280;">Санузлов</span><br><strong>${esc(inp.sanitary)}</strong></td>
        <td style="border:1px solid #d1d5db; padding:8px 12px;"><span style="color:#6b7280;">Окон</span><br><strong>${esc(inp.windows)}</strong></td>
      </tr>
    </table>

    ${groupsHtml}
  `;

  return pageWrap({
    kicker: 'РПКМ · детальная смета',
    title: 'Детальная смета на ремонт',
    subtitleHtml: lead.contact?.email ? `Расчёт для ${esc(lead.contact.email)}` : '',
    bodyHtml: body,
    disclaimer: 'Расчёт носит предварительный характер. Это вилка стоимости на основе средней цены 1 м² и факторов сложности. Итоговая смета зависит от конкретных материалов и подрядчика.',
  });
}

export function generateB2BReportHTML({ projectName, timestamp, r, specResult, showSpec }) {
  const breakdownItems = Object.values(r.breakdown || {});
  const modRows = Object.entries(r.modifiers || {});

  let breakdownRows = '';
  breakdownItems.forEach(b => {
    breakdownRows += `
      <tr>
        <td style="border:1px solid #d1d5db; padding:8px 12px;">${esc(b.label)}</td>
        <td class="num" style="border:1px solid #d1d5db; padding:8px 12px;"><strong>${formatRubFull(b.low)} – ${formatRubFull(b.high)}</strong></td>
      </tr>`;
  });

  let modRowsHtml = '';
  modRows.forEach(([k, v]) => {
    modRowsHtml += `
      <tr>
        <td style="border:1px solid #d1d5db; padding:6px 10px; font-size:12px; color:#6b7280;">${esc(k)}</td>
        <td style="border:1px solid #d1d5db; padding:6px 10px; font-size:12px;"><strong>${esc(v)}</strong></td>
      </tr>`;
  });

  let specSection = '';
  if (showSpec && specResult) {
    let specRows = '';
    specResult.groups.forEach(g => {
      specRows += `
        <tr><td colspan="6" style="background:#f0f4f8; padding:6px 10px; font-weight:700; font-size:12px; border:1px solid #d1d5db;">${g.icon || ''} ${esc(g.title)} — ${formatRubFull(g.total)}</td></tr>`;
      g.lines.forEach(ln => {
        specRows += `
          <tr>
            <td style="border:1px solid #d1d5db; padding:5px 8px; font-size:11px;">${esc(ln.name)}</td>
            <td style="border:1px solid #d1d5db; padding:5px 8px; font-size:11px; color:#6b7280;">${esc(ln.material) || '—'}</td>
            <td class="num" style="border:1px solid #d1d5db; padding:5px 8px; font-size:11px;">${fmtNum(ln.volume)} ${esc(ln.unit)}</td>
            <td class="num" style="border:1px solid #d1d5db; padding:5px 8px; font-size:11px;">${formatRubFull(ln.workCost)}</td>
            <td class="num" style="border:1px solid #d1d5db; padding:5px 8px; font-size:11px;">${formatRubFull(ln.matCost)}</td>
            <td class="num" style="border:1px solid #d1d5db; padding:5px 8px; font-size:11px;"><strong>${formatRubFull(ln.total)}</strong></td>
          </tr>`;
      });
    });

    specSection = `
      <div class="page-break"></div>
      <h2 style="font-size:15px; margin:20px 0 4px;">Детальная спецификация · ${specResult.lines.length} позиций</h2>
      <div style="font-size:13px; color:#6b7280; margin-bottom:10px;">${formatRubFull(specResult.totals.grand)} (${fmtNum(specResult.perM2)} ₽/м²)</div>
      <table>
        <thead><tr>
          <th style="border:1px solid #1a1a1c; background:#1a1a1c; color:#fff; padding:6px 8px; font-size:11px;">Раздел / работа</th>
          <th style="border:1px solid #1a1a1c; background:#1a1a1c; color:#fff; padding:6px 8px; font-size:11px;">Материал</th>
          <th class="num" style="border:1px solid #1a1a1c; background:#1a1a1c; color:#fff; padding:6px 8px; font-size:11px;">Объём</th>
          <th class="num" style="border:1px solid #1a1a1c; background:#1a1a1c; color:#fff; padding:6px 8px; font-size:11px;">Работы</th>
          <th class="num" style="border:1px solid #1a1a1c; background:#1a1a1c; color:#fff; padding:6px 8px; font-size:11px;">Материалы</th>
          <th class="num" style="border:1px solid #1a1a1c; background:#1a1a1c; color:#fff; padding:6px 8px; font-size:11px;">Итого</th>
        </tr></thead>
        <tbody>${specRows}</tbody>
        <tfoot>
          <tr style="background:#f0f4f8; font-weight:700;">
            <td colspan="3" style="border:1px solid #d1d5db; padding:8px;">ИТОГО</td>
            <td class="num" style="border:1px solid #d1d5db; padding:8px;">${formatRubFull(specResult.totals.works)}</td>
            <td class="num" style="border:1px solid #d1d5db; padding:8px;">${formatRubFull(specResult.totals.materials)}</td>
            <td class="num" style="border:1px solid #d1d5db; padding:8px;">${formatRubFull(specResult.totals.grand)}</td>
          </tr>
        </tfoot>
      </table>`;
  }

  const body = `
    <div style="text-align:center; margin:20px 0 28px; padding:20px; background:#f8f5f2; border-radius:8px;">
      <div style="font-size:12px; color:#6b7280; text-transform:uppercase; letter-spacing:1px;">Метод 1 · вилка по квизу</div>
      <div style="font-size:28px; font-weight:800; color:#B95C38; margin-top:6px;">${formatRubFull(r.totalLow)} – ${formatRubFull(r.totalHigh)}</div>
    </div>

    <table style="margin-bottom:20px;">
      <tr>
        <td style="border:1px solid #d1d5db; padding:8px 12px;"><span style="color:#6b7280;">Площадь</span><br><strong>${esc(r.area)} м²</strong></td>
        <td style="border:1px solid #d1d5db; padding:8px 12px;"><span style="color:#6b7280;">Категория</span><br><strong>${esc(r.tierLabel)}</strong></td>
        <td style="border:1px solid #d1d5db; padding:8px 12px;"><span style="color:#6b7280;">Цена за м²</span><br><strong>${fmtNum(r.lowPerM2)} – ${fmtNum(r.highPerM2)} ₽</strong></td>
        <td style="border:1px solid #d1d5db; padding:8px 12px;"><span style="color:#6b7280;">Сроки</span><br><strong>${formatDays(r.days)}</strong></td>
      </tr>
    </table>

    <h2 style="font-size:15px; margin-bottom:8px;">Разбивка по статьям</h2>
    <table style="margin-bottom:16px;">
      <tbody>${breakdownRows}</tbody>
    </table>

    ${modRows.length ? `
      <h2 style="font-size:15px; margin-bottom:8px;">Параметры расчёта</h2>
      <table style="margin-bottom:8px;"><tbody>${modRowsHtml}</tbody></table>
    ` : ''}

    ${specSection}
  `;

  return pageWrap({
    kicker: 'РПКМ · коммерческий расчёт',
    title: projectName || 'Смета проекта',
    subtitleHtml: `Расчёт от ${esc(new Date(timestamp).toLocaleString('ru-RU'))}`,
    bodyHtml: body,
    disclaimer: 'Расчёт по средней стоимости 1 м² с учётом коэффициентов сложности. Точная цена формируется после проектной документации и спецификаций. Итоговая стоимость зависит от конкретных материалов, объёмов по факту и условий подрядчика.',
  });
}

export function generateB2BOfficeReportHTML(calc) {
  const r = calc.result;
  const inp = r.inputs;

  let sectionsHtml = '';
  r.sections.forEach(sec => {
    if (sec.skipped) {
      sectionsHtml += `
        <tr><td colspan="3" style="border:1px solid #d1d5db; padding:8px 10px; font-size:12px; color:#9ca3af; text-decoration:line-through;">${sec.icon || ''} ${esc(sec.title)} — ${esc(sec.skipReason)}</td></tr>`;
      return;
    }
    sectionsHtml += `
      <tr><td colspan="3" style="background:#f0f4f8; padding:6px 10px; font-weight:700; font-size:12px; border:1px solid #d1d5db;">${sec.icon || ''} ${esc(sec.title)} — ${formatRubFull(sec.total)}</td></tr>`;
    sec.lines.forEach(ln => {
      sectionsHtml += `
        <tr${ln.excluded ? ' style="color:#9ca3af; text-decoration:line-through;"' : ''}>
          <td style="border:1px solid #d1d5db; padding:5px 8px; font-size:11px;">${esc(ln.title)}${ln.excluded ? ' (исключено)' : ''}${ln.optional && !ln.excluded ? ' (опц.)' : ''}</td>
          <td class="num" style="border:1px solid #d1d5db; padding:5px 8px; font-size:11px;">${ln.excluded ? '—' : fmtNum(ln.perM2)}</td>
          <td class="num" style="border:1px solid #d1d5db; padding:5px 8px; font-size:11px;"><strong>${ln.excluded ? '—' : formatRubFull(ln.total)}</strong></td>
        </tr>`;
    });
  });

  let modsHtml = '';
  if (r.modifiers && r.modifiers.length) {
    r.modifiers.forEach(m => {
      modsHtml += `
        <tr>
          <td style="border:1px solid #d1d5db; padding:6px 10px; font-size:12px;">${esc(m.label)}<div style="font-size:10px; color:#6b7280;">${esc(m.hint)}</div></td>
          <td class="num" style="border:1px solid #d1d5db; padding:6px 10px; font-size:12px;">+${formatRubFull(m.cost)}</td>
        </tr>`;
    });
  }

  const body = `
    <div style="text-align:center; margin:20px 0 28px; padding:20px; background:#f0f4fa; border-radius:8px;">
      <div style="font-size:12px; color:#6b7280; text-transform:uppercase; letter-spacing:1px;">Итоговая стоимость</div>
      <div style="font-size:28px; font-weight:800; color:#B95C38; margin-top:6px;">${formatRubFull(r.totals.grand)}</div>
      <div style="font-size:13px; color:#6b7280; margin-top:4px;">${fmtNum(r.totals.perM2Grand)} ₽/м² · категория ${esc(r.tierLabel)} · площадь ${esc(inp.area)} м²</div>
    </div>

    <table style="margin-bottom:20px;">
      <tr>
        <td style="border:1px solid #d1d5db; padding:6px 10px; font-size:11px;"><span style="color:#6b7280;">Рабочих мест</span><br><strong>${esc(inp.workplaces)}</strong></td>
        <td style="border:1px solid #d1d5db; padding:6px 10px; font-size:11px;"><span style="color:#6b7280;">Переговорных</span><br><strong>${esc(inp.meetingRooms)}</strong></td>
        <td style="border:1px solid #d1d5db; padding:6px 10px; font-size:11px;"><span style="color:#6b7280;">Мебель</span><br><strong>${inp.furniture !== false ? 'Включена' : 'Нет'}</strong></td>
        <td style="border:1px solid #d1d5db; padding:6px 10px; font-size:11px;"><span style="color:#6b7280;">Серверная</span><br><strong>${inp.serverRoom ? 'Есть' : 'Нет'}</strong></td>
      </tr>
    </table>

    <h2 style="font-size:15px; margin-bottom:8px;">Распределение бюджета по статьям</h2>
    <table style="margin-bottom:16px;"><tbody>${sectionsHtml}</tbody></table>

    ${modsHtml ? `
      <h2 style="font-size:15px; margin-bottom:8px;">Модификаторы расчёта</h2>
      <table style="margin-bottom:16px;"><tbody>${modsHtml}</tbody></table>
    ` : ''}

    <table>
      <tr style="background:#f0f4f8;">
        <td style="border:1px solid #d1d5db; padding:8px 12px; font-size:13px;">Основной бюджет</td>
        <td class="num" style="border:1px solid #d1d5db; padding:8px 12px; font-size:13px;"><strong>${formatRubFull(r.totals.main)}</strong></td>
      </tr>
      <tr style="background:#e8eef7;">
        <td style="border:2px solid #B95C38; padding:10px 12px; font-size:15px; font-weight:700;">ИТОГО</td>
        <td class="num" style="border:2px solid #B95C38; padding:10px 12px; font-size:16px; font-weight:800;">${formatRubFull(r.totals.grand)}</td>
      </tr>
    </table>
  `;

  return pageWrap({
    kicker: 'РПКМ · офисный fit-out',
    title: calc.projectName || 'Смета офисного fit-out',
    subtitleHtml: `Расчёт от ${esc(new Date(calc.timestamp).toLocaleString('ru-RU'))}`,
    bodyHtml: body,
    disclaimer: 'Расчёт носит предварительный характер: итоговая стоимость зависит от конкретных материалов, объёмов по факту и условий подрядчика.',
  });
}

export function openReportWindow(html) {
  const w = window.open('', '_blank');
  if (!w) {
    alert('Разрешите всплывающие окна для формирования отчёта');
    return;
  }
  w.document.write(html);
  w.document.close();
}
