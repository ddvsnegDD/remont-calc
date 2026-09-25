// Единственное место, которое знает, что фото чек-листов лежат на диске.
// Часть 2 TASK_server_storage.md. Переезд на объектное хранилище — замена
// этого файла, остальной код с диском напрямую не работает.
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '';

if (!UPLOAD_DIR) {
  console.warn('UPLOAD_DIR не задан — загрузка фото недоступна, эндпоинты отвечают 503.');
}

export function isStorageReady() {
  return !!UPLOAD_DIR;
}

// Целое положительное число — защита deleteUserFiles от рекурсивного удаления
// не туда (например, если userId вдруг придёт NaN/undefined/строкой с '../').
function userDir(userId) {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error(`storage: некорректный userId: ${userId}`);
  }
  return path.join(UPLOAD_DIR, String(userId));
}

// Проверяет, что итоговый путь остаётся внутри UPLOAD_DIR/<user_id>/ — защита
// от `../` в имени файла, даже если имя когда-нибудь придёт не изнутри этого модуля.
export function photoPath(userId, fileName) {
  const dir = userDir(userId);
  const resolvedDir = path.resolve(dir) + path.sep;
  const resolvedFull = path.resolve(dir, fileName);
  if (!resolvedFull.startsWith(resolvedDir)) {
    throw new Error('Недопустимый путь к файлу фото');
  }
  return resolvedFull;
}

// Имя всегда генерируется здесь (crypto.randomUUID()), никогда не берётся из запроса.
export async function savePhoto(userId, buffer) {
  const dir = userDir(userId);
  await fs.mkdir(dir, { recursive: true });
  const fileName = `${crypto.randomUUID()}.jpg`;
  await fs.writeFile(photoPath(userId, fileName), buffer);
  return fileName;
}

export async function deletePhoto(userId, fileName) {
  await fs.unlink(photoPath(userId, fileName));
}

// Вызывается из deleteUser (server/db.js) после COMMIT транзакции. Если
// UPLOAD_DIR не задан (например, локально без части 2 в .env) — тихо ничего
// не делает, а не пытается удалить путь относительно текущей директории.
export async function deleteUserFiles(userId) {
  if (!UPLOAD_DIR) return;
  await fs.rm(userDir(userId), { recursive: true, force: true });
}
