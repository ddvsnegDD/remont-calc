// Генерация HTML-отчёта для печати / сохранения в PDF
import { CHECKLISTS } from '../data/checklists';

const RESULT_LABELS = {
  accepted: 'Работы приняты без замечаний',
  with_remarks: 'Приняты с замечаниями (см. выше)',
  rejected: 'Работы не приняты, требуется устранение недостатков',
};

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(dateStr) {
  if (!dateStr) return '_______________';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function generateReportHTML(checklistId, state) {
  const checklist = CHECKLISTS.find(c => c.id === checklistId);
  if (!checklist) return '';

  const meta = state.meta || {};
  const items = state.items || {};

  const totalItems = checklist.groups.reduce((s, g) => s + g.items.length, 0);
  const checkedCount = Object.values(items).filter(v => v.checked).length;

  // Collect all photos
  const allPhotos = [];
  checklist.groups.forEach((group, gIdx) => {
    group.items.forEach((text, iIdx) => {
      const key = `${gIdx}_${iIdx}`;
      const item = items[key];
      if (item?.photos?.length) {
        item.photos.forEach((photo, pIdx) => {
          allPhotos.push({ group: group.title, item: text, num: gIdx * 100 + iIdx + 1, photo, pIdx });
        });
      }
    });
  });

  // Build table rows
  let tableRows = '';
  let globalNum = 0;
  checklist.groups.forEach((group, gIdx) => {
    // Group header row
    tableRows += `
      <tr>
        <td colspan="4" style="background:#f0f4f8; padding:8px 12px; font-weight:700; font-size:13px; color:#1a1a1c; border:1px solid #d1d5db;">
          ${esc(group.title)}
        </td>
      </tr>`;

    group.items.forEach((text, iIdx) => {
      globalNum++;
      const key = `${gIdx}_${iIdx}`;
      const item = items[key] || {};
      const checked = item.checked;
      const hasPhotos = item.photos?.length > 0;
      const comment = item.comment;

      tableRows += `
      <tr>
        <td style="width:36px; text-align:center; border:1px solid #d1d5db; padding:6px 4px; font-size:12px; color:#6b7280;">
          ${globalNum}
        </td>
        <td style="border:1px solid #d1d5db; padding:6px 10px; font-size:13px; line-height:1.4; color:#1a1a1c;">
          ${esc(text)}
          ${comment ? `<div style="margin-top:4px; font-size:11px; color:#6b7280; font-style:italic;">Комментарий: ${esc(comment)}</div>` : ''}
          ${hasPhotos ? `<div style="margin-top:4px; font-size:11px; color:#2563eb;">📷 ${item.photos.length} фото (см. приложение)</div>` : ''}
        </td>
        <td style="width:70px; text-align:center; border:1px solid #d1d5db; padding:6px 4px; font-size:16px;">
          ${checked ? '✅' : '☐'}
        </td>
      </tr>`;
    });
  });

  // Photos section
  let photosSection = '';
  if (allPhotos.length > 0) {
    photosSection = `
      <div style="page-break-before:always;"></div>
      <h2 style="font-size:16px; margin:24px 0 12px; color:#1a1a1c; border-bottom:2px solid #1a1a1c; padding-bottom:6px;">
        ПРИЛОЖЕНИЕ: ФОТОМАТЕРИАЛЫ
      </h2>
      <p style="font-size:12px; color:#6b7280; margin-bottom:16px;">
        Всего ${allPhotos.length} фотографий к чек-листу
      </p>`;

    allPhotos.forEach((p, i) => {
      photosSection += `
      <div style="margin-bottom:16px; ${i > 0 && i % 3 === 0 ? 'page-break-before:always;' : ''}">
        <div style="font-size:12px; color:#6b7280; margin-bottom:4px;">
          <strong>${esc(p.group)}</strong> — п.${p.num}
        </div>
        <div style="font-size:11px; color:#374151; margin-bottom:6px;">${esc(p.item)}</div>
        <img src="${p.photo}" style="max-width:100%; max-height:300px; border:1px solid #d1d5db; border-radius:4px;" />
      </div>`;
    });
  }

  // Result section
  const resultLabel = RESULT_LABELS[meta.result] || '';
  const resultChecks = Object.entries(RESULT_LABELS).map(([key, label]) => {
    const selected = meta.result === key;
    return `<div style="margin-bottom:6px; font-size:13px;">
      ${selected ? '☑' : '☐'} ${esc(label)}
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Чек-лист приёмки — ${esc(checklist.title)}</title>
  <style>
    @page {
      size: A4;
      margin: 16mm 14mm 20mm 14mm;
    }
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
    @media print {
      .no-print { display: none !important; }
      body { padding: 0; }
    }
    @media screen {
      body { max-width: 800px; margin: 0 auto; padding: 24px; background: #f5f5f5; }
      .page { background: #fff; padding: 32px; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
    }
  </style>
</head>
<body>
  <!-- Print controls -->
  <div class="no-print" style="text-align:center; margin-bottom:20px; display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
    <button onclick="window.print()" style="padding:12px 28px; background:#B95C38; color:#fff; border:none; border-radius:8px; font-size:15px; font-weight:600; cursor:pointer;">
      🖨️ Распечатать / Сохранить PDF
    </button>
    <button onclick="window.close()" style="padding:12px 28px; background:#e5e7eb; color:#374151; border:none; border-radius:8px; font-size:15px; font-weight:600; cursor:pointer;">
      Закрыть
    </button>
  </div>

  <div class="page">
    <!-- Header -->
    <div style="text-align:center; margin-bottom:24px;">
      <div style="font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:2px; margin-bottom:6px;">
        ЧЕК-ЛИСТ ПРИЁМКИ РАБОТ
      </div>
      <h1 style="font-size:22px; font-weight:800; color:#1a1a1c; margin:0;">
        ${esc(checklist.title)}
      </h1>
      <div style="font-size:12px; color:#6b7280; margin-top:6px;">
        ${checkedCount} из ${totalItems} пунктов отмечено · ${allPhotos.length} фото
      </div>
    </div>

    <!-- Object info -->
    <table style="margin-bottom:20px;">
      <tr>
        <td style="border:1px solid #d1d5db; padding:8px 12px; width:50%; font-size:13px;">
          <span style="color:#6b7280;">Объект (адрес):</span><br>
          <strong>${esc(meta.address) || '______________________________________'}</strong>
        </td>
        <td style="border:1px solid #d1d5db; padding:8px 12px; font-size:13px;">
          <span style="color:#6b7280;">Помещение:</span><br>
          <strong>${esc(meta.room) || '______________________'}</strong>
        </td>
      </tr>
      <tr>
        <td style="border:1px solid #d1d5db; padding:8px 12px; font-size:13px;">
          <span style="color:#6b7280;">Дата приёмки:</span><br>
          <strong>${formatDate(meta.date)}</strong>
        </td>
        <td style="border:1px solid #d1d5db; padding:8px 12px; font-size:13px;">
          <span style="color:#6b7280;">Этап:</span><br>
          <strong>${esc(checklist.title)}</strong>
        </td>
      </tr>
    </table>

    <!-- Checklist table -->
    <table>
      <thead>
        <tr style="background:#1a1a1c;">
          <th style="color:#fff; padding:8px 4px; text-align:center; font-size:11px; border:1px solid #1a1a1c; width:36px;">№</th>
          <th style="color:#fff; padding:8px 12px; text-align:left; font-size:11px; border:1px solid #1a1a1c;">Проверяемый параметр</th>
          <th style="color:#fff; padding:8px 4px; text-align:center; font-size:11px; border:1px solid #1a1a1c; width:70px;">Принято</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>

    <!-- Comments -->
    <div style="margin-top:24px;">
      <div style="font-size:13px; font-weight:700; margin-bottom:8px;">Замечания и комментарии заказчика:</div>
      <div style="min-height:${meta.comments ? '40px' : '80px'}; border:1px solid #d1d5db; border-radius:4px; padding:10px; font-size:13px; line-height:1.6; white-space:pre-wrap;">
        ${esc(meta.comments) || ''}
      </div>
    </div>

    <!-- Result -->
    <div style="margin-top:20px; padding:16px; border:1px solid #d1d5db; border-radius:4px;">
      ${resultChecks}
    </div>

    <!-- Signatures -->
    <div style="margin-top:32px; display:flex; gap:24px;">
      <div style="flex:1; border:1px solid #d1d5db; border-radius:4px; padding:16px;">
        <div style="font-size:13px; font-weight:700; margin-bottom:12px;">Заказчик</div>
        <div style="font-size:12px; color:#6b7280; margin-bottom:18px;">ФИО: _________________________________</div>
        <div style="font-size:12px; color:#6b7280; margin-bottom:18px;">Подпись: ______________________________</div>
        <div style="font-size:12px; color:#6b7280;">Дата: _________________________________</div>
      </div>
      <div style="flex:1; border:1px solid #d1d5db; border-radius:4px; padding:16px;">
        <div style="font-size:13px; font-weight:700; margin-bottom:12px;">Подрядчик / Прораб</div>
        <div style="font-size:12px; color:#6b7280; margin-bottom:18px;">ФИО: _________________________________</div>
        <div style="font-size:12px; color:#6b7280; margin-bottom:18px;">Подпись: ______________________________</div>
        <div style="font-size:12px; color:#6b7280;">Дата: _________________________________</div>
      </div>
    </div>

    <!-- Footer -->
    <div style="margin-top:24px; text-align:center; font-size:10px; color:#9ca3af;">
      Сформировано в РПКМ · ${new Date().toLocaleDateString('ru-RU')}
    </div>

    <!-- Photos appendix -->
    ${photosSection}
  </div>
</body>
</html>`;
}

export function openReportWindow(checklistId, state) {
  const html = generateReportHTML(checklistId, state);
  const w = window.open('', '_blank');
  if (!w) {
    alert('Разрешите всплывающие окна для формирования отчёта');
    return;
  }
  w.document.write(html);
  w.document.close();
}
