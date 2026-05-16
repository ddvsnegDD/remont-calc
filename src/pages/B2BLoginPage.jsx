import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import Btn from '../components/Btn';
import { C } from '../lib/theme';

export default function B2BLoginPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regOrg, setRegOrg] = useState('');
  const [regRole, setRegRole] = useState('');
  const [regPortfolio, setRegPortfolio] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regNda, setRegNda] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogin = useCallback((e) => {
    e.preventDefault();
    setError('');
    // Demo: any email/password works
    if (!loginEmail || !loginPassword) { setError('Заполните все поля'); return; }
    try { sessionStorage.setItem('rpkm-b2b-user', JSON.stringify({ email: loginEmail, name: loginEmail.split('@')[0] })); } catch {}
    navigate('/b2b-cabinet');
  }, [loginEmail, loginPassword, navigate]);

  const handleRegister = useCallback((e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!regName || !regEmail || !regOrg || !regRole || !regPassword) { setError('Заполните все обязательные поля'); return; }
    if (!regNda) { setError('Необходимо согласие с NDA'); return; }
    setSuccess('✓ Заявка принята. Подтверждение через 1.5 сек, затем вход…');
    setTimeout(() => {
      try { sessionStorage.setItem('rpkm-b2b-user', JSON.stringify({ email: regEmail, name: regName, organization: regOrg, role: regRole })); } catch {}
      navigate('/b2b-cabinet');
    }, 2000);
  }, [regName, regEmail, regOrg, regRole, regPassword, regNda, navigate]);

  return (
    <PageLayout>
      <main className="login-page">
        <div className="login-card">
          <h2>{tab === 'login' ? 'Вход для профессионалов' : 'Регистрация профессионала'}</h2>
          <p className="lead">{tab === 'login' ? 'Дизайнеры, технические заказчики, инженеры пресейла' : 'Доступ выдаётся после модерации (в демо — автоматически)'}</p>

          <div className="tab-switch">
            <button className={tab === 'login' ? 'active' : ''} onClick={() => { setTab('login'); setError(''); setSuccess(''); }}>Вход</button>
            <button className={tab === 'register' ? 'active' : ''} onClick={() => { setTab('register'); setError(''); setSuccess(''); }}>Регистрация</button>
          </div>

          {tab === 'login' ? (
            <form onSubmit={handleLogin}>
              <div className="form-field"><label>Email</label><input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="vy@example.com" required /></div>
              <div className="form-field"><label>Пароль</label><input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required /></div>
              <Btn variant="dark" style={{ width: '100%' }} type="submit">Войти</Btn>
              {error && <div className="form-error">{error}</div>}
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <div className="form-field"><label>ФИО</label><input type="text" value={regName} onChange={e => setRegName(e.target.value)} placeholder="Иван Петров" required /></div>
              <div className="form-field"><label>Email</label><input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="vy@example.com" required /></div>
              <div className="form-field"><label>Организация</label><input type="text" value={regOrg} onChange={e => setRegOrg(e.target.value)} placeholder="Студия / бюро" required /></div>
              <div className="form-field">
                <label>Специализация</label>
                <select value={regRole} onChange={e => setRegRole(e.target.value)} required>
                  <option value="">— выберите —</option>
                  <option value="designer">Дизайнер интерьеров</option>
                  <option value="architect">Архитектор</option>
                  <option value="tech_customer">Технический заказчик</option>
                  <option value="presale_engineer">Инженер пресейла</option>
                  <option value="other">Другое</option>
                </select>
              </div>
              <div className="form-field"><label>Портфолио (опц.)</label><input type="text" value={regPortfolio} onChange={e => setRegPortfolio(e.target.value)} placeholder="ссылка на сайт, Behance" /></div>
              <div className="form-field"><label>Пароль</label><input type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} minLength="6" required /></div>
              <label className="checkbox-row">
                <input type="checkbox" checked={regNda} onChange={e => setRegNda(e.target.checked)} />
                <span>Согласен с NDA: данные расчётов хранятся конфиденциально.</span>
              </label>
              <Btn variant="dark" style={{ width: '100%', marginTop: 8 }} type="submit">Зарегистрироваться</Btn>
              {error && <div className="form-error">{error}</div>}
              {success && <div className="form-success">{success}</div>}
            </form>
          )}

          <div className="alert alert-info" style={{ marginTop: 20 }}>
            <strong>Это демо-проект.</strong> В реальной версии регистрация подтверждается модерацией. Здесь — автоматически.
          </div>
        </div>
      </main>
    </PageLayout>
  );
}
