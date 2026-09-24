import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import LoginModal from '../components/LoginModal';
import Btn from '../components/Btn';
import { C } from '../lib/theme';
import { useAuth } from '../lib/auth';
import { SpecCalc } from '../lib/spec-calculator';
import { validateNumber, validatePositiveNumber, validateInteger } from '../lib/calculator';
import { PLANS, formatPrice } from '../data/tariffs';
import { toSpecTier } from '../data/specTier';
import { tierTitle } from '../data/tierNames';

// Источник свежих данных для сида формы: детальный ручной расчёт (все семь полей)
// или быстрая вилка квиза (только tier/area/mode/replan). Timestamp отсутствует
// или не разбирается — лид считается самым старым, а не бросает исключение.
function parseTimestamp(raw) {
  const t = raw ? Date.parse(raw) : NaN;
  return Number.isNaN(t) ? -Infinity : t;
}

function readDetailLead() {
  try {
    const raw = sessionStorage.getItem('rpkm-last-b2c-detail');
    if (!raw) return null;
    const lead = JSON.parse(raw);
    const result = lead && lead.result;
    const inputs = result && result.inputs;
    if (!inputs) return null;
    return {
      timestamp: parseTimestamp(lead.timestamp),
      tier: inputs.tier, mode: result.mode, replan: inputs.replan,
      area: inputs.area, sanitary: inputs.sanitary, windows: inputs.windows, rooms: inputs.rooms,
    };
  } catch { return null; }
}

function readQuickLead() {
  try {
    const raw = sessionStorage.getItem('rpkm-last-b2c');
    if (!raw) return null;
    const lead = JSON.parse(raw);
    const result = lead && lead.result;
    if (!result) return null;
    return {
      timestamp: parseTimestamp(lead.timestamp),
      // result.tier уже один из четырёх, но гоняем через toSpecTier: он же покрывает
      // euro_top и luxury, если они когда-нибудь станут достижимы через квиз.
      tier: toSpecTier(result.tier),
      mode: lead.answers?.finish_type === 'whitebox' ? 'whitebox' : 'full',
      replan: lead.answers?.replan,
      area: result.area,
      // rooms/sanitary/windows намеренно не выводятся из площади — часть 9 ТЗ,
      // это та же молчаливая подстановка, которую убирал calc_input_hardening.
    };
  } catch { return null; }
}

