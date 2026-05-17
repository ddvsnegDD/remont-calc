import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import LoginModal from '../components/LoginModal';
import Btn from '../components/Btn';
import { C } from '../lib/theme';
import { useAuth } from '../lib/auth';
import { SpecCalc } from '../lib/spec-calculator';
import { createLead, formatDetailComment } from '../lib/bitrix';

export default function B2CDetailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const source = searchParams.get('source');
  const { hasAccess, loading: authLoading } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  // Form state
  const [tier, setTier] = useState('capital');
  const [mode, setMode] = useState('full');
  const [replan, setReplan] = useState('no');
  const [area, setArea] = useState(60);
  const [rooms, setRooms] = useState(2);
  const [sanitary, setSanitary] = useState(1);
  const [windows, setWindows] = useState(3);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [agree, setAgree] = useState(false);

  const effectiveMode = tier === 'premium' ? 'full' : mode;
  const effectiveReplan = effectiveMode === 'whitebox' ? 'no' : replan;
  const paramCount = effectiveMode === 'whitebox' ? 3 : 4;

  const preview = useMemo(() => {
    if (area < 1) return null;
    return SpecCalc.compute({ area, sanitary, windows, rooms, mode: effectiveMode, tier, replan: effectiveReplan });
  }, [area, sanitary, windows, rooms, effectiveMode, tier, effectiveReplan]);

  const approvalCost = useMemo(() => 80000 + 500 * area + 15000 * Math.max(0, rooms - 1), [area, rooms]);

  const submit = useCallback(() => {
    if (!name || name.length < 2) { alert('Введите имя'); return; }
    if (!phone || phone.replace(/\D/g, '').length < 10) { alert('Введите корректный телефон'); return; }
    if (!agree) { alert('Нужно согласие на обработку данных'); return; }

    const inp = { mode: effectiveMode, tier, replan: effectiveReplan, area, sanitary, windows, rooms };
    const result = SpecCalc.compute(inp);
    const lead = {
      id: 'b2c-detail-' + Date.now(),
      timestamp: new Date().toISOString(),
      kind: 'b2c-detail',
      inputs: inp, result,
      contact: { name, phone, email },
    };
    try { sessionStorage.setItem('rpkm-last-b2c-detail', JSON.stringify(lead)); } catch {}
    // Отправка лида в Битрикс24
    createLead({
      name, phone, email,
      title: `B2C · Детальная смета · ${area} м² · ${result.totals.grand.toLocaleString('ru-RU')} ₽`,
      comment: formatDetailComment(result),
    }).catch(() => {});
    navigate('/b2c-result-detail');
  }, [name, phone, email, agree, effectiveMode, tier, effectiveReplan, area, sanitary, windows, rooms, navigate]);

  const tierCards = [
    { key: 'capital', label: 'Капитальный', sub: 'Базовая категория, расценки тендера РПКМ.' },
    { key: 'euro', label: 'Евроремонт', sub: 'Финиш дороже: работы +30%, материалы и сантехника ×2.' },
    { key: 'premium', label: 'Премиум', sub: 'Полная смета: итальянские материалы, умный дом, мебель, техника.' },
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
                Подписка — 490 ₽/мес · 14 дней бесплатно
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Btn variant="terra" size="lg" onClick={() => navigate('/club')}>Попробовать 14 дней бесплатно</Btn>
                <Btn variant="outline" size="lg" onClick={() => navigate('/b2b-login')}>Войти как Профи</Btn>
              </div>
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px dashed ${C.gray200}` }}>
                <p style={{ color: C.gray500, fontSize: 14, marginBottom: 12 }}>Хотите узнать примерный бюджет прямо сейчас?</p>
                <Btn variant="outline" onClick={() => navigate('/b2c')}>Быстрый расчёт — бесплатно</Btn>
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
            <h2>Введите {paramCount} параметра — получите смету по 50 позициям</h2>
            <div className="quiz-hint">Расчёт по реальным расценкам, согласованным с подрядными организациями в результате тендеров.</div>

            {/* Tier */}
            <div className="form-field">
              <label>Категория ремонта</label>
              <div className="options-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                {tierCards.map(t => (
                  <button key={t.key} type="button" className={`option-card${tier === t.key ? ' selected' : ''}`} onClick={() => setTier(t.key)}>
                    <div className="option-card-title">{t.label}</div>
                    <div className="option-card-sub">{t.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Mode — скрыт для Премиум (всегда полный цикл) */}
            {tier !== 'premium' && (
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
                <input type="number" min="20" max="500" value={area} onChange={e => setArea(+e.target.value)} />
              </div>
              <div className="form-field">
                <label>Комнат</label>
                <input type="number" min="1" max="10" value={rooms} onChange={e => setRooms(+e.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div className="form-field">
                <label>Санузлов</label>
                <input type="number" min="1" max="6" value={sanitary} onChange={e => setSanitary(+e.target.value)} />
              </div>
              {effectiveMode !== 'whitebox' && (
                <div className="form-field">
                  <label>Замена окон</label>
                  <input type="number" min="0" max="20" value={windows} onChange={e => setWindows(+e.target.value)} />
                </div>
              )}
            </div>

            {/* Replan */}
            {effectiveMode !== 'whitebox' && (
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
            {preview && (
              <div className="live-preview">
                <div className="live-preview-label">Предварительная стоимость по введённым параметрам</div>
                <div className="live-preview-value">{preview.totals.grand.toLocaleString('ru-RU')} ₽</div>
                <div className="live-preview-sub">{preview.perM2.toLocaleString('ru-RU')} ₽/м²</div>
              </div>
            )}

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
              <strong>Расчёт носит предварительный характер.</strong> Точная стоимость определяется после выезда инженера.
            </div>

            <Btn variant="terra" size="lg" style={{ width: '100%', marginTop: 16 }} onClick={submit}>Получить детальную смету</Btn>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
