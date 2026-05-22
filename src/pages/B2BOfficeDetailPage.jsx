import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import Btn from '../components/Btn';
import { C } from '../lib/theme';
import { OFFICE_FINISH_DATA } from '../data/office-finish-data';
import { OFFICE_VIS_DATA } from '../data/office-vis-data';
import { OFFICE_FINISH_DATA_BUSINESS } from '../data/office-finish-data-business';
import { OFFICE_VIS_DATA_BUSINESS } from '../data/office-vis-data-business';
import { ChevronDown, ChevronRight, FileText, Pencil, X, Plus, Trash2 } from 'lucide-react';

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

const TIER_OPTIONS = [
  { id: 'standard', label: 'Стандарт', desc: '~79 000 ₽/м²' },
  { id: 'business', label: 'Бизнес', desc: '~162 000 ₽/м²' },
];

const TABS = [
  { id: 'finish', label: 'Отделка', icon: '🎨' },
  { id: 'vis', label: 'Инженерия (ВИС)', icon: '⚙️' },
];

export default function B2BOfficeDetailPage() {
  const navigate = useNavigate();
  const [tier, setTier] = useState('standard');
  const [activeTab, setActiveTab] = useState('finish');
  const [variant, setVariant] = useState('min'); // min or max (for finish)
  const [params, setParams] = useState({ S1: 500, S2: 0, S3: 0, S4: 0, S5: 0 });
  const [openSections, setOpenSections] = useState(new Set([0]));
  const [openGroups, setOpenGroups] = useState(new Set());
  const [editMode, setEditMode] = useState(false);
  const [overrides, setOverrides] = useState({});
  const [editingItem, setEditingItem] = useState(null);
  const [customItems, setCustomItems] = useState({});
  const [editDraft, setEditDraft] = useState({});

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

  const openEditModal = useCallback((key, item) => {
    setEditingItem(key);
    const ov = overrides[key];
    setEditDraft({
      name: ov?.name ?? item.n,
      material: ov?.material ?? (item.mat || item.c || ''),
      unit: ov?.unit ?? item.u,
      volume: ov?.volume ?? item.vol,
      priceWork: ov?.priceWork ?? item.pw,
      priceMat: ov?.priceMat ?? item.pm,
    });
  }, [overrides]);

  const openEditModalCustom = useCallback((key, item) => {
    setEditingItem(key);
    setEditDraft({
      name: item.name,
      material: item.material,
      unit: item.unit,
      volume: item.volume,
      priceWork: item.priceWork,
      priceMat: item.priceMat,
    });
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingItem) return;
    if (editingItem.startsWith('custom_')) {
      const gKey = editingItem.replace('custom_', '').replace(/_\d+$/, '');
      const idx = parseInt(editingItem.split('_').pop());
      setCustomItems(prev => {
        const arr = [...(prev[gKey] || [])];
        arr[idx] = { ...editDraft };
        return { ...prev, [gKey]: arr };
      });
    } else {
      setOverrides(prev => ({ ...prev, [editingItem]: { ...editDraft } }));
    }
    setEditingItem(null);
  }, [editingItem, editDraft]);

  const removeOverride = useCallback((key) => {
    setOverrides(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const addCustomItem = useCallback((gKey) => {
    setCustomItems(prev => {
      const arr = [...(prev[gKey] || [])];
      arr.push({ name: 'Новая позиция', material: '', unit: 'шт', volume: 0, priceWork: 0, priceMat: 0 });
      return { ...prev, [gKey]: arr };
    });
  }, []);

  const removeCustomItem = useCallback((gKey, idx) => {
    setCustomItems(prev => {
      const arr = [...(prev[gKey] || [])];
      arr.splice(idx, 1);
      return { ...prev, [gKey]: arr };
    });
  }, []);

  // Compute results
  const result = useMemo(() => {
    const finishData = tier === 'business' ? OFFICE_FINISH_DATA_BUSINESS : OFFICE_FINISH_DATA;
    const visData = tier === 'business' ? OFFICE_VIS_DATA_BUSINESS : OFFICE_VIS_DATA;
    const data = activeTab === 'finish' ? finishData : visData;

    const BIZ_REF_AREA = 50000;
    const BIZ_ALPHA = activeTab === 'finish' ? 0.08 : 0.12;

    let subtotalWork = 0, subtotalMat = 0, subtotalTotal = 0;
    const sections = data.map((section, si) => {
      const area = params[section.p] || 0;
      const areaMult = (tier === 'business' && area > 0) ? Math.pow(BIZ_REF_AREA / area, BIZ_ALPHA) : 1;
      let secWork = 0, secMat = 0;

      const groups = section.g.map((group, gi) => {
        let grpWork = 0, grpMat = 0;
        const items = group.items.map((it, ii) => {
          const key = `${activeTab}_${tier}_${si}_${gi}_${ii}`;
          const ov = overrides[key];
          let vol, pw, pm, itemName, itemMat, itemUnit;

          if (ov) {
            vol = parseFloat(ov.volume) || 0;
            pw = parseFloat(ov.priceWork) || 0;
            pm = parseFloat(ov.priceMat) || 0;
            itemName = ov.name;
            itemMat = ov.material;
            itemUnit = ov.unit;
          } else {
            vol = Math.round(area * it.k * 1.10 * areaMult * 100) / 100;
            if (activeTab === 'finish') {
              pw = Array.isArray(it.pw) ? it.pw[variant === 'min' ? 0 : 1] : it.pw;
              pm = Array.isArray(it.pm) ? it.pm[variant === 'min' ? 0 : 1] : it.pm;
            } else {
              pw = it.pw;
              pm = it.pm;
            }
            itemName = it.n;
            itemMat = activeTab === 'finish' ? (Array.isArray(it.mat) ? it.mat[variant === 'min' ? 0 : 1] : it.mat) : (it.c || '');
            itemUnit = it.u;
          }
          const costW = Math.round(vol * pw * 100) / 100;
          const costM = Math.round(vol * pm * 100) / 100;
          const costT = costW + costM;
          grpWork += costW;
          grpMat += costM;
          return { ...it, _key: key, _name: itemName, _mat: itemMat, _unit: itemUnit, vol, pw, pm, costW, costM, costT, _hasOverride: !!ov };
        });

        const gKey = `${activeTab}_${tier}_${si}_${gi}`;
        const customs = (customItems[gKey] || []).map((ci, idx) => {
          const vol = parseFloat(ci.volume) || 0;
          const pw = parseFloat(ci.priceWork) || 0;
          const pm = parseFloat(ci.priceMat) || 0;
          const costW = Math.round(vol * pw * 100) / 100;
          const costM = Math.round(vol * pm * 100) / 100;
          grpWork += costW;
          grpMat += costM;
          return { _key: `custom_${gKey}_${idx}`, _name: ci.name, _mat: ci.material, _unit: ci.unit, vol, pw, pm, costW, costM, costT: costW + costM, _isCustom: true };
        });

        secWork += grpWork;
        secMat += grpMat;
        return { title: group.title, _gKey: gKey, items: [...items, ...customs], totalW: grpWork, totalM: grpMat, total: grpWork + grpMat };
      });

      subtotalWork += secWork;
      subtotalMat += secMat;
      subtotalTotal += secWork + secMat;
      return { title: section.t, param: section.p, groups, totalW: secWork, totalM: secMat, total: secWork + secMat };
    });

    const mgmtCost = Math.round(subtotalTotal * 0.15);
    const designCost = Math.round(subtotalTotal * 0.05);
    const surcharges = [
      { id: 'management', label: 'Управление проектом', pct: 15, cost: mgmtCost },
      { id: 'design', label: 'Проектная документация и дизайн-проект', pct: 5, cost: designCost },
    ];
    const grandTotal = subtotalTotal + mgmtCost + designCost;

    return { sections, surcharges, subtotalTotal, grandWork: subtotalWork, grandMat: subtotalMat, grandTotal };
  }, [activeTab, variant, params, tier, overrides, customItems]);

  // Which params are relevant for current tab
  const relevantParams = useMemo(() => {
    const finishData = tier === 'business' ? OFFICE_FINISH_DATA_BUSINESS : OFFICE_FINISH_DATA;
    const visData = tier === 'business' ? OFFICE_VIS_DATA_BUSINESS : OFFICE_VIS_DATA;
    const data = activeTab === 'finish' ? finishData : visData;
    const used = new Set(data.map(s => s.p));
    return Object.keys(PARAM_LABELS).filter(k => used.has(k));
  }, [activeTab, tier]);

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

          {/* Tier selector */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {TIER_OPTIONS.map(t => (
              <button key={t.id} onClick={() => setTier(t.id)}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: 10,
                  border: `2px solid ${tier === t.id ? C.terra : C.gray200}`,
                  background: tier === t.id ? C.terraBg : '#fff',
                  color: tier === t.id ? C.terra : C.gray600,
                  fontWeight: 700, fontSize: 15, cursor: 'pointer', transition: 'all 0.15s',
                  textAlign: 'center',
                }}>
                <div>{t.label}</div>
                <div style={{ fontSize: 12, fontWeight: 500, marginTop: 2, opacity: 0.7 }}>{t.desc}</div>
              </button>
            ))}
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

          {/* Edit mode toggle */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button
              onClick={() => setEditMode(m => !m)}
              style={{
                padding: '10px 20px', borderRadius: 10,
                border: `2px solid ${editMode ? '#f59e0b' : C.terra}`,
                background: editMode ? '#fffbeb' : C.terraBg,
                color: editMode ? '#b45309' : C.terra,
                fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: editMode ? '0 0 0 3px rgba(245,158,11,0.15)' : 'none',
              }}>
              <Pencil size={16} /> {editMode ? '✓ Готово' : '✏️ Редактировать смету'}
            </button>
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
                                      {editMode && <th style={{ width: 32 }} />}
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
                                    {group.items.map((it, ii) => (
                                      <tr key={it._key} style={{
                                        borderBottom: `1px solid ${C.gray50}`,
                                        background: it._hasOverride ? '#fffbeb' : it._isCustom ? '#f0fdf4' : 'transparent',
                                      }}>
                                        {editMode && (
                                          <td style={{ padding: '4px 4px', textAlign: 'center', verticalAlign: 'top' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                                              <button onClick={() => it._isCustom
                                                ? openEditModalCustom(it._key, customItems[group._gKey]?.[parseInt(it._key.split('_').pop())])
                                                : openEditModal(it._key, it)
                                              } title="Редактировать" style={{
                                                background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                                                color: it._hasOverride ? '#b45309' : it._isCustom ? '#16a34a' : C.gray400,
                                                borderRadius: 4,
                                              }}>
                                                <Pencil size={14} />
                                              </button>
                                              {it._hasOverride && (
                                                <button onClick={() => removeOverride(it._key)} title="Сбросить" style={{
                                                  background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#ef4444', borderRadius: 4,
                                                }}>
                                                  <X size={12} />
                                                </button>
                                              )}
                                              {it._isCustom && (
                                                <button onClick={() => removeCustomItem(group._gKey, parseInt(it._key.split('_').pop()))} title="Удалить" style={{
                                                  background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#ef4444', borderRadius: 4,
                                                }}>
                                                  <Trash2 size={12} />
                                                </button>
                                              )}
                                            </div>
                                          </td>
                                        )}
                                        <td style={{ padding: '6px 8px', color: C.gray400 }}>{ii + 1}</td>
                                        <td style={{ padding: '6px 8px', color: C.graphite, maxWidth: 340 }}>
                                          <div>{it._name}{it._hasOverride && <span style={{ fontSize: 10, color: '#b45309', marginLeft: 4 }}>изменено</span>}{it._isCustom && <span style={{ fontSize: 10, color: '#16a34a', marginLeft: 4 }}>добавлено</span>}</div>
                                          {it._mat && <div style={{ fontSize: 11, color: C.gray400, marginTop: 2 }}>{it._mat}</div>}
                                        </td>
                                        <td style={{ padding: '6px 8px', color: C.gray500, whiteSpace: 'nowrap' }}>{it._unit}</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'right', color: C.gray600 }}>{it.vol > 0 ? it.vol.toLocaleString('ru-RU') : '—'}</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#2563eb' }}>{it.costW > 0 ? fmtN(it.costW) : '—'}</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#16a34a' }}>{it.costM > 0 ? fmtN(it.costM) : '—'}</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: C.graphite }}>{it.costT > 0 ? fmtN(it.costT) : '—'}</td>
                                      </tr>
                                    ))}
                                    {/* Add custom item button */}
                                    {editMode && (
                                      <tr>
                                        <td colSpan={8} style={{ padding: '6px 8px' }}>
                                          <button onClick={() => addCustomItem(group._gKey)} style={{
                                            background: 'none', border: `1px dashed ${C.gray300}`, borderRadius: 6,
                                            padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: C.gray500,
                                            display: 'flex', alignItems: 'center', gap: 4, width: '100%', justifyContent: 'center',
                                          }}>
                                            <Plus size={13} /> Добавить позицию
                                          </button>
                                        </td>
                                      </tr>
                                    )}
                                    {/* Group total row */}
                                    <tr style={{ borderTop: `2px solid ${C.gray200}`, fontWeight: 600 }}>
                                      <td colSpan={editMode ? 5 : 4} style={{ padding: '8px 8px', color: C.graphite }}>Итого по разделу</td>
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
                {tier === 'business' ? 'Бизнес' : 'Стандарт'} · {activeTab === 'finish' ? `Отделка (${variant === 'min' ? 'МИН' : 'МАКС'})` : 'Инженерия (ВИС)'} — ИТОГО с управлением и дизайном
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

      {/* Edit modal */}
      {editingItem && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }} onClick={() => setEditingItem(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 16, padding: '24px 28px', maxWidth: 480, width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 17 }}>Редактирование позиции</h3>
              <button onClick={() => setEditingItem(null)} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: C.gray400,
              }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: C.gray500, display: 'block', marginBottom: 4 }}>Наименование работы</label>
                <input type="text" value={editDraft.name || ''} onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.gray200}`, fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.gray500, display: 'block', marginBottom: 4 }}>Наименование материалов</label>
                <input type="text" value={editDraft.material || ''} onChange={e => setEditDraft(d => ({ ...d, material: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.gray200}`, fontSize: 14 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: C.gray500, display: 'block', marginBottom: 4 }}>Ед. изм.</label>
                  <input type="text" value={editDraft.unit || ''} onChange={e => setEditDraft(d => ({ ...d, unit: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.gray200}`, fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: C.gray500, display: 'block', marginBottom: 4 }}>Количество</label>
                  <input type="number" step="0.01" value={editDraft.volume ?? ''} onChange={e => setEditDraft(d => ({ ...d, volume: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.gray200}`, fontSize: 14 }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: C.gray500, display: 'block', marginBottom: 4 }}>Ед. расценка работ, ₽</label>
                  <input type="number" step="0.01" value={editDraft.priceWork ?? ''} onChange={e => setEditDraft(d => ({ ...d, priceWork: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.gray200}`, fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: C.gray500, display: 'block', marginBottom: 4 }}>Ед. расценка мат-лов, ₽</label>
                  <input type="number" step="0.01" value={editDraft.priceMat ?? ''} onChange={e => setEditDraft(d => ({ ...d, priceMat: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.gray200}`, fontSize: 14 }} />
                </div>
              </div>

              {/* Live preview of total */}
              {(() => {
                const vol = parseFloat(editDraft.volume) || 0;
                const pw = parseFloat(editDraft.priceWork) || 0;
                const pm = parseFloat(editDraft.priceMat) || 0;
                const totalW = Math.round(vol * pw);
                const totalM = Math.round(vol * pm);
                return (
                  <div style={{ background: C.gray50, borderRadius: 10, padding: '12px 14px', marginTop: 4 }}>
                    <div style={{ fontSize: 12, color: C.gray500, marginBottom: 6 }}>Итого по позиции</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                      <span>Работы: <strong style={{ color: '#2563eb' }}>{fmtN(totalW)} ₽</strong></span>
                      <span>Мат-лы: <strong style={{ color: '#16a34a' }}>{fmtN(totalM)} ₽</strong></span>
                      <span>Всего: <strong style={{ color: C.terra }}>{fmtN(totalW + totalM)} ₽</strong></span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <Btn variant="dark" style={{ flex: 1 }} onClick={saveEdit}>Сохранить</Btn>
              <Btn variant="outline" style={{ flex: 1 }} onClick={() => setEditingItem(null)}>Отмена</Btn>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
