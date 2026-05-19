import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import LoginModal from '../components/LoginModal';
import Btn from '../components/Btn';
import { C } from '../lib/theme';
import { useAuth } from '../lib/auth';

const BENEFITS = [
  'Детальная смета по тендерным ценам (50+ позиций)',
  'Чек-листы приёмки этапов (6 шт, 42 пункта)',
  '3 консультации инженера в месяц',
  'Закрытые чаты владельцев',
];

const FEATURES = [
  { icon: '📋', title: 'Приёмка этапов', desc: '6 чек-листов (42 пункта): стяжка, штукатурка, электрика, сантехника, чистовая отделка, установка дверей.' },
  { icon: '📞', title: 'Консультация', desc: '3 консультации с инженером в месяц. Можно копить — до 9 консультаций.' },
  { icon: '💬', title: 'Закрытый чат', desc: 'Чаты для обмена опытом. Куратор и владельцы помогают.' },
];

const FAQ = [
  { q: 'Могу ли отменить подписку в любой момент?', a: 'Да, отмена одной кнопкой. Деньги вернутся на карту в течение 3 дней.' },
  { q: 'Чек-листы — это файлы или интерактивные?', a: 'Интерактивные веб-приложения с галочками и фотофиксацией нарушений.' },
  { q: 'Что, если ремонт делаю не у РПКМ?', a: 'Без разницы. Чек-листы и консультации универсальные — подходят для любого подрядчика.' },
  { q: 'Как происходит оплата?', a: 'Через ЮMoney — банковская карта или кошелёк. Безопасная оплата на сайте ЮMoney.' },
];