export default function B2CDetailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const source = searchParams.get('source');
  const { user, hasAccess, loading: authLoading } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  // Form state
  const [tier, setTier] = useState('capital');
  const [mode, setMode] = useState('full');
  const [replan, setReplan] = useState('no');
  const [area, setArea] = useState(60);
  const [rooms, setRooms] = useState(2);
  const [sanitary, setSanitary] = useState(1);
  const [windows, setWindows] = useState(3);

  // Сырой текст числовых полей отдельно от закоммиченных значений — проверка на
  // потере фокуса, а не на каждое нажатие (см. B2CQuizPage).
  const [areaRaw, setAreaRaw] = useState('60');
  const [roomsRaw, setRoomsRaw] = useState('2');
  const [sanitaryRaw, setSanitaryRaw] = useState('1');
  const [windowsRaw, setWindowsRaw] = useState('3');
  const [fieldErrors, setFieldErrors] = useState({});

  const commitField = useCallback((key, raw, setValue, validator, opts) => {
    const r = validator(raw, opts);
    if (r.ok) {
      setValue(r.value);
      setFieldErrors(prev => { const next = { ...prev }; delete next[key]; return next; });
    } else {
      setFieldErrors(prev => ({ ...prev, [key]: r.error }));
    }
  }, []);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [agree, setAgree] = useState(false);

  // Auto-fill from user profile
  useEffect(() => {
    if (user) {
      if (user.name) setName(prev => prev || user.name);
      if (user.phone) setPhone(prev => prev || user.phone);
      if (user.email) setEmail(prev => prev || user.email);
    }
  }, [user]);

  // Засеять форму из последнего расчёта (квиз или сама эта страница), один раз
  // при монтировании — дальше пользователь хозяин формы, повторно не перезаписываем.
  // Источников два — берём тот, чей timestamp новее (часть 9 ТЗ). Каждое значение
  // идёт через тот же валидатор и те же границы, что в commitField: в sessionStorage
  // может лежать расчёт со значением вне текущих границ.
  useEffect(() => {
    const detailLead = readDetailLead();
    const quickLead = readQuickLead();
    const seed = detailLead && quickLead
      ? (quickLead.timestamp > detailLead.timestamp ? quickLead : detailLead)
      : (detailLead || quickLead);
    if (!seed) return;

    if (['cosmetic', 'capital', 'euro', 'euro_top', 'premium'].includes(seed.tier)) setTier(seed.tier);
    if (['full', 'whitebox'].includes(seed.mode)) setMode(seed.mode);
    if (['no', 'light', 'full'].includes(seed.replan)) setReplan(seed.replan);

    const areaCheck = validateNumber(seed.area, { min: 20, max: 500, name: 'Площадь' });
    if (areaCheck.ok) { setArea(areaCheck.value); setAreaRaw(String(areaCheck.value)); }

    const sanitaryCheck = validateInteger(seed.sanitary, { min: 1, max: 6, name: 'Санузлы' });
    if (sanitaryCheck.ok) { setSanitary(sanitaryCheck.value); setSanitaryRaw(String(sanitaryCheck.value)); }

    const windowsCheck = validateInteger(seed.windows, { min: 0, max: 20, name: 'Окна' });
    if (windowsCheck.ok) { setWindows(windowsCheck.value); setWindowsRaw(String(windowsCheck.value)); }

    const roomsCheck = validateInteger(seed.rooms, { min: 1, max: 10, name: 'Комнаты' });
    if (roomsCheck.ok) { setRooms(roomsCheck.value); setRoomsRaw(String(roomsCheck.value)); }
  }, []);

  // Уровни, у которых набор позиций задан жёстко — режим застройщика на них не влияет.
  const MODE_LOCKED_TIERS = ['premium', 'cosmetic'];
  // Уровни, на которых перепланировка невозможна по составу работ.
  const REPLAN_LOCKED_TIERS = ['cosmetic'];
  // Уровни, у которых объёмы не зависят от числа комнат и окон.
  const ROOMS_WINDOWS_IRRELEVANT_TIERS = ['cosmetic'];

  const effectiveMode = MODE_LOCKED_TIERS.includes(tier) ? 'full' : mode;
  const effectiveReplan = (effectiveMode === 'whitebox' || REPLAN_LOCKED_TIERS.includes(tier)) ? 'no' : replan;
  const showRoomsField = !ROOMS_WINDOWS_IRRELEVANT_TIERS.includes(tier);
  const showWindowsField = effectiveMode !== 'whitebox' && !ROOMS_WINDOWS_IRRELEVANT_TIERS.includes(tier);
  const paramCount = 2 + (showRoomsField ? 1 : 0) + (showWindowsField ? 1 : 0);

  const preview = useMemo(() => {
    if (Object.keys(fieldErrors).length > 0) return null;
    const r = SpecCalc.compute({ area, sanitary, windows, rooms, mode: effectiveMode, tier, replan: effectiveReplan });
    return r.ok ? r : null;
  }, [area, sanitary, windows, rooms, effectiveMode, tier, effectiveReplan, fieldErrors]);

  const approvalCost = useMemo(() => 80000 + 500 * area + 15000 * Math.max(0, rooms - 1), [area, rooms]);

  const submit = useCallback(() => {
    if (Object.keys(fieldErrors).length > 0) { alert('Проверьте значения полей — есть некорректные'); return; }
    if (!name || name.length < 2) { alert('Введите имя'); return; }
    if (!phone || phone.replace(/\D/g, '').length < 10) { alert('Введите корректный телефон'); return; }
    if (!agree) { alert('Нужно согласие на обработку данных'); return; }

    const inp = { mode: effectiveMode, tier, replan: effectiveReplan, area, sanitary, windows, rooms };
    const result = SpecCalc.compute(inp);
    if (!result.ok) { alert(result.error); return; }
    const lead = {
      id: 'b2c-detail-' + Date.now(),
      timestamp: new Date().toISOString(),
      kind: 'b2c-detail',
      inputs: inp, result,
      contact: { name, phone, email },
    };
    try { sessionStorage.setItem('rpkm-last-b2c-detail', JSON.stringify(lead)); } catch {}
    navigate('/b2c-result-detail');
  }, [name, phone, email, agree, effectiveMode, tier, effectiveReplan, area, sanitary, windows, rooms, navigate, fieldErrors]);

  const tierCards = [
    { key: 'cosmetic', sub: 'Обновление без вскрытия: шпатлёвка в один слой, покраска, замена пола и оконечки. Двери, окна, плитка на стенах и инженерия не трогаются.' },
    { key: 'capital', sub: 'Стены под штукатурку, без утепления. Подготовка поверхностей, финишные материалы и оконечка эконом-сегмента.' },
    { key: 'euro', sub: 'Базовый набор по тендерным расценкам РПКМ: полный цикл, стены обшиваются ГКЛ с утеплением, подвесные потолки.' },
    { key: 'euro_top', sub: 'Тот же состав работ, что в евроремонте — разница в классе материалов и аккуратности монтажа, а не в наборе позиций.' },
    { key: 'premium', sub: 'Полная смета: итальянские материалы, умный дом, мебель, техника.' },
  ];
  const modeCards = [
    { key: 'full', label: 'Без отделки / вторичка', sub: 'Голые стены или старая отделка под снос. Полный цикл работ.' },
    { key: 'whitebox', label: 'White Box', sub: 'Застройщик уже сделал стяжку, штукатурку, разводку. Экономия ~44%.' },
  ];
  const replanCards = [
    { key: 'no', emoji: '🚫', label: 'Не требуется' },
    { key: 'light', emoji: '✏️', label: 'Лёгкая (без затрагивания несущих) · +80 000 ₽ за работы' },
    { key: 'full', emoji: '🏗️', label: `Полная · +5% сметы + ${approvalCost.toLocaleString('ru-RU')} ₽ за согласование` },
  ];

  if (authLoading) {
    return (
      <PageLayout>
        <div className="quiz-page">
          <div className="quiz-wrap" style={{ maxWidth: 760, textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: 14, color: C.gray400 }}>Загрузка...</div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!hasAccess) {
    return (
      <PageLayout>
        <div className="quiz-page">
          <div className="quiz-wrap" style={{ maxWidth: 760 }}>
            <div className="quiz-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>📋</div>
              <h2>Детальная смета по 50 позициям</h2>
              <p style={{ color: C.gray600, margin: '12px 0 8px', fontSize: 15, lineHeight: 1.6 }}>
                Расчёт по реальным тендерным ценам с разбивкой на работы и материалы.
                Доступен участникам <strong>Клуба владельцев</strong> и <strong>Профи</strong>.
              </p>
              <div style={{ display: 'inline-block', background: C.terraBg, color: C.terra, fontWeight: 600, fontSize: 14, padding: '6px 16px', borderRadius: 8, margin: '8px 0 24px' }}>
                Подписка — {formatPrice(PLANS.club_monthly.price)} ₽/мес · 14 дней бесплатно
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Btn variant="terra" size="lg" onClick={() => navigate('/club')}>Попробовать 14 дней бесплатно</Btn>
                <Btn variant="outline" size="lg" onClick={() => navigate('/b2b-login')}>Войти как Профи</Btn>
              </div>
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px dashed ${C.gray200}` }}>
                <p style={{ color: C.gray500, fontSize: 14, marginBottom: 12 }}>Хотите узнать примерный бюджет прямо сейчас?</p>
                <Btn variant="outline" onClick={() => {
                  let hasQuick = false;
                  try {
                    const raw = sessionStorage.getItem('rpkm-last-b2c');
                    hasQuick = !!(raw && JSON.parse(raw)?.result);
                  } catch { hasQuick = false; }
                  navigate(hasQuick ? '/b2c-result' : `/b2c?mode=quick&tier=${tier}`);
                }}>Быстрый расчёт — бесплатно</Btn>
              </div>
            </div>
          </div>
        </div>
        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="quiz-page">
        <div className="quiz-wrap" style={{ maxWidth: 760 }}>
          {source === 'has-project' && (
            <div className="alert alert-info" style={{ marginBottom: 16, padding: '18px 22px' }}>
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>📐 У вас уже есть готовый дизайн-проект</div>
              <div style={{ fontSize: 14, color: C.gray600 }}>Заполните {paramCount} параметра ниже — расчёт по реальным тендерным ценам.</div>
            </div>
          )}

          <div className="quiz-meta">
            <span style={{ color: C.terra, fontWeight: 600 }}>📋 Детальная смета по тендерным ценам</span>
            <span>~1 минута</span>
          </div>

          <div className="quiz-card">
            <h2>Введите {paramCount} параметра — получите смету{preview ? ` по ${preview.lines.length} позициям` : ''}</h2>
            <div className="quiz-hint">Расчёт по реальным расценкам, согласованным с подрядными организациями в результате тендеров.</div>

            {/* Tier */}
            <div className="form-field">
              <label>Категория ремонта</label>
              <div className="options-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                {tierCards.map(t => (
                  <button key={t.key} type="button" className={`option-card${tier === t.key ? ' selected' : ''}`} onClick={() => setTier(t.key)}>
                    <div className="option-card-title">{tierTitle(t.key)}</div>
                    <div className="option-card-sub">{t.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Mode — скрыт для Премиум и Косметического — у них набор позиций не зависит от отделки застройщика */}
            {!MODE_LOCKED_TIERS.includes(tier) && (
              <div className="form-field">
                <label>Тип отделки от застройщика</label>
                <div className="options-grid">
                  {modeCards.map(m => (
                    <button key={m.key} type="button" className={`option-card${mode === m.key ? ' selected' : ''}`} onClick={() => setMode(m.key)}>
                      <div className="option-card-title">{m.label}</div>
                      <div className="option-card-sub">{m.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Numeric inputs */}
            <div className="field-row" style={{ marginTop: 20 }}>
              <div className="form-field">
                <label>Площадь, м²</label>
                <input type="number" value={areaRaw}
                  onChange={e => setAreaRaw(e.target.value)}
                  onBlur={() => commitField('area', areaRaw, setArea, validateNumber, { min: 20, max: 500, name: 'Площадь' })}
                  style={{ borderColor: fieldErrors.area ? '#dc2626' : undefined }} />
                {fieldErrors.area && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>{fieldErrors.area}</div>}
              </div>
              {showRoomsField && (
                <div className="form-field">
                  <label>Комнат</label>
                  <input type="number" value={roomsRaw}
                    onChange={e => setRoomsRaw(e.target.value)}
                    onBlur={() => commitField('rooms', roomsRaw, setRooms, validateInteger, { min: 1, max: 10, name: 'Комнаты' })}
                    style={{ borderColor: fieldErrors.rooms ? '#dc2626' : undefined }} />
                  {fieldErrors.rooms && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>{fieldErrors.rooms}</div>}
                </div>
              )}
            </div>
            <div className="field-row">
              <div className="form-field">
                <label>Санузлов</label>
                <input type="number" value={sanitaryRaw}
                  onChange={e => setSanitaryRaw(e.target.value)}
                  onBlur={() => commitField('sanitary', sanitaryRaw, setSanitary, validateInteger, { min: 1, max: 6, name: 'Санузлы' })}
                  style={{ borderColor: fieldErrors.sanitary ? '#dc2626' : undefined }} />
                {fieldErrors.sanitary && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>{fieldErrors.sanitary}</div>}
              </div>
              {showWindowsField && (
                <div className="form-field">
                  <label>Замена окон</label>
                  <input type="number" value={windowsRaw}
                    onChange={e => setWindowsRaw(e.target.value)}
                    onBlur={() => commitField('windows', windowsRaw, setWindows, validateInteger, { min: 0, max: 20, name: 'Окна' })}
                    style={{ borderColor: fieldErrors.windows ? '#dc2626' : undefined }} />
                  {fieldErrors.windows && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>{fieldErrors.windows}</div>}
                </div>
              )}
            </div>

            {/* Replan */}
            {effectiveMode !== 'whitebox' && !REPLAN_LOCKED_TIERS.includes(tier) && (
              <div className="form-field" style={{ marginTop: 8 }}>
                <label>Перепланировка</label>
                <div className="options">
                  {replanCards.map(rp => (
                    <button key={rp.key} type="button" className={`option${replan === rp.key ? ' selected' : ''}`} onClick={() => setReplan(rp.key)}>
                      <span className="option-emoji">{rp.emoji}</span>
                      <span>{rp.label}</span>
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: C.gray500, marginTop: 8, paddingLeft: 4 }}>
                  Согласование в МЖИ: 80 000 ₽ база + 500 ₽/м² + 15 000 ₽ за каждую доп. комнату.
                </div>
              </div>
            )}

            {/* Live preview */}
            {preview ? (
              <div className="live-preview">
                <div className="live-preview-label">Предварительная стоимость по введённым параметрам</div>
                <div className="live-preview-value">{preview.totals.grand.toLocaleString('ru-RU')} ₽</div>
                <div className="live-preview-sub">{preview.perM2.toLocaleString('ru-RU')} ₽/м²</div>
              </div>
            ) : Object.keys(fieldErrors).length > 0 ? (
              <div className="alert alert-warn">Исправьте значения полей выше, чтобы увидеть предварительную стоимость.</div>
            ) : null}

            {/* Contact */}
            <h3 style={{ marginTop: 28, marginBottom: 12 }}>Куда отправить расчёт</h3>
            <div className="form-field"><label>Имя</label><input type="text" className="text-input" value={name} onChange={e => setName(e.target.value)} placeholder="Имя" /></div>
            <div className="form-field"><label>Телефон</label><input type="tel" className="text-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 (___) ___-__-__" /></div>
            <div className="form-field"><label>Email (опционально)</label><input type="email" className="text-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></div>
            <label className="checkbox-row">
              <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
              <span>Даю согласие на обработку персональных данных в соответствии с <a href="/privacy" target="_blank" style={{ color: C.terra }}>Политикой конфиденциальности</a> (152-ФЗ).</span>
            </label>

            <div className="alert alert-warn" style={{ marginTop: 16 }}>
              <strong>Расчёт носит предварительный характер:</strong> итоговая стоимость зависит от конкретных материалов, объёмов по факту и условий подрядчика.
            </div>

            <Btn variant="terra" size="lg" style={{ width: '100%', marginTop: 16 }} onClick={submit}>Получить детальную смету</Btn>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
