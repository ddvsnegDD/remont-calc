import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import Btn from '../components/Btn';
import { C } from '../lib/theme';
import { OFFICE_TIERS } from '../lib/office-calculator';
import { useAuth } from '../lib/auth';
import LoginModal from '../components/LoginModal';
import ProPaywall from '../components/ProPaywall';

function fmt(n) { return Math.round(n).toLocaleString('ru-RU') + ' ₽'; }

export default function B2BOfficeResultPage() {
  const navigate = useNavigate();
  const { user, hasPro, loading: authLoading } = useAuth();
  const [calc, setCalc] = useState(null);
  const [openGroups, setOpenGroups] = useState(new Set([0, 1]));
  const [loginOpen, setLoginOpen] = useState(false);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('rpkm-b2b-office-current');
      if (raw) setCalc(JSON.parse(raw));
    } catch {}
  }, []);

  const toggleGroup = (i) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  if (authLoading) {
    return (
      <PageLayout>
        <div className="quiz-page b2b">
          <div className="quiz-wrap" style={{ maxWidth: 920, textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: 14, color: C.gray400 }}>Загрузка...</div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!hasPro) {
    return (
      <>
        <ProPaywall
          heading="Детальная смета офиса"
          sub="Офисный fit-out с разбивкой по 25+ статьям расходов — PRO-функция для профессионалов."
          showLogin={!user}
          onLogin={() => setLoginOpen(true)}
        />
        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      </>
    );
  }

  if (!calc) {
    return (
      <PageLayout>
        <div className="quiz-page b2b">
          <div className="quiz-wrap" style={{ maxWidth: 920 }}>
            <div className="quiz-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <h2>Расчёт не найден</h2>
              <p style={{ color: C.gray500, margin: '12px 0 24px' }}>Возможно, был удалён или открыт по неверной ссылке.</p>
              <Btn variant="dark" onClick={() => navigate('/b2b-office')}>Создать новый расчёт</Btn>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  const r = calc.result;
  const inp = r.inputs;
  const tierDef = OFFICE_TIERS[r.tier] || {};

  return (
    <PageLayout>
      <div className="quiz-page b2b">
        <div className="quiz-wrap" style={{ maxWidth: 920 }}>
          <div className="quiz-card">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 13, color: C.gray500, marginBottom: 4 }}>Офисный fit-out</div>
                <h2 style={{ marginBottom: 6 }}>{calc.projectName}</h2>
                <div style={{ fontSize: 13, color: C.gray500 }}>Расчёт от {new Date(calc.timestamp).toLocaleString('ru-RU')}</div>
              </div>
              <Btn variant="outline" onClick={() => navigate('/b2b-office')}>Пересчитать</Btn>
            </div>

            {/* Hero */}
            <div className="result-hero">
              <div className="result-label">Итоговая стоимость</div>
              <div className="result-price"><span className="accent">{fmt(r.totals.grand)}</span></div>
              <div style={{ fontSize: 16, color: C.gray600, marginTop: 6 }}>
                {r.totals.perM2Grand.toLocaleString('ru-RU')} ₽/м² · категория <strong>{r.tierLabel}</strong> · площадь {inp.area} м²
              </div>
              <div className="result-disclaimer" style={{ fontWeight: 500 }}>
                <strong>Расчёт носит предварительный характер:</strong> итоговая стоимость зависит
                от конкретных материалов, объёмов по факту и условий подрядчика.
              </div>
            </div>

            {/* Meta */}
            <div className="result-meta" style={{ background: '#f0f4fa' }}>
              <div><div className="meta-item-label">Площадь</div><div className="meta-item-value">{inp.area} м²</div></div>
              <div><div className="meta-item-label">Рабочих мест</div><div className="meta-item-value">{inp.workplaces}</div></div>
              <div><div className="meta-item-label">Переговорных</div><div className="meta-item-value">{inp.meetingRooms}</div></div>
              <div><div className="meta-item-label">Мебель</div><div className="meta-item-value">{inp.furniture !== false ? 'Включена' : 'Нет'}</div></div>
              <div><div className="meta-item-label">Серверная</div><div className="meta-item-value">{inp.serverRoom ? 'Есть' : 'Нет'}</div></div>
              <div><div className="meta-item-label">Сроки</div><div className="meta-item-value">{inp.urgency === 'fast' ? 'Срочно' : 'Стандарт'}</div></div>
              <div><div className="meta-item-label">Дизайн-проект</div><div className="meta-item-value">{inp.designProject === 'have' ? 'Есть' : 'Нужен'}</div></div>
            </div>

            {/* Sections */}
            <h3 style={{ marginTop: 28, marginBottom: 12 }}>Распределение бюджета по статьям</h3>
            <div style={{ fontSize: 13, color: C.gray500, marginBottom: 16 }}>Цены откалиброваны на июнь 2026 г.</div>

            <div className="spec-groups">
              {r.sections.map((sec, i) => {
                if (sec.skipped) {
                  return (
                    <div key={i} className="spec-group">
                      <div className="spec-group-head" style={{ cursor: 'default' }}>
                        <div className="spec-group-icon">{sec.icon}</div>
                        <div className="spec-group-title">
                          <div className="spec-group-name" style={{ color: C.gray500, textDecoration: 'line-through' }}>{sec.title}</div>
                          <div className="spec-group-meta">{sec.skipReason}</div>
                        </div>
                        <div className="spec-group-amount" style={{ color: C.gray500 }}>не входит</div>
                      </div>
                    </div>
                  );
                }
                const isOpen = openGroups.has(i);
                const pct = r.totals.main > 0 ? Math.round(sec.total / r.totals.main * 100) : 0;
                return (
                  <div key={i} className={`spec-group${isOpen ? ' open' : ''}`}>
                    <div className="spec-group-head" onClick={() => toggleGroup(i)}>
                      <div className="spec-group-icon">{sec.icon}</div>
                      <div className="spec-group-title">
                        <div className="spec-group-name">{sec.title}</div>
                        <div className="spec-group-meta">{sec.lines.length} позиций · {pct}% от основного бюджета</div>
                      </div>
                      <div className="spec-group-amount">{fmt(sec.total)}</div>
                      <div className="spec-group-chevron">▾</div>
                    </div>
                    <div className="spec-group-body">
                      <table className="spec-table">
                        <thead><tr><th>Статья</th><th className="num">₽/м²</th><th className="num">Сумма</th></tr></thead>
                        <tbody>
                          {sec.lines.map((ln, j) => (
                            <tr key={j} style={ln.excluded ? { color: C.gray500, textDecoration: 'line-through' } : {}}>
                              <td>
                                {ln.title}
                                {ln.excluded && <span style={{ fontSize: 11 }}> (исключено)</span>}
                                {ln.optional && !ln.excluded && <span style={{ fontSize: 11, color: C.gray500 }}> (опц.)</span>}
                              </td>
                              <td className="num">{ln.excluded ? '—' : ln.perM2.toLocaleString('ru-RU')}</td>
                              <td className="num"><strong>{ln.excluded ? '—' : fmt(ln.total)}</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modifiers */}
            {r.modifiers && r.modifiers.length > 0 && (
              <>
                <h3 style={{ marginTop: 24, marginBottom: 12 }}>Модификаторы расчёта</h3>
                <div className="result-breakdown">
                  {r.modifiers.map((m, i) => (
                    <div key={i} className="breakdown-row">
                      <div>
                        <div className="breakdown-label">{m.label}</div>
                        <div className="breakdown-sub">{m.hint}</div>
                      </div>
                      <div className="breakdown-amount">+{fmt(m.cost)}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Totals */}
            <h3 style={{ marginTop: 28, marginBottom: 12 }}>Итог</h3>
            <div className="result-breakdown">
              <div className="breakdown-row" style={{ background: C.gray50 }}>
                <div>
                  <div className="breakdown-label">Основной бюджет</div>
                  <div className="breakdown-sub">Сумма по разделам + модификаторы</div>
                </div>
                <div className="breakdown-amount"><strong>{fmt(r.totals.main)}</strong></div>
              </div>
              <div className="breakdown-row" style={{ background: '#e8eef7', border: `2px solid ${C.terra}` }}>
                <div>
                  <div className="breakdown-label" style={{ fontSize: 18 }}>ИТОГО</div>
                  <div className="breakdown-sub">{r.totals.perM2Grand.toLocaleString('ru-RU')} ₽/м²</div>
                </div>
                <div className="breakdown-amount" style={{ fontSize: 22 }}><strong>{fmt(r.totals.grand)}</strong></div>
              </div>
            </div>

            <div className="alert alert-info" style={{ marginTop: 24 }}>
              <strong>Что входит в категорию «{r.tierLabel}»</strong>
              <p style={{ margin: '8px 0 0', fontSize: 14 }}>{tierDef.description}</p>
            </div>

          </div>
        </div>
      </div>
    </PageLayout>
  );
}