export default function ClubPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, subscription, hasAccess, refreshSubscription } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(-1);
  const [notice, setNotice] = useState(null);
  const [payLoading, setPayLoading] = useState(false);
  const [consultationsLeft, setConsultationsLeft] = useState(3);

  const toggleFaq = useCallback((i) => { setOpenFaq(prev => prev === i ? -1 : i); }, []);

  // Handle payment return
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
            setNotice('Подписка активирована!');
            refreshSubscription();
          } else {
            setNotice('Оплата получена. Подписка активируется в течение нескольких минут.');
            const interval = setInterval(() => {
              refreshSubscription().then(d => {
                if (d?.hasAccess) {
                  clearInterval(interval);
                  setNotice('Подписка активирована!');
                }
              });
            }, 5000);
            setTimeout(() => clearInterval(interval), 120000);
          }
        })
        .catch(() => setNotice('Ожидаем подтверждения оплаты...'));
    }
  }, [searchParams, refreshSubscription]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  // Load consultations counter from localStorage
  useEffect(() => {
    if (!user) return;
    const key = `rpkm_consult_${user.id}_${new Date().getFullYear()}_${new Date().getMonth()}`;
    const used = parseInt(localStorage.getItem(key) || '0', 10);
    setConsultationsLeft(Math.max(0, 3 - used));
  }, [user]);

  const handleConsultation = () => {
    if (consultationsLeft <= 0) {
      setNotice('Все консультации в этом месяце использованы');
      return;
    }
    const key = `rpkm_consult_${user.id}_${new Date().getFullYear()}_${new Date().getMonth()}`;
    const used = parseInt(localStorage.getItem(key) || '0', 10);
    localStorage.setItem(key, String(used + 1));
    setConsultationsLeft(Math.max(0, 2 - used));
    setNotice('Запись на консультацию отправлена! Инженер свяжется с вами в течение 24 часов.');
  };

  const handlePay = async (plan) => {
    if (!user) { setLoginOpen(true); return; }
    setPayLoading(true);
    try {
      const res = await fetch('/api/subscription/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan }),
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
  };

  const handleTrial = async () => {
    if (!user) { setLoginOpen(true); return; }
    try {
      const res = await fetch('/api/subscription/trial', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok) {
        setNotice('Триал на 14 дней активирован!');
        refreshSubscription();
      } else {
        setNotice(data.error || 'Триал уже был использован');
      }
    } catch {
      setNotice('Ошибка активации триала');
    }
  };

  const handleCancel = async () => {
    if (!confirm('Вы уверены, что хотите отменить подписку?')) return;
    try {
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok) {
        setNotice('Подписка отменена. Деньги вернутся на карту в течение 3 дней.');
        refreshSubscription();
      } else {
        setNotice(data.error || 'Ошибка отмены');
      }
    } catch {
      setNotice('Ошибка связи с сервером');
    }
  };

  const expiresLabel = subscription?.expiresAt
    ? new Date(subscription.expiresAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <PageLayout>
      <main>
        {/* Hero */}
        <section className="hero" style={{ padding: '60px 0 40px' }}>
          <div className="container">
            <div className="hero-grid">
              <div className="hero-content">
                <span className="section-label">Клуб владельцев</span>
                <h1>Профессиональные инструменты для вашего ремонта</h1>
                <p className="hero-lead">
                  Принимайте этапы по чек-листам, получайте консультации инженера,
                  экономьте время и нервы. Первые 14 дней — бесплатно.
                </p>
                <div className="hero-cta">
                  {hasAccess ? (
                    <div style={{ display: 'inline-flex', gap: 10, alignItems: 'center', padding: '12px 18px', background: '#e6f5ec', color: '#16794a', borderRadius: 8, fontWeight: 600 }}>
                      ✓ {subscription?.status === 'trial' ? 'Триал активен' : 'Подписка активна'}
                      {expiresLabel && <span style={{ fontWeight: 400, fontSize: 13 }}>до {expiresLabel}</span>}
                    </div>
                  ) : (
                    <>
                      <Btn variant="terra" size="lg" onClick={handleTrial}>Попробовать 14 дней бесплатно</Btn>
                      <Btn variant="outline" size="lg" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>Тарифы</Btn>
                    </>
                  )}
                </div>
                {!hasAccess && !user && <div style={{ fontSize: 13, color: C.gray500, marginTop: 10 }}>Без карты. Триал 14 дней при нажатии кнопки.</div>}
                <div className="hero-stats" style={{ marginTop: 28 }}>
                  <div><div className="stat-num">14 дней</div><div className="stat-label">бесплатный триал</div></div>
                  <div><div className="stat-num">490 ₽</div><div className="stat-label">в месяц</div></div>
                  <div><div className="stat-num">4 900 ₽</div><div className="stat-label">в год (-17%)</div></div>
                </div>
              </div>
              <div className="hero-visual">
                {hasAccess ? (
                  <>
                    <div className="hero-visual-title">Ваш статус</div>
                    <div style={{ padding: '20px 0' }}>
                      <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', padding: '10px 18px', background: '#e6f5ec', color: '#16794a', borderRadius: 10, fontWeight: 600, fontSize: 15, marginBottom: 16 }}>
                        ✓ {subscription?.status === 'trial' ? 'Триал активен' : 'Подписка активна'}
                      </div>
                      {expiresLabel && (
                        <div style={{ fontSize: 14, color: C.gray500, marginBottom: 12 }}>до {expiresLabel}</div>
                      )}
                      <div style={{ fontSize: 13, color: C.gray500, marginBottom: 6 }}>
                        План: {subscription?.plan === 'yearly' ? 'Годовой (4 900 ₽/год)' : subscription?.plan === 'monthly' ? 'Месячный (490 ₽/мес)' : 'Триал (14 дней)'}
                      </div>
                    </div>
                    <Btn variant="terra" size="lg" style={{ width: '100%' }} onClick={() => navigate('/b2c-detail')}>Сделать детальную смету</Btn>
                    <div style={{ fontSize: 12, color: C.gray400, marginTop: 10, textAlign: 'center' }}>Расчёт по 50+ позициям с тендерными ценами</div>
                  </>
                ) : user ? (
                  <>
                    <div className="hero-visual-title">Ваш аккаунт</div>
                    <div style={{ padding: '20px 0' }}>
                      <div style={{ fontSize: 14, color: C.gray500, marginBottom: 8 }}>Нет активной подписки</div>
                      <p style={{ fontSize: 13, color: C.gray400, lineHeight: 1.5 }}>Активируйте триал или оформите подписку, чтобы получить доступ к детальным сметам и чек-листам.</p>
                    </div>
                    <Btn variant="terra" size="lg" style={{ width: '100%' }} onClick={handleTrial}>Попробовать 14 дней бесплатно</Btn>
                  </>
                ) : (
                  <>
                    <div className="hero-visual-title">Что внутри клуба</div>
                    <ul className="benefit-list">
                      {BENEFITS.map((b, i) => <li key={i}><span className="benefit-check">✓</span><span>{b}</span></li>)}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section style={{ background: C.gray50 }}>
          <div className="container">
            <div className="section-head">
              <span className="section-label">Возможности</span>
              <h2>Подписка окупается после первой приёмки работ</h2>
            </div>
            <div className="features-grid">
              {FEATURES.map((f, i) => (
                <div key={i} className="feature">
                  <div className="feature-icon">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing">
          <div className="container" style={{ maxWidth: 800 }}>
            <div className="section-head">
              <span className="section-label">Тарифы</span>
              <h2>Простые и прозрачные цены</h2>
              <p>Отмена в любой момент. Доступ до конца оплаченного периода.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 600, margin: '0 auto' }}>
              {/* Monthly */}
              {(() => {
                const isCurrent = hasAccess && (subscription?.plan === 'monthly' || subscription?.status === 'trial');
                return (
                  <div style={{ background: '#fff', border: isCurrent ? `2px solid #16794a` : `1.5px solid ${C.gray200}`, borderRadius: 16, padding: '28px 24px', textAlign: 'center', position: 'relative' }}>
                    {isCurrent && <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#16794a', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>{subscription?.status === 'trial' ? 'ТРИАЛ' : 'ТЕКУЩИЙ'}</div>}
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.gray500, marginBottom: 4 }}>Месяц</div>
                    <div style={{ fontSize: 36, fontWeight: 800, color: C.graphite }}>490 <span style={{ fontSize: 16, fontWeight: 500 }}>₽</span></div>
                    <div style={{ fontSize: 13, color: C.gray400, marginBottom: 20 }}>в месяц</div>
                    {isCurrent && expiresLabel ? (
                      <div style={{ padding: '12px', background: '#e6f5ec', color: '#16794a', borderRadius: 10, fontWeight: 600, fontSize: 14 }}>✓ до {expiresLabel}</div>
                    ) : (
                      <Btn variant="terra" style={{ width: '100%' }} onClick={() => handlePay('monthly')} disabled={payLoading}>Оплатить</Btn>
                    )}
                  </div>
                );
              })()}
              {/* Yearly */}
              {(() => {
                const isCurrent = hasAccess && subscription?.plan === 'yearly';
                return (
                  <div style={{ background: '#fff', border: `2px solid ${isCurrent ? '#16794a' : C.terra}`, borderRadius: 16, padding: '28px 24px', textAlign: 'center', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: isCurrent ? '#16794a' : C.terra, color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>{isCurrent ? 'ТЕКУЩИЙ' : 'ВЫГОДНО'}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.gray500, marginBottom: 4 }}>Год</div>
                    <div style={{ fontSize: 36, fontWeight: 800, color: C.graphite }}>4 900 <span style={{ fontSize: 16, fontWeight: 500 }}>₽</span></div>
                    <div style={{ fontSize: 13, color: C.gray400, marginBottom: 20 }}>408 ₽/мес · экономия 17%</div>
                    {isCurrent && expiresLabel ? (
                      <div style={{ padding: '12px', background: '#e6f5ec', color: '#16794a', borderRadius: 10, fontWeight: 600, fontSize: 14 }}>✓ до {expiresLabel}</div>
                    ) : (
                      <Btn variant="terra" style={{ width: '100%' }} onClick={() => handlePay('yearly')} disabled={payLoading}>Оплатить</Btn>
                    )}
                  </div>
                );
              })()}
            </div>
            {!user && (
              <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: C.gray500 }}>
                Для оплаты необходимо <button onClick={() => setLoginOpen(true)} style={{ background: 'none', border: 'none', color: C.terra, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>войти или зарегистрироваться</button>
              </p>
            )}
          </div>
        </section>

        {/* Member area */}
        {hasAccess && (
          <section style={{ background: C.gray50 }}>
            <div className="container" style={{ maxWidth: 960 }}>
              <div className="section-head">
                <span className="section-label">Кабинет участника</span>
                <h2>Добро пожаловать в клуб</h2>
              </div>
              <div className="club-grid">
                <div className="club-card" style={{ borderLeft: `4px solid ${C.terra}`, background: `linear-gradient(180deg, ${C.terraBg} 0%, white 60%)` }}>
                  <h3>Детальная смета</h3>
                  <p>Расчёт по тендерным ценам РПКМ — 50+ позиций с конкретными артикулами.</p>
                  <Btn variant="terra" style={{ marginTop: 8 }} onClick={() => navigate('/b2c-detail')}>Создать детальную смету</Btn>
                </div>
                <div className="club-card">
                  <h3>Чек-листы приёмки</h3>
                  <p>6 интерактивных чек-листов (42 пункта) под каждый этап.</p>
                  <ul className="club-list">
                    <li>Стяжка пола</li><li>Штукатурка стен</li><li>Электрика и розетки</li>
                    <li>Сантехника</li><li>Чистовая отделка</li><li>Установка дверей</li>
                  </ul>
                  <Btn variant="outline" onClick={() => navigate('/checklists')}>Открыть чек-листы</Btn>
                </div>
                <div className="club-card">
                  <h3>Консультация инженера</h3>
                  <p>В этом месяце доступно: <strong>{consultationsLeft} из 3</strong> консультаций.</p>
                  <Btn variant="terra" onClick={handleConsultation} disabled={consultationsLeft <= 0}>Записаться</Btn>
                  <div style={{ fontSize: 12, color: C.gray400, marginTop: 8 }}>Осталось {consultationsLeft} консультаций</div>
                </div>
                <div className="club-card">
                  <h3>Управление подпиской</h3>
                  <p style={{ color: C.gray500, fontSize: 14 }}>
                    {subscription?.status === 'trial'
                      ? `Триал до ${expiresLabel || '—'}`
                      : `Активна до ${expiresLabel || '—'}`}
                  </p>
                  <div style={{ fontSize: 13, color: C.gray400, marginTop: 8 }}>
                    План: {subscription?.plan === 'yearly' ? 'Годовой' : subscription?.plan === 'monthly' ? 'Месячный' : 'Триал'}
                  </div>
                  <button onClick={handleCancel}
                    style={{ marginTop: 12, background: 'none', border: 'none', color: '#dc3545', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
                    Отменить подписку
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* FAQ */}
        <section id="faq">
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

        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={() => refreshSubscription()} />
      </main>
    </PageLayout>
  );
}
