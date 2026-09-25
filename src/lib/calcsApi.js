// Единая обёртка над /api/calcs — страницы сами fetch не делают (часть 4 TASK_server_storage.md).

async function parseJson(res) {
  try { return await res.json(); } catch { return { ok: false, error: 'Ошибка сервера' }; }
}

export async function listCalcs() {
  const res = await fetch('/api/calcs', { credentials: 'include' });
  return parseJson(res);
}

// kind: 'b2b' | 'office'. При лимите бесплатного плана сервер отвечает
// { ok:false, error:'limit' } — вызывающий код показывает пейволл, а не текст ошибки.
export async function createCalc({ kind, projectName, data }) {
  const res = await fetch('/api/calcs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ kind, projectName, data }),
  });
  return parseJson(res);
}

export async function deleteCalc(id) {
  const res = await fetch(`/api/calcs/${id}`, { method: 'DELETE', credentials: 'include' });
  return parseJson(res);
}
