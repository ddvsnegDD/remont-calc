// Единая обёртка над /api/consultation* — страница сама fetch не делает
// (часть 6 TASK_server_storage.md). Та же обработка сетевых ошибок, что в
// calcsApi.js/checklistsApi.js: fetch, брошенный по обрыву связи, превращается
// в { ok:false, error:'network' }.

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

export async function getConsultationStatus() {
  return request('/api/consultation/status', { credentials: 'include' });
}

export async function createConsultation() {
  return request('/api/consultation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
}
