// Единая обёртка над /api/checklists* — страницы сами fetch не делают
// (часть 5 TASK_server_storage.md). Та же обработка сетевых ошибок, что в
// calcsApi.js: fetch, брошенный по обрыву связи, превращается в { ok:false, error:'network' }.

async function parseJson(res) {
  try { return await res.json(); } catch { return { ok: false, error: 'Ошибка сервера' }; }
}

async function request(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    return { ok: false, error: 'network' };
  }
  return parseJson(res);
}

export async function listChecklists() {
  return request('/api/checklists', { credentials: 'include' });
}

export async function getChecklist(checklistId) {
  return request(`/api/checklists/${checklistId}`, { credentials: 'include' });
}

// Браузеры ограничивают суммарный размер тела keepalive-запросов (в Chrome —
// около 64 КБ на все keepalive-запросы сразу); с запасом отсекаем на 60 КБ —
// при уходе со страницы лучше отправить обычный fetch (может не успеть),
// чем получить гарантированный отказ браузера от keepalive-запроса.
const KEEPALIVE_BODY_LIMIT = 60 * 1024;

// opts.keepalive — для сохранения при размонтировании страницы (уход/закрытие
// вкладки): запрос переживает уход со страницы, обычные сохранения его не передают.
export async function saveChecklist(checklistId, state, opts = {}) {
  const body = JSON.stringify({ state });
  const finalOpts = { ...opts };
  // .length считает символы JS-строки, не байты — с кириллицей (адрес,
  // комментарии) это заметно меньше реального UTF-8 размера, поэтому меряем точно.
  if (finalOpts.keepalive && new TextEncoder().encode(body).length > KEEPALIVE_BODY_LIMIT) {
    finalOpts.keepalive = false;
  }
  return request(`/api/checklists/${checklistId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body,
    ...finalOpts,
  });
}

export async function resetChecklist(checklistId) {
  return request(`/api/checklists/${checklistId}`, { method: 'DELETE', credentials: 'include' });
}

// blob — JPEG из compressImage (ChecklistDetailPage), переведённый из data URL.
export async function uploadChecklistPhoto(checklistId, itemKey, blob) {
  const form = new FormData();
  form.append('photo', blob, 'photo.jpg');
  form.append('itemKey', itemKey);
  return request(`/api/checklists/${checklistId}/photos`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
}

export async function deleteChecklistPhoto(id) {
  return request(`/api/checklists/photos/${id}`, { method: 'DELETE', credentials: 'include' });
}

export function checklistPhotoUrl(id) {
  return `/api/checklists/photos/${id}`;
}

// Скачивает фото по id и переводит в data URL. Нужно для PDF-акта: он открывается
// через window.open('', '_blank') — окно без своего origin, относительный
// /api/checklists/photos/:id в нём не загрузится, а generateReportHTML
// (checklistReport.js) принимает только data:image/... строки.
export async function fetchPhotoAsDataUrl(id) {
  const res = await fetch(checklistPhotoUrl(id), { credentials: 'include' });
  if (!res.ok) throw new Error('photo fetch failed');
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
