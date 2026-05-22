import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import Btn from '../components/Btn';
import { C } from '../lib/theme';
import { formatRub } from '../lib/calculator';
import { useAuth } from '../lib/auth';

const ROLE_LABEL = {
  designer: 'Дизайнер интерьеров',
  architect: 'Архитектор',
  tech_customer: 'Технический заказчик',
  presale_engineer: 'Инженер пресейла',
  other: 'Другое',
};

export default function B2BCabinetPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, logout: authLogout } = useAuth();
  const [calcs, setCalcs] = useState([]);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  // Redirect if not logged in or not B2B
  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/b2b-login'); return; }
    // Allow both B2B and B2C users to access (B2C might want to switch)
  }, [user, authLoading, navigate]);

  // Load calcs from localStorage (will move to DB in Stage 2)
  useEffect(() => {
    try {
      const all = JSON.parse(localStorage.getItem('rpkm-b2b-calcs') || '[]');
      setCalcs(all);
    } catch {}
  }, []);

  const handleLogout = useCallback(async () => {
    await authLogout();
    navigate('/');
  }, [authLogout, navigate]);

  const handleDelete = useCallback((id) => {
    if (!confirm('Удалить этот расчёт?')) return;
    const updated = calcs.filter(c => c.id !== id);
    setCalcs(updated);
    localStorage.setItem('rpkm-b2b-calcs', JSON.stringify(updated));
    setNotice('Расчёт удалён');
  }, [calcs]);

  if (authLoading || !user) return null;

  const roleLabel = ROLE_LABEL[user.position] || ROLE_LABEL[user.role] || 'Профессионал';
  const orgLabel = user.organization ? ` · ${user.organization}` : '';

  return (
    <PageLayout>
      <main className="cabinet-page">
        <div className="cabinet-grid">
          <aside className="cabinet-side">
            <div className="cabinet-user">
              <div className="cabinet-user-name">{user.name || user.email}</div>
              <div className="cabinet-user-role">{roleLabel}{orgLabel}</div>
              <div style={{ fontSize: 12, color: C.gray400, marginTop: 4 }}>{user.email}</div>
            </div>
            <ul className="cabinet-menu">
              <li className="active">📊 Расчёты</li>
              <li onClick={() => navigate('/b2b-profile')}>⚙️ Настройки профиля</li>
            </ul>
            <div style={{ marginTop: 16 }}>
              <div className="pro-upsell">
                <div style={{ fontSize: 13, fontWeight: 600, color: C.graphite, marginBottom: 4 }}>Бесплатный план</div>
                <div style={{ fontSize: 12, color: C.gray500, marginBottom: 10 }}>3 расчёта/мес · базовый PDF</div>
                <Link to="/pro" className="btn-link" style={{ fontSize: 12 }}>
                  <Btn variant="outline" style={{ width: '100%', fontSize: 12, padding: '8px 12px' }}>Перейти на PRO →</Btn>
                </Link>
              </div>
            </div>
            <button onClick={handleLogout} style={{ marginTop: 16, background: 'none', border: 'none', color: C.gray500, cursor: 'pointer', fontSize: 13 }}>Выйти</button>
          </aside>

          <section className="cabinet-main">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2>Мои расчёты</h2>
                <div className="subtitle">История оценок для презентаций заказчикам</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn variant="outline" onClick={() => navigate('/b2b-quiz')}>+ Квартира</Btn>
                <Btn variant="outline" onClick={() => navigate('/b2b-office')} style={{ position: 'relative' }}>
                  + Офис <span style={{ fontSize: 10, background: C.terra, color: 'white', padding: '2px 6px', borderRadius: 999, marginLeft: 4, verticalAlign: 'middle' }}>PRO</span>
                </Btn>
              </div>
            </div>

            <div className="alert alert-info" style={{ marginBottom: 20 }}>
              <strong>NDA активен.</strong> Все расчёты хранятся конфиденциально и не передаются третьим лицам.
            </div>

            {calcs.length === 0 ? (
              <div className="history-empty" style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                <h3 style={{ marginBottom: 6 }}>Ещё нет расчётов</h3>
                <p style={{ color: C.gray500, marginBottom: 20 }}>Создайте первую оценку — займёт ~5 минут.</p>
                <Btn variant="outline" onClick={() => navigate('/b2b-quiz')}>Создать расчёт</Btn>
              </div>
            ) : (
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Проект</th>
                    <th>Площадь</th>
                    <th>Категория</th>
                    <th>Сумма</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {calcs.map(c => {
                    const isOffice = c.kind === 'office';
                    const area = isOffice ? c.result?.inputs?.area : c.result?.area;
                    const tierLabel = isOffice ? `🏢 Офис · ${c.result?.tierLabel}` : c.result?.tierLabel;
                    const sum = isOffice
                      ? formatRub(c.result?.totals?.grand)
                      : `${formatRub(c.result?.totalLow)} – ${formatRub(c.result?.totalHigh)}`;
                    const link = isOffice ? '/b2b-office-result' : '/b2b-result';
                    return (
                      <tr key={c.id}>
                        <td>{new Date(c.timestamp).toLocaleDateString('ru-RU')}</td>
                        <td>{c.projectName || '—'}</td>
                        <td>{area} м²</td>
                        <td>{tierLabel}</td>
                        <td><strong>{sum}</strong></td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <Btn variant="outline" style={{ padding: '6px 10px', fontSize: 13 }}
                                 onClick={() => { sessionStorage.setItem('rpkm-b2b-current', JSON.stringify(c)); navigate(link); }}>
                              Открыть →
                            </Btn>
                            <button onClick={() => handleDelete(c.id)}
                              title="Удалить расчёт"
                              style={{
                                padding: '6px 8px', borderRadius: 6, border: `1px solid ${C.gray200}`,
                                background: '#fff', color: C.gray400, cursor: 'pointer', fontSize: 14,
                                lineHeight: 1, transition: 'all 0.15s',
                              }}
                              onMouseEnter={e => { e.target.style.color = '#dc2626'; e.target.style.borderColor = '#fca5a5'; }}
                              onMouseLeave={e => { e.target.style.color = C.gray400; e.target.style.borderColor = C.gray200; }}>
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
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
