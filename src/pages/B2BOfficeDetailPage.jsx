import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import Btn from '../components/Btn';
import { C } from '../lib/theme';
import { OFFICE_FINISH_DATA } from '../data/office-finish-data';
import { OFFICE_VIS_DATA } from '../data/office-vis-data';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';

function fmt(n) { return Math.round(n).toLocaleString('ru-RU') + ' ₽'; }
function fmtN(n) { return Math.round(n).toLocaleString('ru-RU'); }

const PARAM_LABELS = {
  S1: 'Площадь надземной части (без КПП)',
  S2: 'Площадь подземной части (без КПП)',
  S3: 'Площадь надземной части КПП',
  S4: 'Площадь подземной части КПП',
  S5: 'Количество лестничных клеток',
};

const PARAM_UNITS = { S1: 'м²', S2: 'м²', S3: 'м²', S4: 'м²', S5: 'шт' };

const TABS = [
  { id: 'finish', label: 'Отделка', icon: '🎨' },
  { id: 'vis', label: 'Инженерия (ВИС)', icon: '⚙️' },
];

export default function B2BOfficeDetailPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('finish');
  const [variant, setVariant] = useState('min'); // min or max (for finish)
  const [params, setParams] = useState({ S1: 500, S2: 0, S3: 0, S4: 0, S5: 0 });
  const [openSections, setOpenSections] = useState(new Set([0]));
  const [openGroups, setOpenGroups] = useState(new Set());

  const setParam = useCallback((key, val) => {
    setParams(p => ({ ...p, [key]: Math.max(0, parseFloat(val) || 0) }));
  }, []);

  const toggleSection = useCallback((idx) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }, []);

  const toggleGroup = useCallback((key) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  // Compute results
  const result = useMemo(() => {
    const data = activeTab === 'finish' ? OFFICE_FINISH_DATA : OFFICE_VIS_DATA;

    let subtotalWork = 0, subtotalMat = 0, subtotalTotal = 0;
    const sections = data.map((section) => {
      const area = params[section.p] || 0;
      let secWork = 0, secMat = 0;

      const groups = section.g.map((group) => {
        let grpWork = 0, grpMat = 0;
        const items = group.items.map((it) => {
          const vol = Math.round(area * it.k * 1.10 * 100) / 100;
          let pw, pm;
          if (activeTab === 'finish') {
            pw = Array.isArray(it.pw) ? it.pw[variant === 'min' ? 0 : 1] : it.pw;
            pm = Array.isArray(it.pm) ? it.pm[variant === 'min' ? 0 : 1] : it.pm;
          } else {
            pw = it.pw;
            pm = it.pm;
          }
          const costW = Math.round(vol * pw * 100) / 100;
          const costM = Math.round(vol * pm * 100) / 100;
          const costT = costW + costM;
          grpWork += costW;
          grpMat += costM;
          return { ...it, vol, pw, pm, costW, costM, costT };
        });
        secWork += grpWork;
        secMat += grpMat;
        return { title: group.title, items, totalW: grpWork, totalM: grpMat, total: grpWork + grpMat };
      });

      subtotalWork += secWork;
      subtotalMat += secMat;
      subtotalTotal += secWork + secMat;
      return { title: section.t, param: section.p, groups, totalW: secWork, totalM: secMat, total: secWork + secMat };
    });

    // Surcharges: Управление проектом (15%) and Дизайн (5%)
    const mgmtCost = Math.round(subtotalTotal * 0.15);
    const designCost = Math.round(subtotalTotal * 0.05);
    const surcharges = [
      { id: 'management', label: 'Управление проектом', pct: 15, cost: mgmtCost },
      { id: 'design', label: 'Проектная документация и дизайн-проект', pct: 5, cost: designCost },
    ];
    const grandWork = subtotalWork;
    const grandMat = subtotalMat;
    const grandTotal = subtotalTotal + mgmtCost + designCost;

    return { sections, surcharges, subtotalTotal, grandWork, grandMat, grandTotal };
  }, [activeTab, variant, params]);

  // Which params are relevant for current tab
  const relevantParams = useMemo(() => {
    const data = activeTab === 'finish' ? OFFICE_FINISH_DATA : OFFICE_VIS_DATA;
    const used = new Set(data.map(s => s.p));
    return Object.keys(PARAM_LABELS).filter(k => used.has(k));
  }, [activeTab]);

  return (
    <PageLayout>
      <main className="quiz-page b2b">
        <div className="quiz-wrap" style={{ maxWidth: 1100 }}>
          <div className="quiz-meta">
            <span style={{ color: C.terra, fontWeight: 600 }}>{'🏢'} Детальный расчёт офиса</span>
            <Btn variant="outline" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => navigate('/b2b-office')}>
              ← Быстрый расчёт
            </Btn>
          </div>

          {/* Params card */}
          <div className="quiz-card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 12, fontSize: 16 }}>Параметры объекта</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {relevantParams.map(key => (
                <div key={key} className="form-field" style={{ margin: 0 }}>
                  <label style={{ fontSize: 12, color: C.gray500 }}>{PARAM_LABELS[key]}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="number" min="0" step={key === 'S5' ? 1 : 10}
                      value={params[key] || ''}
                      onChange={e => setParam(key, e.target.value)}
                      style={{ width: '100%' }} />
                    <span style={{ fontSize: 13, color: C.gray500, flexShrink: 0 }}>{PARAM_UNITS[key]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setOpenSections(new Set([0])); setOpenGroups(new Set()); }}
                style={{
                  padding: '10px 20px', borderRadius: 10, border: `1.5px solid ${activeTab === tab.id ? C.terra : C.gray200}`,
                  background: activeTab === tab.id ? C.terraBg : '#fff', color: activeTab === tab.id ? C.terra : C.gray600,
                  fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s',
                }}>
                {tab.icon} {tab.label}
              </button>
            ))}

            {activeTab === 'finish' && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                {[['min', 'МИН'], ['max', 'МАКС']].map(([v, label]) => (
                  <button key={v} onClick={() => setVariant(v)}
                    style={{
                      padding: '8px 16px', borderRadius: 8, border: `1.5px solid ${variant === v ? '#2563eb' : C.gray200}`,
                      background: variant === v ? '#eff6ff' : '#fff', color: variant === v ? '#2563eb' : C.gray500,
                      fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Totals bar */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16,
          }}>
            {[
              { label: 'Работы + Материалы', value: result.subtotalTotal, color: '#2563eb' },
              { label: 'Управление + Дизайн (20%)', value: result.surcharges.reduce((s, x) => s + x.cost, 0), color: '#7c3aed' },
              { label: 'ИТОГО', value: result.grandTotal, color: C.terra },
            ].map((t, i) => (
              <div key={i} style={{
                background: '#fff', borderRadius: 12, padding: '16px 18px',
                border: i === 2 ? `2px solid ${C.terra}` : `1px solid ${C.gray100}`,
              }}>
                <div style={{ fontSize: 12, color: C.gray500, marginBottom: 4 }}>{t.label}</div>
                <div style={{ fontSize: i === 2 ? 22 : 18, fontWeight: 700, color: t.color }}>{fmt(t.value)}</div>
                {params.S1 > 0 && (
                  <div style={{ fontSize: 11, color: C.gray400, marginTop: 2 }}>
                    {fmtN(Math.round(t.value / params.S1))} ₽/м² (S1)
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {result.sections.map((section, si) => {
              const isOpen = openSections.has(si);
              const hasArea = (params[section.param] || 0) > 0;

              return (
                <div key={si} style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.gray100}`, overflow: 'hidden' }}>
                  {/* Section header */}
                  <div onClick={() => toggleSection(si)} style={{
                    padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                    background: isOpen ? C.gray50 : '#fff', transition: 'background 0.15s',
                  }}>
                    {isOpen ? <ChevronDown size={18} color={C.gray500} /> : <ChevronRight size={18} color={C.gray500} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.graphite }}>{section.title.replace(/РАЗДЕЛ \w+ — /, '')}</div>
                      <div style={{ fontSize: 12, color: C.gray500 }}>
                        {section.param} = {params[section.param] || 0} {PARAM_UNITS[section.param]} · {section.groups.reduce((s, g) => s + g.items.length, 0)} позиций
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: hasArea ? C.terra : C.gray300 }}>{hasArea ? fmt(section.total) : '0 ₽'}</div>
                    </div>
                  </div>

                  {/* Section body */}
                  {isOpen && (
                    <div style={{ padding: '0 8px 12px' }}>
                      {section.groups.map((group, gi) => {
                        const gKey = `${si}_${gi}`;
                        const gOpen = openGroups.has(gKey);
                        return (
                          <div key={gi} style={{ marginTop: 4 }}>
                            {/* Group header */}
                            <div onClick={() => toggleGroup(gKey)} style={{
                              padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                              borderRadius: 8, background: gOpen ? '#f8fafc' : 'transparent',
                            }}>
                              {gOpen ? <ChevronDown size={14} color={C.gray400} /> : <ChevronRight size={14} color={C.gray400} />}
                              <span style={{ fontSize: 13, fontWeight: 600, color: C.graphite, flex: 1 }}>{group.title}</span>
                              <span style={{ fontSize: 13, color: C.gray500 }}>{group.items.length} поз.</span>
                              <span style={{ fontSize: 13, fontWeight: 600, color: C.graphite, minWidth: 100, textAlign: 'right' }}>
                                {hasArea ? fmt(group.total) : '—'}
                              </span>
                            </div>

                            {/* Items table */}
                            {gOpen && (
                              <div style={{ overflowX: 'auto', margin: '4px 0 8px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                  <thead>
                                    <tr style={{ borderBottom: `1px solid ${C.gray100}` }}>
                                      <th style={{ textAlign: 'left', padding: '6px 8px', color: C.gray500, fontWeight: 500 }}>#</th>
                                      <th style={{ textAlign: 'left', padding: '6px 8px', color: C.gray500, fontWeight: 500 }}>Наименование</th>
                                      <th style={{ textAlign: 'left', padding: '6px 8px', color: C.gray500, fontWeight: 500 }}>Ед.</th>
                                      <th style={{ textAlign: 'right', padding: '6px 8px', color: C.gray500, fontWeight: 500 }}>Объём</th>
                                      <th style={{ textAlign: 'right', padding: '6px 8px', color: C.gray500, fontWeight: 500 }}>Работы, ₽</th>
                                      <th style={{ textAlign: 'right', padding: '6px 8px', color: C.gray500, fontWeight: 500 }}>Мат-лы, ₽</th>
                                      <th style={{ textAlign: 'right', padding: '6px 8px', color: C.gray500, fontWeight: 500 }}>Итого, ₽</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {group.items.map((it, ii) => {
                                      const mat = activeTab === 'finish'
                                        ? (Array.isArray(it.mat) ? it.mat[variant === 'min' ? 0 : 1] : it.mat)
                                        : (it.c || '');
                                      return (
                                        <tr key={ii} style={{ borderBottom: `1px solid ${C.gray50}` }}>
                                          <td style={{ padding: '6px 8px', color: C.gray400 }}>{ii + 1}</td>
                                          <td style={{ padding: '6px 8px', color: C.graphite, maxWidth: 340 }}>
                                            <div>{it.n}</div>
                                            {mat && <div style={{ fontSize: 11, color: C.gray400, marginTop: 2 }}>{mat}</div>}
                                          </td>
                                          <td style={{ padding: '6px 8px', color: C.gray500, whiteSpace: 'nowrap' }}>{it.u}</td>
                                          <td style={{ padding: '6px 8px', textAlign: 'right', color: C.gray600 }}>{it.vol > 0 ? it.vol.toLocaleString('ru-RU') : '—'}</td>
                                          <td style={{ padding: '6px 8px', textAlign: 'right', color: '#2563eb' }}>{it.costW > 0 ? fmtN(it.costW) : '—'}</td>
                                          <td style={{ padding: '6px 8px', textAlign: 'right', color: '#16a34a' }}>{it.costM > 0 ? fmtN(it.costM) : '—'}</td>
                                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: C.graphite }}>{it.costT > 0 ? fmtN(it.costT) : '—'}</td>
                                        </tr>
                                      );
                                    })}
                                    {/* Group total row */}
                                    <tr style={{ borderTop: `2px solid ${C.gray200}`, fontWeight: 600 }}>
                                      <td colSpan={4} style={{ padding: '8px 8px', color: C.graphite }}>Итого по разделу</td>
                                      <td style={{ padding: '8px 8px', textAlign: 'right', color: '#2563eb' }}>{fmtN(group.totalW)}</td>
                                      <td style={{ padding: '8px 8px', textAlign: 'right', color: '#16a34a' }}>{fmtN(group.totalM)}</td>
                                      <td style={{ padding: '8px 8px', textAlign: 'right', color: C.graphite }}>{fmtN(group.total)}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Surcharges: Management + Design */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {/* Subtotal row */}
            <div style={{
              background: '#fff', borderRadius: 14, border: `1px solid ${C.gray200}`,
              padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.graphite }}>
                Подитог ({activeTab === 'finish' ? 'отделка' : 'инженерия'})
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.graphite }}>{fmt(result.subtotalTotal)}</div>
            </div>
            {result.surcharges.map(s => (
              <div key={s.id} style={{
                background: '#faf5ff', borderRadius: 14, border: '1px solid #e9d5ff',
                padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#6b21a8' }}>
                    {s.id === 'management' ? '📋' : '📐'} {s.label}
                  </div>
                  <div style={{ fontSize: 12, color: '#9333ea', marginTop: 2 }}>{s.pct}% от подитога</div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#6b21a8' }}>{fmt(s.cost)}</div>
              </div>
            ))}
          </div>

          {/* Grand total footer */}
          <div style={{
            marginTop: 20, padding: '20px 24px', background: C.graphite, borderRadius: 14,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
          }}>
            <div>
              <div style={{ color: '#fff9', fontSize: 13, marginBottom: 4 }}>
                {activeTab === 'finish' ? `Отделка (${variant === 'min' ? 'МИН' : 'МАКС'})` : 'Инженерия (ВИС)'} — ИТОГО с управлением и дизайном
              </div>
              <div style={{ color: '#fff', fontSize: 28, fontWeight: 800 }}>{fmt(result.grandTotal)}</div>
              <div style={{ color: '#fffa', fontSize: 13, marginTop: 4 }}>
                Работы + Материалы: {fmt(result.subtotalTotal)} · Управление (15%): {fmt(result.surcharges[0].cost)} · Дизайн (5%): {fmt(result.surcharges[1].cost)}
              </div>
            </div>
            <Btn variant="white" style={{ flexShrink: 0 }} onClick={() => navigate('/b2b-office')}>
              ← К быстрому расчёту
            </Btn>
          </div>

          <div style={{ marginTop: 16, padding: '14px 18px', background: C.terraBg, borderRadius: 12, fontSize: 13, color: C.gray600, lineHeight: 1.6 }}>
            <strong>Расчёт носит предварительный характер.</strong> Все объёмы определены через коэффициенты к площадям. Точные объёмы и стоимость определяются после обследования объекта инженером.
          </div>
        </div>
      </main>
    </PageLayout>
  );
}
