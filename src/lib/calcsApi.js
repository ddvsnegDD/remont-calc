// Единая обёртка над /api/calcs — страницы сами fetch не делают (часть 4 TASK_server_storage.md).

async function parseJson(res) {
  try { return await res.json(); } catch { return { ok: false, error: 'Ошибка сервера' }; }
}

// Сетевую ошибку (offline, обрыв соединения) fetch не превращает в HTTP-ответ,
// а бросает исключение — ловим его здесь, чтобы вызывающий код (submitting и т.п.)
// всегда получал { ok:false, ... } и не зависал в состоянии "отправляется".
async function request(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    return { ok: false, error: 'network' };
  }
  return parseJson(res);
}

export async function listCalcs() {
  return request('/api/calcs', { credentials: 'include' });
}

// kind: 'b2b' | 'office'. При лимите бесплатного плана сервер отвечает
// { ok:false, error:'limit' } — вызывающий код показывает пейволл, а не текст ошибки.
export async function createCalc({ kind, projectName, data }) {
  return request('/api/calcs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ kind, projectName, data }),
  });
}

export async function deleteCalc(id) {
  return request(`/api/calcs/${id}`, { method: 'DELETE', credentials: 'include' });
}
