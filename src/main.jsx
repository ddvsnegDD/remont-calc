import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import App from './App';
import './styles/global.css';

// Разовая уборка старых персональных данных из браузера (часть 7
// TASK_server_storage.md): расчёты, чек-листы и фото переехали на сервер,
// сайт эти ключи больше не читает и не пишет. Идемпотентно — безопасно
// выполнять на каждом заходе.
(function clearLegacyStorage() {
  try {
    localStorage.removeItem('rpkm-b2b-calcs');
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('rpkm_checklist_') || key.startsWith('rpkm_consult_')) {
        localStorage.removeItem(key);
      }
    }
  } catch {}
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
