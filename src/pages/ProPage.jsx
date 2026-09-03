import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import Btn from '../components/Btn';
import { C } from '../lib/theme';
import { useAuth } from '../lib/auth';
import { PLANS, formatPrice } from '../data/tariffs';

const PRO_PRICE = formatPrice(PLANS.pro_monthly.price); // «2 900»

const BENEFITS = [
  'Безлимит расчётов',
  'Офисный fit-out калькулятор (25+ статей)',
  'Детальная спецификация B2B по тендерным ценам',
  { text: 'White-label PDF (логотип, реквизиты)', soon: true },
  'Персональный менеджер',
  'Приоритетная поддержка (24 ч SLA)',
  'Экспорт CSV / Excel',
];

const FAQ = [
  { q: 'Что входит в PRO?', a: 'Всё из Клуба владельцев плюс инструменты для профессионалов: офисный fit-out калькулятор и детальная спецификация B2B по тендерным ценам, а также white-label PDF и приоритетная поддержка.' },
  { q: 'Есть ли годовой тариф PRO?', a: 'Пока доступен месячный тариф — 2 900 ₽/мес с отменой в любой момент. Годовой тариф готовится.' },
  { q: 'Как работает white-label PDF?', a: 'В настройках профиля загружаете логотип и реквизиты. Все PDF формируются с вашим брендом. Функция готовится к запуску.' },
];

export default function ProPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, subscription, hasPro, refreshSubscription } = useAuth();
  const [openFaq, setOpenFaq] = useState(-1);
  const [notice, setNotice] = useState(null);
  const [payLoading, setPayLoading] = useState(false);

  const toggleFaq = useCallback((i) => { setOpenFaq(prev => prev === i ? -1 : i); }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  // Возврат с ЮMoney: активируем подписку и поллим статус
  useEffect(() => {
    const payment = searchParams.get('payment');
    const label = searchParams.get('label');
    if (payment === 'success' && label) {
      fetch('/api/subscription/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ label }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.ok) {
            setNotice('Подписка PRO активирована!');
            refreshSubscription();
          } else {
            setNotice('Оплата получена. Подписка активируется в течение нескольких минут.');
            const interval = setInterval(() => {
              refreshSubscription().then(d => {
                if (d?.hasPro) {
                  clearInterval(interval);
                  setNotice('Подписка PRO активирована!');
                }
              });
            }, 5000);
            setTimeout(() => clearInterval(interval), 120000);
          }
        })
        .catch(() => setNotice('Ожидаем подтверждения оплаты...'));
    }
  }, [searchParams, refreshSubscription]);

  const handlePay = useCallback(async () => {
    if (!user) { navigate('/b2b-login'); return; }
    setPayLoading(true);
    try {
      const res = await fetch('/api/subscription/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan: 'pro_monthly' }),
      });
      const data = await res.json();
      if (data.ok && data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        setNotice(data.error || 'Ошибка создания платежа');
      }
    } catch {
      setNotice('Ошибка связи с сервером');
    } finally {
      setPayLoading(false);
    }
  }, [user, navigate]);

  const expiresLabel = subscription?.expiresAt
    ? new Date(subscription.expiresAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const heroCta = !user
    ? <Btn variant="dark" size="lg" onClick={() => navigate('/b2b-login')}>Войти для оформления PRO</Btn>
    : hasPro
      ? (
        <div style={{ display: 'inline-flex', gap: 10, alignItems: 'center', padding: '12px 18px', background: '#e6f5ec', color: '#16794a', borderRadius: 8, fontWeight: 600 }}>
          ✓ PRO активен{expiresLabel && <span style={{ fontWeight: 400, fontSize: 13 }}>до {expiresLabel}</span>}
        </div>
      )
      : <Btn variant="dark" size="lg" onClick={handlePay} disabled={payLoading}>Оформить PRO за {PRO_PRICE} ₽/мес</Btn>;

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
                  white-label PDF, приоритетная поддержка. Всё за {PRO_PRICE} ₽/мес.
                </p>
                <div className="hero-cta">{heroCta}</div>
                <div className="hero-stats" style={{ marginTop: 28 }}>
                  <div><div className="stat-num">{PRO_PRICE} ₽</div><div className="stat-label">в месяц · отмена в один клик</div></div>
                  <div><div className="stat-num">∞</div><div className="stat-label">расчётов в месяц</div></div>
                  <div><div className="stat-num">24 часа</div><div className="stat-label">SLA на ответ инженера</div></div>
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
                  <li>Приоритетная поддержка (24 ч SLA)</li>
                  <li>Экспорт в CSV / Excel</li>
                </ul>
                <Btn variant="dark" size="lg" style={{ width: '100%', marginTop: 16 }}
                  onClick={() => !user ? navigate('/b2b-login') : hasPro ? null : handlePay()}
                  disabled={hasPro || payLoading}>
                  {!user ? 'Войти для оформления' : hasPro ? '✓ PRO уже активен' : 'Перейти на PRO'}
                </Btn>
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
                  <h3>White-label PDF</h3>
                  <p>Загрузите логотип — все PDF будут с вашим брендом.</p>
                  <Btn variant="outline" onClick={() => setNotice('White-label PDF — скоро')}>Настроить →</Btn>
                </div>
                <div className="club-card">
                  <h3>Экспорт в CSV</h3>
                  <p>Скачайте историю расчётов одним файлом.</p>
                  <Btn variant="outline" onClick={() => setNotice('Экспорт CSV — скоро')}>Скачать CSV →</Btn>
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
        {notice && (
          <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: C.graphite, color: '#fff', padding: '12px 24px', borderRadius: 10, fontSize: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', maxWidth: 400, textAlign: 'center' }}>
            {notice}
          </div>
        )}
      </main>
    </PageLayout>
  );
}
