import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import Btn from '../components/Btn';
import { C } from '../lib/theme';
import { useAuth } from '../lib/auth';

const ROLE_LABEL = {
  designer: 'Дизайнер интерьеров',
  architect: 'Архитектор',
  tech_customer: 'Технический заказчик',
  presale_engineer: 'Инженер пресейла',
  other: 'Другое',
};

export default function B2BProfilePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, logout: authLogout, subscription } = useAuth();
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/b2b-login'); return; }
  }, [user, authLoading, navigate]);

  const handleLogout = useCallback(async () => {
    await authLogout();
    navigate('/');
  }, [authLogout, navigate]);

  if (authLoading || !user) return null;

  const roleLabel = ROLE_LABEL[user.position] || ROLE_LABEL[user.role] || 'Профессионал';

  return (
    <PageLayout>
      <main className="cabinet-page">
        <div className="cabinet-grid">
          <aside className="cabinet-side">
            <div className="cabinet-user">
              <div className="cabinet-user-name">{user.name || user.email}</div>
              <div className="cabinet-user-role">{roleLabel}</div>
              <div style={{ fontSize: 12, color: C.gray400, marginTop: 4 }}>{user.email}</div>
            </div>
            <ul className="cabinet-menu">
              <li onClick={() => navigate('/b2b-cabinet')}>📊 Расчёты</li>
              <li className="active">⚙️ Настройки профиля</li>
            </ul>
            <div style={{ marginTop: 16 }}>
              <div className="pro-upsell">
                <div style={{ fontSize: 13, fontWeight: 600, color: C.graphite, marginBottom: 4 }}>
                  {subscription?.status === 'active' ? 'PRO план' : subscription?.status === 'trial' ? 'Пробный период' : 'Бесплатный план'}
                </div>
                <div style={{ fontSize: 12, color: C.gray500, marginBottom: 10 }}>
                  {subscription?.status === 'active' ? 'Полный доступ' : '3 расчёта/мес · базовый PDF'}
                </div>
                {(!subscription || subscription.status === 'free') && (
                  <Link to="/pro" className="btn-link" style={{ fontSize: 12 }}>
                    <Btn variant="outline" style={{ width: '100%', fontSize: 12, padding: '8px 12px' }}>Перейти на PRO →</Btn>
                  </Link>
                )}
              </div>
            </div>
            <button onClick={handleLogout} style={{ marginTop: 16, background: 'none', border: 'none', color: C.gray500, cursor: 'pointer', fontSize: 13 }}>Выйти</button>
          </aside>

          <section className="cabinet-main">
            <h2 style={{ marginBottom: 24 }}>Настройки профиля</h2>

            <div style={{ display: 'grid', gap: 20, maxWidth: 560 }}>
              <div style={{ background: '#fff', border: `1px solid ${C.gray200}`, borderRadius: 12, padding: 24 }}>
                <h3 style={{ fontSize: 16, marginBottom: 16, color: C.graphite }}>Личные данные</h3>
                <div style={{ display: 'grid', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 12, color: C.gray500, marginBottom: 4 }}>Имя</div>
                    <div style={{ fontSize: 15, color: C.graphite, fontWeight: 500 }}>{user.name || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: C.gray500, marginBottom: 4 }}>Email</div>
                    <div style={{ fontSize: 15, color: C.graphite, fontWeight: 500 }}>{user.email}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: C.gray500, marginBottom: 4 }}>Телефон</div>
                    <div style={{ fontSize: 15, color: C.graphite, fontWeight: 500 }}>{user.phone || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: C.gray500, marginBottom: 4 }}>Роль</div>
                    <div style={{ fontSize: 15, color: C.graphite, fontWeight: 500 }}>{roleLabel}</div>
                  </div>
                  {user.organization && (
                    <div>
                      <div style={{ fontSize: 12, color: C.gray500, marginBottom: 4 }}>Организация</div>
                      <div style={{ fontSize: 15, color: C.graphite, fontWeight: 500 }}>{user.organization}</div>
                    </div>
                  )}
                </div>
                <Btn variant="outline" style={{ marginTop: 20, fontSize: 13 }}
                  onClick={() => setNotice('Редактирование профиля будет доступно в следующей версии')}>
                  Редактировать
                </Btn>
              </div>

              <div style={{ background: '#fff', border: `1px solid ${C.gray200}`, borderRadius: 12, padding: 24 }}>
                <h3 style={{ fontSize: 16, marginBottom: 16, color: C.graphite }}>Подписка</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{
                    padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                    background: subscription?.status === 'active' ? '#dcfce7' : subscription?.status === 'trial' ? '#fef3c7' : C.gray100,
                    color: subscription?.status === 'active' ? '#166534' : subscription?.status === 'trial' ? '#92400e' : C.gray600,
                  }}>
                    {subscription?.status === 'active' ? 'PRO' : subscription?.status === 'trial' ? 'TRIAL' : 'FREE'}
                  </div>
                  <span style={{ fontSize: 14, color: C.gray600 }}>
                    {subscription?.status === 'active' ? 'Полный доступ ко всем функциям'
                      : subscription?.status === 'trial' ? 'Пробный доступ к PRO'
                      : '3 расчёта в месяц'}
                  </span>
                </div>
                {(!subscription || subscription.status === 'free') && (
                  <Btn variant="dark" style={{ fontSize: 13 }} onClick={() => navigate('/pro')}>Перейти на PRO →</Btn>
                )}
              </div>

              <div style={{ background: '#fff', border: `1px solid ${C.gray200}`, borderRadius: 12, padding: 24 }}>
                <h3 style={{ fontSize: 16, marginBottom: 16, color: C.graphite }}>Безопасность</h3>
                <div style={{ fontSize: 14, color: C.gray600, marginBottom: 12 }}>
                  Авторизация через одноразовый код на email. Пароль не требуется.
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <Btn variant="outline" style={{ fontSize: 13, color: '#dc2626', borderColor: '#fca5a5' }} onClick={handleLogout}>
                    Выйти из аккаунта
                  </Btn>
                </div>
              </div>
            </div>
          </section>
        </div>
        {notice && (
          <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: C.graphite, color: '#fff', padding: '12px 24px', borderRadius: 10, fontSize: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', maxWidth: 400, textAlign: 'center' }}>
            {notice}
          </div>
        )}
      </main>
    </PageLayout>
  );
}
