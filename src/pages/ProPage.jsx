import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import Btn from '../components/Btn';
import { C } from '../lib/theme';
import { useAuth } from '../lib/auth';
import { PLANS, formatPrice, FREE_CONSULTATIONS_PER_MONTH } from '../data/tariffs';

const PRO_PRICE = formatPrice(PLANS.pro_monthly.price); // «2 900»

const BENEFITS = [
  'Безлимит расчётов',
  'Офисный fit-out калькулятор (25+ статей)',
  'Детальная спецификация B2B по тендерным ценам',
  { text: 'White-label PDF (логотип, реквизиты)', soon: true },
  `Консультации сметчика (до ${FREE_CONSULTATIONS_PER_MONTH} в месяц)`,
  'Приоритетная поддержка',
  'Экспорт CSV / Excel',
];

const FAQ = [
  { q: 'Что входит в PRO?', a: 'Всё из Клуба владельцев плюс инструменты для профессионалов: офисный fit-out калькулятор и детальная спецификация B2B по тендерным ценам, приоритетная поддержка, а также white-label PDF — эта функция готовится к запуску.' },
  { q: 'Есть ли годовой тариф PRO?', a: 'Пока доступен месячный тариф — 2 900 ₽/мес без автопродления: доступ продлевается только новой оплатой. Годовой тариф готовится.' },
  { q: 'Как работает white-label PDF?', a: 'В настройках профиля загружаете логотип и реквизиты. Все PDF формируются с вашим брендом. Функция готовится к запуску.' },
];

