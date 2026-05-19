import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import Btn from '../components/Btn';
import { C } from '../lib/theme';
import { OfficeCalc, OFFICE_TIERS, OFFICE_BUDGET_RAW, OFFICE_INFLATION_2026 } from '../lib/office-calculator';

export default function B2BOfficePage() {
  const navigate = useNavigate();
  const [tier, setTier] = useState('business');
  const [area, setArea] = useState(500);
  const [workplaces, setWorkplaces] = useState(40);
  const [meetingRooms, setMeetingRooms] = useState(6);
  const [serverRoom, setServerRoom] = useState(false);
  const [designProject, setDesignProject] = useState('need');
  const [urgency, setUrgency] = useState('standard');
  const [projectName, setProjectName] = useState('');
  const [optionalStates, setOptionalStates] = useState({});

  // Build optional systems list from current tier
  const optionalSystems = useMemo(() => {
    const raw = OFFICE_BUDGET_RAW[tier];
    if (!raw) return [];
    const systems = [];
    for (const sec of raw) {
      if (!sec.subItems) continue;
      for (const it of sec.subItems) {
        if (it.optional) {
          systems.push({
            id: it.id,
            title: it.title,
            defaultIncluded: it.default !== false,
            perM2: Math.round(it.value * OFFICE_INFLATION_2026),
          });
        }
      }
    }
    return systems;
  }, [tier]);

  // Reset optional states when tier changes
  useEffect(() => {
    const init = {};
    optionalSystems.forEach(s => { init[s.id] = s.defaultIncluded; });
    setOptionalStates(init);
  }, [optionalSystems]);

  const inputs = useMemo(() => {
    const raw = OFFICE_BUDGET_RAW[tier];
    const optionalIds = new Set();
    const defaultIncluded = new Set();
    if (raw) {
      for (const sec of raw) {
        if (!sec.subItems) continue;
        for (const it of sec.subItems) {
          if (it.optional) {
            optionalIds.add(it.id);
            if (it.default !== false) defaultIncluded.add(it.id);
          }
        }
      }
    }
    const excludeOptional = [];
    const includeOptional = [];
    for (const id of optionalIds) {
      if (defaultIncluded.has(id) && !optionalStates[id]) excludeOptional.push(id);
      if (!defaultIncluded.has(id) && optionalStates[id]) includeOptional.push(id);
    }
    return { tier, area, meetingRooms, workplaces, serverRoom, urgency, designProject, excludeOptional, includeOptional };
  }, [tier, area, meetingRooms, workplaces, serverRoom, urgency, designProject, optionalStates]);

  const preview = useMemo(() => {
    if (!area || area < 50) return null;
    return OfficeCalc.compute(inputs);
  }, [inputs]);

  const submit = useCallback(() => {
    if (!area || area < 50) { alert('Введите площадь от 50 м²'); return; }
    const result = OfficeCalc.compute(inputs);
    const calc = {
      id: 'office-' + Date.now(),
      timestamp: new Date().toISOString(),
      kind: 'office',
      projectName: projectName || 'Офис без названия',
      inputs,
      result,
    };
    try {
      const all = JSON.parse(localStorage.getItem('rpkm-b2b-calcs') || '[]');
      all.push(calc);
      localStorage.setItem('rpkm-b2b-calcs', JSON.stringify(all));
    } catch {}
    sessionStorage.setItem('rpkm-b2b-office-current', JSON.stringify(calc));
    navigate('/b2b-office-result');
  }, [inputs, projectName, area, navigate]);

  const tierCards = Object.entries(OFFICE_TIERS).map(([key, t]) => ({
    key,
    label: t.label,
    price: `~${t.pricePerM2.toLocaleString('ru-RU')} ₽/м²`,
    desc: t.description,
  }));

  return (
    <PageLayout>
      <main className="quiz-page b2b">
        <div className="quiz-wrap" style={{ maxWidth: 820 }}>
          <div className="quiz-meta">
            <span style={{ color: C.terra, fontWeight: 600 }}>🏢 Расчёт офисного fit-out</span>
            <span>~2 минуты</span>
          </div>
          <div className="quiz-card">
            <h2>Расчёт стоимости офисного fit-out</h2>
            <div className="quiz-hint">Детальная смета с разбивкой по 25+ статьям расходов. Цены откалиброваны на июнь 2026 г.</div>

            {/* Tier */}
            <div className="form-field">
              <label>Категория отделки</label>
              <div className="options-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                {tierCards.map(t => (
                  <button key={t.key} type="button" className={`option-card${tier === t.key ? ' selected' : ''}`}
                    onClick={() => setTier(t.key)}>
                    <div className="option-card-title">{t.label}</div>
                    <div className="option-card-sub" style={{ fontWeight: 600 }}>{t.price}</div>
                    <div style={{ fontSize: 12, color: C.gray500, marginTop: 6, lineHeight: 1.4 }}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Params */}
            <div className="field-row" style={{ marginTop: 16 }}>
              <div className="form-field"><label>Полезная площадь, м²</label>
                <input type="number" min="50" max="5000" value={area} onChange={e => setArea(+e.target.value)} /></div>
              <div className="form-field"><label>Рабочих мест, шт</label>
                <input type="number" min="0" max="500" value={workplaces} onChange={e => setWorkplaces(+e.target.value)} /></div>
            </div>
            <div className="field-row">
              <div className="form-field">
                <label>Переговорных, шт</label>
                <input type="number" min="0" max="50" value={meetingRooms} onChange={e => setMeetingRooms(+e.target.value)} />
                {preview && (
                  <div style={{ fontSize: 12, color: C.gray500, marginTop: 4 }}>
                    Норма для {area} м²: ~{preview.meta.baselineMR} переговорных.
                    {preview.meta.extraMR > 0 ? ` Доплата за ${preview.meta.extraMR} лишних.` : ' Доплат нет.'}
                  </div>
                )}
              </div>
              <div className="form-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', paddingTop: 24 }}>
                  <input type="checkbox" checked={serverRoom} onChange={e => setServerRoom(e.target.checked)} style={{ width: 18, height: 18 }} />
                  <span>Серверная (+200 000 ₽)</span>
                </label>
                <div style={{ fontSize: 12, color: C.gray500, marginTop: 4 }}>Стойки, климат, спец-розетки</div>
              </div>
            </div>

            {/* Design */}
            <div className="form-field" style={{ marginTop: 12 }}>
              <label>Дизайн-проект</label>
              <div className="options">
                <button type="button" className={`option${designProject === 'need' ? ' selected' : ''}`} onClick={() => setDesignProject('need')}>
                  <span className="option-emoji">📐</span><span>Нужно сделать</span>
                </button>
                <button type="button" className={`option${designProject === 'have' ? ' selected' : ''}`} onClick={() => setDesignProject('have')}>
                  <span className="option-emoji">✓</span><span>Готовый проект на руках</span>
                </button>
              </div>
            </div>

            {/* Urgency */}
            <div className="form-field">
              <label>Сроки</label>
              <div className="options">
                <button type="button" className={`option${urgency === 'standard' ? ' selected' : ''}`} onClick={() => setUrgency('standard')}>
                  <span className="option-emoji">📅</span><span>Стандартные сроки</span>
                </button>
                <button type="button" className={`option${urgency === 'fast' ? ' selected' : ''}`} onClick={() => setUrgency('fast')}>
                  <span className="option-emoji">⚡</span><span>Срочно (+7% к итогу)</span>
                </button>
              </div>
            </div>

            {/* Optional systems */}
            <div className="form-field" style={{ marginTop: 12 }}>
              <label>Дополнительные системы</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {optionalSystems.map(s => (
                  <label key={s.id} className="checkbox-row" style={{ background: C.gray50, padding: '10px 12px', borderRadius: 6, margin: 0, cursor: 'pointer', alignItems: 'center' }}>
                    <input type="checkbox" checked={!!optionalStates[s.id]}
                      onChange={e => setOptionalStates(prev => ({ ...prev, [s.id]: e.target.checked }))}
                      style={{ width: 16, height: 16 }} />
                    <div>
                      <div style={{ fontSize: 14, color: C.graphite }}>{s.title}</div>
                      <div style={{ fontSize: 12, color: C.gray500 }}>{s.perM2.toLocaleString('ru-RU')} ₽/м²{!s.defaultIncluded ? ' · по умолчанию выкл' : ''}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Live preview */}
            {preview && (
              <div className="live-preview" style={{ borderLeftColor: C.terra, background: '#f0f4fa' }}>
                <div className="live-preview-label">Предварительная стоимость</div>
                <div className="live-preview-value">{preview.totals.grand.toLocaleString('ru-RU')} ₽</div>
                <div className="live-preview-sub">
                  <span>{preview.totals.perM2Grand.toLocaleString('ru-RU')} ₽/м²</span>
                  <span style={{ color: C.gray500, marginLeft: 12 }}>
                    · базовый {preview.totals.main.toLocaleString('ru-RU')} ₽ + резерв {preview.totals.reserve.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              </div>
            )}

            <h3 style={{ marginTop: 28, marginBottom: 12 }}>Название проекта</h3>
            <div className="form-field">
              <input type="text" className="text-input" value={projectName} onChange={e => setProjectName(e.target.value)}
                placeholder="Например: Офис ABC Group, Москва-Сити" />
            </div>

            <div className="alert alert-warn" style={{ marginTop: 16 }}>
              <strong>Расчёт носит предварительный характер.</strong> Точная стоимость определяется после выезда инженера.
            </div>

            <Btn variant="dark" size="lg" style={{ width: '100%', marginTop: 16 }} onClick={submit}>Сформировать детальную смету</Btn>

            <div style={{ marginTop: 20, padding: '16px 18px', background: '#f0f4fa', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: 28, flexShrink: 0 }}>📊</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.graphite, marginBottom: 4 }}>Сводная смета по площадям</div>
                <div style={{ fontSize: 13, color: C.gray500, lineHeight: 1.5 }}>
                  Детальный расчёт с 2000+ позициями: отделка (МИН/МАКС) и инженерия (ВИС). Все объёмы пересчитываются от параметров объекта.
                </div>
              </div>
              <Btn variant="outline" style={{ flexShrink: 0 }} onClick={() => navigate('/b2b-office-detail')}>Открыть</Btn>
            </div>
          </div>
        </div>
      </main>
    </PageLayout>
  );
}
