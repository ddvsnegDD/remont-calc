import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import { C } from '../lib/theme';
import { useAuth } from '../lib/auth';
import { CHECKLISTS } from '../data/checklists';
import { ChevronRight, ClipboardCheck, Trash2 } from 'lucide-react';
import Btn from '../components/Btn';

function getStorageKey(userId, checklistId) {
  return `rpkm_checklist_${userId}_${checklistId}`;
}

function getProgress(userId, checklistId) {
  if (!userId) return { checked: 0, total: 0, photos: 0 };
  const raw = localStorage.getItem(getStorageKey(userId, checklistId));
  if (!raw) return { checked: 0, total: 0, photos: 0 };
  try {
    const data = JSON.parse(raw);
    const total = Object.keys(data.items || {}).length;
    const checked = Object.values(data.items || {}).filter(v => v.checked).length;
    const photos = Object.values(data.items || {}).reduce((sum, v) => sum + (v.photos?.length || 0), 0);
    return { checked, total: getTotalItems(checklistId), photos };
  } catch { return { checked: 0, total: 0, photos: 0 }; }
}

function getTotalItems(checklistId) {
  const cl = CHECKLISTS.find(c => c.id === checklistId);
  if (!cl) return 0;
  return cl.groups.reduce((sum, g) => sum + g.items.length, 0);
}

export default function ChecklistsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [progresses, setProgresses] = useState({});

  useEffect(() => {
    if (!user) return;
    const p = {};
    CHECKLISTS.forEach(cl => {
      p[cl.id] = getProgress(user.id, cl.id);
    });
    setProgresses(p);
  }, [user]);

  const handleReset = (e, checklistId) => {
    e.stopPropagation();
    e.preventDefault();
    if (!window.confirm('Сбросить прогресс этого чек-листа? Все отметки и фото будут удалены.')) return;
    localStorage.removeItem(getStorageKey(user.id, checklistId));
    setProgresses(prev => ({ ...prev, [checklistId]: { checked: 0, total: getTotalItems(checklistId), photos: 0 } }));
  };

  if (!user) {
    return (
      <PageLayout>
        <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <div style={{ textAlign: 'center', maxWidth: 400 }}>
            <ClipboardCheck size={48} color={C.terra} style={{ marginBottom: 16 }} />
            <h2 style={{ fontSize: 22, fontWeight: 700, color: C.graphite, marginBottom: 8 }}>Чек-листы приёмки работ</h2>
            <p style={{ color: C.gray500, marginBottom: 24 }}>Авторизуйтесь, чтобы использовать интерактивные чек-листы</p>
            <Btn variant="terra" onClick={() => navigate('/login')}>Войти</Btn>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div style={{ minHeight: '80vh', padding: '32px 0 60px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 16px' }}>

          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <ClipboardCheck size={28} color={C.terra} />
              <h1 className="font-golos" style={{ fontSize: 24, fontWeight: 800, color: C.graphite, margin: 0 }}>Чек-листы приёмки</h1>
            </div>
            <p style={{ color: C.gray500, fontSize: 15, margin: 0 }}>
              6 этапов ремонта. Отмечайте пункты и прикладывайте фото прямо на объекте.
            </p>
          </div>

          {/* Checklists cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {CHECKLISTS.map(cl => {
              const prog = progresses[cl.id] || { checked: 0, total: getTotalItems(cl.id), photos: 0 };
              const total = getTotalItems(cl.id);
              const pct = total > 0 ? Math.round(prog.checked / total * 100) : 0;
              const started = prog.checked > 0;
              const done = prog.checked === total && total > 0;

              return (
                <Link key={cl.id} to={`/checklists/${cl.id}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{
                    background: '#fff', borderRadius: 14, padding: '16px 18px',
                    border: `1.5px solid ${done ? '#bbf7d0' : started ? cl.color + '30' : C.gray100}`,
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    cursor: 'pointer',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      {/* Icon */}
                      <div style={{
                        width: 48, height: 48, borderRadius: 12,
                        background: cl.color + '12', display: 'grid', placeItems: 'center',
                        fontSize: 24, flexShrink: 0,
                      }}>
                        {cl.icon}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 16, fontWeight: 600, color: C.graphite }}>{cl.title}</span>
                          {done && <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', padding: '2px 8px', borderRadius: 10 }}>Готово</span>}
                        </div>
                        <div style={{ fontSize: 13, color: C.gray500 }}>
                          {total} пунктов · {cl.groups.length} разделов
                          {prog.photos > 0 && <span> · {prog.photos} фото</span>}
                        </div>

                        {/* Progress bar */}
                        {started && (
                          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ flex: 1, height: 6, background: C.gray100, borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: done ? '#16a34a' : cl.color, borderRadius: 3, transition: 'width 0.3s' }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: done ? '#16a34a' : cl.color, flexShrink: 0 }}>{pct}%</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        {started && (
                          <button onClick={e => handleReset(e, cl.id)} title="Сбросить"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: C.gray300, borderRadius: 6 }}
                            onMouseEnter={e => e.currentTarget.style.color = '#dc2626'}
                            onMouseLeave={e => e.currentTarget.style.color = C.gray300}>
                            <Trash2 size={16} />
                          </button>
                        )}
                        <ChevronRight size={20} color={C.gray300} />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Info */}
          <div style={{ marginTop: 24, padding: '16px 18px', background: C.terraBg, borderRadius: 12, fontSize: 13, color: C.gray600, lineHeight: 1.6 }}>
            <strong>Совет:</strong> Используйте чек-листы прямо на объекте с телефона. Отмечайте пункты, фотографируйте результат — всё сохраняется автоматически.
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