export default function ProPage() {
  const navigate = useNavigate();
  const { user, subscription, queue, hasPro, refreshSubscription, startTrial, canTryProTrial } = useAuth();
  const [openFaq, setOpenFaq] = useState(-1);
  const [notice, setNotice] = useState(null);
  const [payLoading, setPayLoading] = useState(false);
  const [trialLoading, setTrialLoading] = useState(false);

  const toggleFaq = useCallback((i) => { setOpenFaq(prev => prev === i ? -1 : i); }, []);

  // Ответ на действие показывается рядом с кнопкой, а не тостом внизу экрана
  // (как на /club): notice.place — под какой кнопкой, kind — error | success | info.
  // Ошибка не исчезает сама; успех триала снимается через 8 с (рядом появляется
  // «✓ PRO активен»), info («скоро») — через 4 с.
  useEffect(() => {
    if (!notice || notice.kind === 'error') return;
    const t = setTimeout(() => setNotice(null), notice.kind === 'success' ? 8000 : 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const renderNotice = (place) => {
    if (!notice || notice.place !== place) return null;
    const palette = {
      error: { bg: '#fff5f5', color: '#c53030', border: '#feb2b2', mark: '⚠ ' },
      success: { bg: '#e6f5ec', color: '#16794a', border: '#b9e4c9', mark: '✓ ' },
      info: { bg: C.gray50, color: C.gray500, border: C.gray200, mark: '' },
    }[notice.kind];
    return (
      <div style={{
        width: '100%', marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, textAlign: 'left',
        background: palette.bg, color: palette.color, border: `1px solid ${palette.border}`,
      }}>
        {palette.mark}{notice.text}
      </div>
    );
  };

  const handlePay = useCallback(async (place) => {
    setNotice(null);
    setPayLoading(true);
    try {
      const res = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan: 'pro_monthly' }),
      });
      const data = await res.json();
      if (data.ok) {
        window.location.href = data.confirmationUrl;
        return;
      }
      const text = data.error === 'payments_off'
        ? 'Оплата временно недоступна. Напишите на ddv1121@yandex.ru, откроем доступ вручную.'
        : data.error === 'provider'
          ? 'Не удалось создать платёж. Попробуйте ещё раз или напишите на ddv1121@yandex.ru.'
          : data.error || 'Ошибка оплаты';
      setNotice({ place, kind: 'error', text });
    } catch {
      setNotice({ place, kind: 'error', text: 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.' });
    } finally {
      setPayLoading(false);
    }
  }, []);

  const handleTrial = useCallback(async (place) => {
    setNotice(null);
    setTrialLoading(true);
    const res = await startTrial();
    setTrialLoading(false);
    // Успех: startTrial уже обновил подписку — страница сама покажет «✓ PRO активен».
    setNotice(res.ok
      ? { place, kind: 'success', text: 'PRO на 7 дней активирован!' }
      : { place, kind: 'error', text: res.error || 'Ошибка активации триала' });
  }, [startTrial]);

  const fmtDate = (d) => new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/\s+г\.$/, '\u00A0г.');
  // «Оплачен до» — по последнему PRO-периоду в очереди (с учётом оплаченных
  // вперёд), а не только по текущему; доступ по-прежнему определяет hasPro.
  const proEnds = queue.filter(q => q.tier === 'pro').map(q => new Date(q.expiresAt).getTime());
  const proEnd = proEnds.length > 0 ? new Date(Math.max(...proEnds)) : null;
  const expiresLabel = proEnd ? fmtDate(proEnd) : (subscription?.expiresAt ? fmtDate(subscription.expiresAt) : null);

  const heroCta = !user
    ? <Btn variant="dark" size="lg" onClick={() => navigate('/b2b-login')}>Войти для оформления PRO</Btn>
    : hasPro
      ? (
        <>
          <div style={{ display: 'inline-flex', gap: 10, alignItems: 'center', padding: '12px 18px', background: '#e6f5ec', color: '#16794a', borderRadius: 8, fontWeight: 600 }}>
            ✓ PRO активен{expiresLabel && <span style={{ fontWeight: 400, fontSize: 13 }}>до {expiresLabel}</span>}
          </div>
          <Btn variant="dark" size="lg" onClick={() => handlePay('hero')} disabled={payLoading}>Продлить PRO за {PRO_PRICE} ₽</Btn>
        </>
      )
      : canTryProTrial
        ? (
          <>
            <Btn variant="dark" size="lg" onClick={() => handleTrial('hero')} disabled={trialLoading}>Попробовать PRO 7 дней бесплатно</Btn>
            <Btn variant="outline" size="lg" onClick={() => handlePay('hero')} disabled={payLoading}>Оформить PRO за {PRO_PRICE} ₽/мес</Btn>
          </>
        )
        : <Btn variant="dark" size="lg" onClick={() => handlePay('hero')} disabled={payLoading}>Оформить PRO за {PRO_PRICE} ₽/мес</Btn>;

  return (
    <PageLayout>
      <main>
        {/* Hero */}
        <section style={{ padding: '60px 0 40px', background: `linear-gradient(180deg, #eaf2fb 0%, ${C.white} 100%)` }}>
          <div className="container">
            <div className="hero-grid">
              <div className="hero-content">
                <span className="section-label">Подписка PRO</span>
                <h1>PRO-кабинет для дизайнеров и техзаказчиков</h1>
                <p className="hero-lead">
                  Офисный fit-out калькулятор, детальная спецификация B2B, безлимитные расчёты,
                  приоритетная поддержка. Всё за {PRO_PRICE} ₽/мес. White-label PDF — готовится.
                </p>
                <div className="hero-cta">
                  {heroCta}
                  {user && !hasPro && (
                    <div style={{ fontSize: 12, color: C.gray500, marginTop: 8 }}>
                      {canTryProTrial
                        ? 'Без карты. Пробный доступ даётся один раз на аккаунт. Если у вас действует Клуб, он заменяется на PRO с момента оплаты'
                        : 'Без автопродления. Если у вас действует Клуб, он заменяется на PRO с момента оплаты.'}
                    </div>
                  )}
                  {user && hasPro && expiresLabel && (
                    <div style={{ fontSize: 12, color: C.gray500, marginTop: 8 }}>
                      Период добавится к окончанию, новый срок начнётся {expiresLabel}
                    </div>
                  )}
                  {renderNotice('hero')}
                </div>
                <div className="hero-stats" style={{ marginTop: 28 }}>
                  <div><div className="stat-num">{PRO_PRICE} ₽</div><div className="stat-label">в месяц · без автопродления</div></div>
                  <div><div className="stat-num">∞</div><div className="stat-label">расчётов в месяц</div></div>
                  <div><div className="stat-num">1–2 дня</div><div className="stat-label">ответ сметчика на консультацию</div></div>
                </div>
              </div>
              <div className="hero-visual">
                <div className="hero-visual-title">Что включено</div>
                <ul className="benefit-list">
                  {BENEFITS.map((b, i) => (
                    <li key={i}><span className="benefit-check" style={{ background: '#e8eef7' }}>✓</span>
                      <span>{typeof b === 'string' ? b : <>{b.text}<span style={{ color: C.gray400 }}> · готовится</span></>}</span></li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section>
          <div className="container">
            <div className="section-head">
              <span className="section-label">Сравнение</span>
              <h2>Бесплатный тариф vs PRO</h2>
            </div>
            <div className="compare-grid">
              <div className="compare-col">
                <div className="compare-name">Бесплатный</div>
                <div className="compare-price">0 ₽</div>
                <ul>
                  <li>Быстрый предварительный расчёт</li>
                  <li>Стандартные PDF-сметы</li>
                  <li>История расчётов</li>
                  <li className="off" style={{ textDecoration: 'line-through' }}>Офисный fit-out калькулятор</li>
                  <li className="off" style={{ textDecoration: 'line-through' }}>Детальная спецификация B2B</li>
                  <li className="off" style={{ textDecoration: 'line-through' }}>White-label PDF</li>
                  <li className="off" style={{ textDecoration: 'line-through' }}>Экспорт в CSV / Excel</li>
                </ul>
              </div>
              <div className="compare-col compare-featured">
                <div className="compare-name">PRO</div>
                <div className="compare-price">{PRO_PRICE} ₽<span style={{ fontSize: 14, color: C.gray500, fontWeight: 500 }}>/мес</span></div>
                <ul>
                  <li>Безлимит расчётов</li>
                  <li>Офисный fit-out калькулятор</li>
                  <li>Детальная спецификация B2B</li>
                  <li>White-label PDF (логотип, реквизиты)<span style={{ color: C.gray400 }}> · готовится</span></li>
                  <li>Консультации сметчика (до {FREE_CONSULTATIONS_PER_MONTH} в месяц)</li>
                  <li>Приоритетная поддержка</li>
                  <li>Экспорт в CSV / Excel</li>
                </ul>
                <Btn variant="dark" size="lg" style={{ width: '100%', marginTop: 16 }}
                  onClick={() => !user ? navigate('/b2b-login') : canTryProTrial ? handleTrial('compare') : handlePay('compare')}
                  disabled={user && (payLoading || trialLoading)}>
                  {!user ? 'Войти для оформления' : hasPro ? 'Продлить PRO' : canTryProTrial ? 'Попробовать PRO 7 дней бесплатно' : 'Перейти на PRO'}
                </Btn>
                {renderNotice('compare')}
              </div>
            </div>
          </div>
        </section>

        {/* Member area */}
        {hasPro && (
          <section>
            <div className="container" style={{ maxWidth: 960 }}>
              <div className="section-head">
                <span className="section-label">PRO-кабинет</span>
                <h2>Управление подпиской</h2>
              </div>
              <div className="club-grid">
                <div className="club-card" style={{ borderLeft: `4px solid ${C.terra}`, background: `linear-gradient(180deg, ${C.terraBg} 0%, white 60%)` }}>
                  <h3>Офисный fit-out</h3>
                  <p>Детальная смета офиса по 25+ статьям расходов.</p>
                  <Btn variant="terra" style={{ marginTop: 8 }} onClick={() => navigate('/b2b-office')}>Открыть калькулятор →</Btn>
                </div>
                <div className="club-card">
                  <h3>White-label PDF<span style={{ color: C.gray400, fontWeight: 400 }}> · готовится</span></h3>
                  <p>Загрузите логотип — все PDF будут с вашим брендом.</p>
                  <Btn variant="outline" onClick={() => setNotice({ place: 'whitelabel', kind: 'info', text: 'White-label PDF — скоро' })}>Настроить →</Btn>
                  {renderNotice('whitelabel')}
                </div>
                <div className="club-card">
                  <h3>Экспорт в CSV</h3>
                  <p>Скачайте историю расчётов одним файлом.</p>
                  <Btn variant="outline" onClick={() => setNotice({ place: 'csv', kind: 'info', text: 'Экспорт CSV — скоро' })}>Скачать CSV →</Btn>
                  {renderNotice('csv')}
                </div>
                <div className="club-card">
                  <h3>Управление подпиской</h3>
                  <p style={{ color: C.gray500, fontSize: 14 }}>
                    PRO активен{expiresLabel ? ` до ${expiresLabel}` : ''}. Стоимость: {PRO_PRICE} ₽/мес
                  </p>
                  <Btn variant="outline" style={{ marginTop: 12 }} onClick={() => navigate('/b2b-cabinet')}>В кабинет →</Btn>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* FAQ */}
        <section style={{ background: C.gray50 }}>
          <div className="container" style={{ maxWidth: 800 }}>
            <div className="section-head">
              <span className="section-label">Вопросы</span>
              <h2>Часто спрашивают</h2>
            </div>
            <div className="faq-list">
              {FAQ.map((f, i) => (
                <div key={i} className={`faq-item${openFaq === i ? ' open' : ''}`}>
                  <div className="faq-q" onClick={() => toggleFaq(i)}>{f.q}</div>
                  <div className="faq-a">{f.a}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </PageLayout>
  );
}
