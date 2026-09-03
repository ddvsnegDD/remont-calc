import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import Btn from '../components/Btn';
import { C } from '../lib/theme';
import { formatRub, formatDays } from '../lib/calculator';
import { SpecCalc } from '../lib/spec-calculator';
import { useAuth } from '../lib/auth';
import LoginModal from '../components/LoginModal';
import ProPaywall from '../components/ProPaywall';

export default function B2BResultPage() {
  const navigate = useNavigate();
  const { user, hasPro, loading: authLoading } = useAuth();
  const [calc, setCalc] = useState(null);
  const [specMode, setSpecMode] = useState('full');
  const [specTier, setSpecTier] = useState('capital');
  const [loginOpen, setLoginOpen] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('rpkm-b2b-current');
      if (raw) {
        const c = JSON.parse(raw);
        setCalc(c);
        const tierMap = { cosmetic: 'capital', capital: 'capital', euro: 'euro', euro_top: 'euro', premium: 'premium', luxury: 'premium' };
        setSpecTier(tierMap[c.result?.tier] || 'capital');
      }
    } catch {}
  }, []);

  const specInputs = useMemo(() => {
    if (!calc) return null;
    const a = calc.answers || {};
    return {
      area: parseFloat(a.area) || 60,
      rooms: parseInt(a.rooms) || 3,
      sanitary: parseInt(a.bathrooms) || 1,
      windows: parseInt(a.windows) > 0 ? parseInt(a.windows) : 4,
    };
  }, [calc]);

  const specResult = useMemo(() => {
    if (!specInputs) return null;
    return SpecCalc.compute({ ...specInputs, mode: specMode, tier: specTier });
  }, [specInputs, specMode, specTier]);

  if (!calc) {
    return (
      <PageLayout>
        <div className="quiz-page b2b">
          <div className="quiz-wrap">
            <div className="quiz-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <h2>Расчёт не найден</h2>
              <p style={{ color: C.gray500, margin: '12px 0 24px' }}>Возможно, был удалён или открыт по неверной ссылке.</p>
              <Btn variant="dark" onClick={() => navigate('/b2b-cabinet')}>Вернуться в кабинет</Btn>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  const r = calc.result;
  const modRows = Object.entries(r.modifiers || {});
  const breakdownItems = Object.values(r.breakdown || {});

  return (
    <PageLayout>
      <div className="quiz-page b2b">
        <div className="quiz-wrap">
          <div className="quiz-card">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 13, color: C.gray500, marginBottom: 4 }}>Проект</div>
                <h2 style={{ marginBottom: 0 }}>{calc.projectName}</h2>
                <div style={{ fontSize: 13, color: C.gray500, marginTop: 6 }}>Расчёт от {new Date(calc.timestamp).toLocaleString('ru-RU')}</div>
              </div>
              <Btn variant="outline" onClick={() => setNotice('PDF-экспорт доступен в реальной версии')}>📄 Скачать PDF</Btn>
            </div>

            <div style={{ fontSize: 11, color: C.gray500, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Метод 1 · вилка по квизу</div>

            {/* Hero */}
            <div className="result-hero">
              <div className="result-label">Ориентировочная стоимость</div>
              <div className="result-price">
                <span className="accent">{formatRub(r.totalLow)}</span> – <span className="accent">{formatRub(r.totalHigh)}</span>
              </div>
              <div className="result-disclaimer">
                Расчёт по средней стоимости 1 м² с учётом коэффициентов сложности.
                Точная цена формируется после проектной документации и спецификаций.
              </div>
            </div>

            {/* Breakdown */}
            <h3 style={{ marginBottom: 12 }}>Разбивка по статьям</h3>
            <div className="result-breakdown">
              {breakdownItems.map((b, i) => (
                <div key={i} className="breakdown-row">
                  <div><div className="breakdown-label">{b.label}</div></div>
                  <div><div className="breakdown-amount">{formatRub(b.low)} – {formatRub(b.high)}</div></div>
                </div>
              ))}
            </div>

            {/* Meta */}
            <div className="result-meta" style={{ marginTop: 24 }}>
              <div><div className="meta-item-label">Площадь</div><div className="meta-item-value">{r.area} м²</div></div>
              <div><div className="meta-item-label">Категория</div><div className="meta-item-value">{r.tierLabel}</div></div>
              <div><div className="meta-item-label">Цена за м²</div><div className="meta-item-value">{r.lowPerM2?.toLocaleString('ru-RU')} – {r.highPerM2?.toLocaleString('ru-RU')} ₽</div></div>
              <div><div className="meta-item-label">Сроки</div><div className="meta-item-value">{formatDays(r.days)}</div></div>
            </div>

            {/* Modifiers */}
            {modRows.length > 0 && (
              <>
                <h3 style={{ margin: '28px 0 12px' }}>Параметры расчёта</h3>
                <div className="result-meta">
                  {modRows.map(([k, v]) => (
                    <div key={k}><div className="meta-item-label">{k}</div><div className="meta-item-value">{v}</div></div>
                  ))}
                </div>
              </>
            )}

            <div className="alert alert-warn" style={{ marginTop: 24 }}>
              <strong>Расчёт носит предварительный характер:</strong> итоговая стоимость зависит от конкретных материалов, объёмов по факту и условий подрядчика.
            </div>

            {/* Spec block — PRO */}
            {specResult && !authLoading && !hasPro && (
              <ProPaywall
                inline
                target="pro"
                heading="Детальная спецификация"
                sub="Расчёт по тендерным расценкам с разбивкой на работы и материалы — доступен по подписке PRO."
                positions={specResult.lines.length}
                showLogin={!user}
                onLogin={() => setLoginOpen(true)}
              />
            )}
            {specResult && hasPro && (
              <div style={{ marginTop: 28, paddingTop: 24, borderTop: `2px solid ${C.gray200}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: C.gray500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Метод 2 · по тендерным расценкам</div>
                    <h3 style={{ margin: '4px 0' }}>Детальная спецификация · {specResult.lines.length} позиций</h3>
                    <div style={{ fontSize: 13, color: C.gray500 }}>
                      <strong>{specResult.totals.grand.toLocaleString('ru-RU')} ₽</strong> ({specResult.perM2.toLocaleString('ru-RU')} ₽/м²)
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, color: C.gray500, marginBottom: 4 }}>Тип отделки</div>
                    <div className="dash-range">
                      <button className={specMode === 'full' ? 'active' : ''} onClick={() => setSpecMode('full')}>Полная</button>
                      <button className={specMode === 'whitebox' ? 'active' : ''} onClick={() => setSpecMode('whitebox')}>WhiteBox</button>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: C.gray500, marginBottom: 4 }}>Категория</div>
                    <div className="dash-range">
                      <button className={specTier === 'capital' ? 'active' : ''} onClick={() => setSpecTier('capital')}>Капитальный</button>
                      <button className={specTier === 'euro' ? 'active' : ''} onClick={() => setSpecTier('euro')}>Евроремонт</button>
                      <button className={specTier === 'premium' ? 'active' : ''} onClick={() => setSpecTier('premium')}>Премиум</button>
                    </div>
                  </div>
                </div>

                <div className="spec-flat-table-wrap" style={{ overflowX: 'auto' }}>
                  <table className="spec-flat-table">
                    <thead>
                      <tr><th>Раздел / работа</th><th>Материал</th><th className="num">Объём</th><th className="num">Работы</th><th className="num">Материалы</th><th className="num">Итого</th></tr>
                    </thead>
                    <tbody>
                      {specResult.groups.map((g, gi) => (
                        <React.Fragment key={gi}>
                          <tr className="group-divider">
                            <td colSpan="6">{g.icon} {g.title} — {g.total.toLocaleString('ru-RU')} ₽</td>
                          </tr>
                          {g.lines.map((ln, li) => (
                            <tr key={li}>
                              <td>{ln.name}</td>
                              <td style={{ color: C.gray500 }}>{ln.material || '—'}</td>
                              <td className="num">{ln.volume.toLocaleString('ru-RU')} {ln.unit}</td>
                              <td className="num">{ln.workCost.toLocaleString('ru-RU')} ₽</td>
                              <td className="num">{ln.matCost.toLocaleString('ru-RU')} ₽</td>
                              <td className="num"><strong>{ln.total.toLocaleString('ru-RU')} ₽</strong></td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: C.gray100, fontWeight: 700 }}>
                        <td colSpan="3" style={{ padding: '12px 8px' }}>ИТОГО</td>
                        <td className="num">{specResult.totals.works.toLocaleString('ru-RU')} ₽</td>
                        <td className="num">{specResult.totals.materials.toLocaleString('ru-RU')} ₽</td>
                        <td className="num">{specResult.totals.grand.toLocaleString('ru-RU')} ₽</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div style={{ fontSize: 12, color: C.gray500, marginTop: 8 }}>
                  Расчёт носит предварительный характер: итоговая стоимость зависит от конкретных материалов, объёмов по факту и условий подрядчика.
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
      {notice && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: C.graphite, color: '#fff', padding: '12px 24px', borderRadius: 10, fontSize: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', maxWidth: 400, textAlign: 'center' }}>
          {notice}
        </div>
      )}
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </PageLayout>
  );
}
