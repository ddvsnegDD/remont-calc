import { useState, useEffect, useCallback } from 'react';
import { PageLayout } from '../components/Layout';
import { C } from '../lib/theme';
import { Users, CreditCard, Clock, AlertCircle, RefreshCw, LogIn, Briefcase } from 'lucide-react';
import Btn from '../components/Btn';

const POSITION_LABELS = {
  designer: 'Дизайнер',
  architect: 'Архитектор',
  tech_customer: 'Тех. заказчик',
  presale_engineer: 'Инженер пресейла',
  other: 'Другое',
};

const STATUS_MAP = {
  trial: { label: 'Триал', color: '#2563EB', bg: '#EFF6FF' },
  active: { label: 'Активна', color: '#16a34a', bg: '#f0fdf4' },
  pending: { label: 'Ожидает оплаты', color: '#d97706', bg: '#fffbeb' },
  expired: { label: 'Истекла', color: '#6b7280', bg: '#f3f4f6' },
};

function Badge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.expired;
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: s.color, background: s.bg }}>
      {s.label}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', border: `1px solid ${C.gray100}`, flex: '1 1 200px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '15', display: 'grid', placeItems: 'center' }}>
          <Icon size={18} color={color} />
        </div>
        <span style={{ fontSize: 13, color: C.gray500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: C.graphite }}>{value}</div>
    </div>
  );
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isExpired(status, expiresAt) {
  if (!expiresAt) return true;
  if (status === 'pending') return false;
  return new Date(expiresAt) < new Date();
}

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(() => sessionStorage.getItem('rpkm_admin') || '');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const headers = { 'x-admin-token': token };

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [statsRes, usersRes] = await Promise.all([
        fetch('/api/admin/stats', { headers }),
        fetch('/api/admin/users', { headers }),
      ]);
      if (statsRes.status === 403 || usersRes.status === 403) {
        setToken('');
        sessionStorage.removeItem('rpkm_admin');
        setError('Неверный пароль');
        return;
      }
      const statsData = await statsRes.json();
      const usersData = await usersRes.json();
      if (statsData.ok) setStats(statsData.stats);
      if (usersData.ok) setUsers(usersData.users);
    } catch (err) {
      setError('Ошибка загрузки: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (!password.trim()) return;
    sessionStorage.setItem('rpkm_admin', password);
    setToken(password);
    setError('');
  };

  // Login screen
  if (!token) {
    return (
      <PageLayout>
        <div className="quiz-page">
          <div className="quiz-wrap" style={{ maxWidth: 400 }}>
            <div className="quiz-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
              <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: C.graphite }}>Админ-панель</h1>
              <p style={{ fontSize: 14, color: C.gray500, marginBottom: 24 }}>Введите пароль администратора</p>
              <form onSubmit={handleLogin}>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Пароль"
                  autoFocus
                  style={{ width: '100%', padding: '14px 16px', border: `1.5px solid ${C.gray200}`, borderRadius: 10, fontSize: 16, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
                />
                {error && <div style={{ color: '#dc3545', fontSize: 13, marginBottom: 12 }}>{error}</div>}
                <Btn variant="terra" size="lg" style={{ width: '100%' }}>
                  <LogIn size={16} style={{ marginRight: 8 }} /> Войти
                </Btn>
              </form>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="quiz-page">
        <div className="quiz-wrap" style={{ maxWidth: 1000 }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <h1 className="font-golos" style={{ fontSize: 26, fontWeight: 800, color: C.graphite }}>📊 Админ-панель</h1>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={fetchData} disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: `1px solid ${C.gray200}`, background: '#fff', cursor: 'pointer', fontSize: 13, color: C.gray600 }}>
                <RefreshCw size={14} className={loading ? 'spin' : ''} /> Обновить
              </button>
              <button onClick={() => { setToken(''); sessionStorage.removeItem('rpkm_admin'); }}
                style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${C.gray200}`, background: '#fff', cursor: 'pointer', fontSize: 13, color: C.gray600 }}>
                Выйти
              </button>
            </div>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626', fontSize: 14 }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* Stats */}
          {stats && (
            <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
              <StatCard icon={Users} label="Всего пользователей" value={stats.total_users} color="#6366f1" />
              <StatCard icon={Briefcase} label="B2B профи" value={stats.b2b_users} color="#8b5cf6" />
              <StatCard icon={Clock} label="Активных триалов" value={stats.active_trials} color="#2563eb" />
              <StatCard icon={CreditCard} label="Платных подписок" value={stats.active_paid} color="#16a34a" />
              <StatCard icon={AlertCircle} label="Ожидают оплаты" value={stats.pending_payments} color="#d97706" />
            </div>
          )}

          {/* B2C Users table */}
          {(() => {
            const b2cUsers = users.filter(u => u.role !== 'b2b');
            const b2bUsers = users.filter(u => u.role === 'b2b');
            const tdStyle = { padding: '12px 16px' };
            const thStyle = { padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: C.gray500, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' };
            return (<>
          <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.gray100}`, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.gray100}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#2563eb', background: '#eff6ff' }}>B2C</span>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: C.graphite }}>Физические лица ({b2cUsers.length})</h2>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    {['ID', 'Email', 'Имя', 'Телефон', 'Подписка', 'Истекает', 'Регистрация'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b2cUsers.map(u => {
                    const effectiveStatus = isExpired(u.sub_status, u.sub_expires) ? 'expired' : u.sub_status;
                    return (
                      <tr key={u.id} style={{ borderTop: `1px solid ${C.gray100}` }}>
                        <td style={{ ...tdStyle, color: C.gray400 }}>{u.id}</td>
                        <td style={{ ...tdStyle, fontWeight: 500, color: C.graphite }}>{u.email}</td>
                        <td style={{ ...tdStyle, color: u.name ? C.graphite : C.gray300 }}>{u.name || '—'}</td>
                        <td style={{ ...tdStyle, color: u.phone ? C.graphite : C.gray300 }}>{u.phone || '—'}</td>
                        <td style={tdStyle}>
                          {u.sub_status ? <Badge status={effectiveStatus} /> : <span style={{ color: C.gray300 }}>—</span>}
                        </td>
                        <td style={{ ...tdStyle, color: C.gray500, whiteSpace: 'nowrap', fontSize: 13 }}>
                          {u.sub_expires ? formatDate(u.sub_expires) : '—'}
                        </td>
                        <td style={{ ...tdStyle, color: C.gray500, whiteSpace: 'nowrap', fontSize: 13 }}>
                          {formatDate(u.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                  {b2cUsers.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: C.gray400 }}>Нет пользователей B2C</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* B2B Users table */}
          <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.gray100}`, overflow: 'hidden', marginTop: 28 }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.gray100}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#8b5cf6', background: '#f5f3ff' }}>B2B</span>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: C.graphite }}>Профессионалы ({b2bUsers.length})</h2>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    {['ID', 'Email', 'Имя', 'Организация', 'Специализация', 'Регистрация'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b2bUsers.map(u => (
                    <tr key={u.id} style={{ borderTop: `1px solid ${C.gray100}` }}>
                      <td style={{ ...tdStyle, color: C.gray400 }}>{u.id}</td>
                      <td style={{ ...tdStyle, fontWeight: 500, color: C.graphite }}>{u.email}</td>
                      <td style={{ ...tdStyle, color: u.name ? C.graphite : C.gray300 }}>{u.name || '—'}</td>
                      <td style={{ ...tdStyle, color: u.organization ? C.graphite : C.gray300 }}>{u.organization || '—'}</td>
                      <td style={{ ...tdStyle, color: u.position ? C.graphite : C.gray300 }}>{POSITION_LABELS[u.position] || u.position || '—'}</td>
                      <td style={{ ...tdStyle, color: C.gray500, whiteSpace: 'nowrap', fontSize: 13 }}>
                        {formatDate(u.created_at)}
                      </td>
                    </tr>
                  ))}
                  {b2bUsers.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: C.gray400 }}>Нет пользователей B2B</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </>);
          })()}

        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </PageLayout>
  );
}
