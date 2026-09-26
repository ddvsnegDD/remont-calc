import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import LoginModal from '../components/LoginModal';
import Btn from '../components/Btn';
import { C } from '../lib/theme';
import { useAuth } from '../lib/auth';
import { PLANS, formatPrice, labelOf, FREE_CONSULTATIONS_PER_MONTH } from '../data/tariffs';
import { withCount } from '../lib/plural';
import { getConsultationStatus, createConsultation } from '../lib/consultationApi';

const CLUB_M = PLANS.club_monthly.price; // 99
const CLUB_Y = PLANS.club_yearly.price;  // 990
const CLUB_Y_PER_MONTH = Math.round(CLUB_Y / 12); // ~82

const BENEFITS = [
  'Детальная смета по тендерным ценам (50+ позиций)',
  'Чек-листы приёмки этапов (6 шт, 175 пунктов)',
  `${withCount(FREE_CONSULTATIONS_PER_MONTH, ['консультация', 'консультации', 'консультаций'])} инженера в месяц`,
  { text: 'Закрытые чаты владельцев' },
];

const FEATURES = [
  { icon: '📋', title: 'Приёмка этапов', desc: '6 чек-листов (175 пунктов): стяжка, штукатурка, электрика, сантехника, чистовая отделка, установка дверей.' },
  { icon: '📞', title: 'Консультация', desc: `${withCount(FREE_CONSULTATIONS_PER_MONTH, ['консультация', 'консультации', 'консультаций'])} с инженером в месяц.` },
  { icon: '💬', title: 'Закрытый чат', soon: true, desc: 'Чаты владельцев для обмена опытом между участниками клуба.' },
];

const FAQ = [
  { q: 'Могу ли отменить подписку в любой момент?', a: 'Да, отмена одной кнопкой — доступ к клубным материалам прекращается сразу. Оплату за неиспользованные дни оплаченного периода можно вернуть по запросу на ddv1121@yandex.ru: возврат приходит тем же способом, которым была оплата, в течение 10 рабочих дней (раздел 6 оферты).' },
  { q: 'Чек-листы — это файлы или интерактивные?', a: 'Интерактивные веб-приложения с галочками и фотофиксацией нарушений.' },
  { q: 'А если подрядчика я уже выбрал сам?', a: 'Это обычный случай. Сметы, чек-листы и консультации не привязаны к конкретному подрядчику — они универсальные и подходят для любого.' },
  { q: 'Как происходит оплата?', a: 'Сейчас подключаем приём платежей через ЮKassa. Пока оплата недоступна, напишите нам — откроем доступ.' },
];

export default function ClubPage() {
  const navigate = useNavigate();
  const { user, subscription, hasAccess, trialUsed, refreshSubscription, markTrialUsed } = useAuth();
  const isProUser = user?.role === 'b2b';
  const [loginOpen, setLoginOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(-1);
  const [notice, setNotice] = useState(null);
  const [payLoading, setPayLoading] = useState(false);
  const [consultationsLeft, setConsultationsLeft] = useState(null); // null — остаток ещё не загружен

  const toggleFaq = useCallback((i) => { setOpenFaq(prev => prev === i ? -1 : i); }, []);

  // Ответ на действие с подпиской/консультацией показывается рядом с кнопкой,
  // а не тостом внизу экрана: тост пропадал через 5 секунд на кнопке, которая
  // в первом экране, а объяснение — полутора экранами ниже. notice.type решает,
  // у какой именно кнопки показать ответ (их несколько на странице).
  const renderNotice = (type) => {
    if (!notice || notice.type !== type) return null;
    const isError = notice.kind === 'error';
    return (
      <div style={{
        marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
        background: isError ? '#fff5f5' : '#e6f5ec', color: isError ? '#c53030' : '#16794a',
        border: `1px solid ${isError ? '#feb2b2' : '#b9e4c9'}`,
      }}>
        {isError ? '⚠ ' : '✓ '}{notice.text}
      </div>
    );
  };

  // Остаток консультаций — с сервера (часть 6 TASK_server_storage.md).
  // Лимит FREE_CONSULTATIONS_PER_MONTH в календарный месяц, без переноса
  // остатка: считает сервер, localStorage здесь больше не используется.
  useEffect(() => {
    if (!user) { setConsultationsLeft(null); return; }
    let cancelled = false;
    (async () => {
      const res = await getConsultationStatus();
      if (!cancelled && res.ok) setConsultationsLeft(res.left);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const handleConsultation = async () => {
    if (consultationsLeft === 0) {
      setNotice({ type: 'consultation', kind: 'error', text: 'Все консультации в этом месяце использованы' });
      return;
    }
    const res = await createConsultation();
    if (res.ok) {
      setConsultationsLeft(res.left);
      setNotice({ type: 'consultation', kind: 'success', text: 'Запись на консультацию отправлена! Инженер свяжется с вами в течение 24 часов.' });
      return;
    }
    if (res.error === 'limit') {
      setConsultationsLeft(0);
      setNotice({ type: 'consultation', kind: 'error', text: 'Все консультации в этом месяце использованы. Новый лимит откроется в следующем календарном месяце.' });
    } else if (res.error === 'network') {
      setNotice({ type: 'consultation', kind: 'error', text: 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.' });
    } else {
      setNotice({ type: 'consultation', kind: 'error', text: res.error || 'Ошибка записи на консультацию' });
    }
  };

  const handlePay = async () => {
    setNotice({ type: 'pay', kind: 'error', text: 'Оплата временно недоступна: подключаем ЮKassa. Напишите на ddv1121@yandex.ru, откроем доступ вручную.' });
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
        setNotice({ type: 'trial', kind: 'success', text: data.plan === 'pro_trial' ? 'PRO на 7 дней активирован!' : 'Триал на 14 дней активирован!' });
        markTrialUsed();
        refreshSubscription();
      } else {
        setNotice({ type: 'trial', kind: 'error', text: data.error || 'Ошибка активации триала' });
      }
    } catch {
      setNotice({ type: 'trial', kind: 'error', text: 'Ошибка активации триала' });
    }
  };

  const handleCancel = async () => {
    if (!confirm('Отменить подписку? Доступ к клубным материалам прекратится сразу. Оплату за неиспользованные дни можно вернуть по запросу на ddv1121@yandex.ru.')) return;
    try {
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok) {
        setNotice({ type: 'cancel', kind: 'success', text: 'Подписка отменена, доступ прекращён. Для возврата за неиспользованные дни напишите на ddv1121@yandex.ru.' });
        refreshSubscription();
      } else {
        setNotice({ type: 'cancel', kind: 'error', text: data.error || 'Ошибка отмены' });
      }
    } catch {
      setNotice({ type: 'cancel', kind: 'error', text: 'Ошибка связи с сервером' });
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
                  ) : isProUser && trialUsed ? (
                    <Btn variant="terra" size="lg" onClick={() => navigate('/pro')}>Оформить PRO — {formatPrice(PLANS.pro_monthly.price)} ₽/мес</Btn>
                  ) : (
                    <>
                      <Btn variant="terra" size="lg" onClick={handleTrial}>{isProUser ? 'Попробовать PRO 7 дней бесплатно' : 'Попробовать 14 дней бесплатно'}</Btn>
                      <Btn variant="outline" size="lg" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>Тарифы</Btn>
                    </>
                  )}
                  {renderNotice('trial')}
                </div>
                {!hasAccess && !user && <div style={{ fontSize: 13, color: C.gray500, marginTop: 10 }}>Без карты. Триал 14 дней при нажатии кнопки.</div>}
                <div className="hero-stats" style={{ marginTop: 28 }}>
                  <div><div className="stat-num">14 дней</div><div className="stat-label">бесплатный триал</div></div>
                  <div><div className="stat-num">{formatPrice(CLUB_M)} ₽</div><div className="stat-label">в месяц</div></div>
                  <div><div className="stat-num">{formatPrice(CLUB_Y)} ₽</div><div className="stat-label">в год (-17%)</div></div>
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
                        План: {labelOf(subscription?.plan)}
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
                      <p style={{ fontSize: 13, color: C.gray400, lineHeight: 1.5 }}>
                        {isProUser
                          ? (trialUsed
                              ? 'Пробный доступ уже был использован. Оформите PRO, чтобы получить офисный калькулятор и детальную спецификацию B2B.'
                              : 'Попробуйте PRO бесплатно 7 дней — офисный калькулятор и детальная спецификация B2B.')
                          : 'Активируйте триал или оформите подписку, чтобы получить доступ к детальным сметам и чек-листам.'}
                      </p>
                    </div>
                    {isProUser && trialUsed ? (
                      <Btn variant="terra" size="lg" style={{ width: '100%' }} onClick={() => navigate('/pro')}>Оформить PRO — {formatPrice(PLANS.pro_monthly.price)} ₽/мес</Btn>
                    ) : (
                      <Btn variant="terra" size="lg" style={{ width: '100%' }} onClick={handleTrial}>{isProUser ? 'Попробовать PRO 7 дней бесплатно' : 'Попробовать 14 дней бесплатно'}</Btn>
                    )}
                  </>
                ) : (
                  <>
                    <div className="hero-visual-title">Что внутри клуба</div>
                    <ul className="benefit-list">
                      {BENEFITS.map((b, i) => <li key={i}><span className="benefit-check">✓</span><span>{typeof b === 'string' ? b : <>{b.text}<span style={{ color: C.gray400 }}> · готовится</span></>}</span></li>)}
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
                  <h3>{f.title}{f.soon && <span style={{ color: C.gray400, fontWeight: 400 }}> · готовится</span>}</h3>
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
              <p>Отмена в любой момент. Доступ прекращается сразу, оплату за неиспользованные дни возвращаем по запросу.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 600, margin: '0 auto' }}>
              {/* Monthly */}
              {(() => {
                const isCurrent = hasAccess && (subscription?.plan === 'club_monthly' || subscription?.plan === 'monthly' || subscription?.status === 'trial');
                return (
                  <div style={{ background: '#fff', border: isCurrent ? `2px solid #16794a` : `1.5px solid ${C.gray200}`, borderRadius: 16, padding: '28px 24px', textAlign: 'center', position: 'relative' }}>
                    {isCurrent && <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#16794a', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>{subscription?.status === 'trial' ? 'ТРИАЛ' : 'ТЕКУЩИЙ'}</div>}
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.gray500, marginBottom: 4 }}>Месяц</div>
                    <div style={{ fontSize: 36, fontWeight: 800, color: C.graphite }}>{formatPrice(CLUB_M)} <span style={{ fontSize: 16, fontWeight: 500 }}>₽</span></div>
                    <div style={{ fontSize: 13, color: C.gray400, marginBottom: 20 }}>в месяц</div>
                    {isCurrent && expiresLabel ? (
                      <div style={{ padding: '12px', background: '#e6f5ec', color: '#16794a', borderRadius: 10, fontWeight: 600, fontSize: 14 }}>✓ до {expiresLabel}</div>
                    ) : (
                      <Btn variant="terra" style={{ width: '100%' }} onClick={() => handlePay('club_monthly')} disabled={payLoading}>Оплатить</Btn>
                    )}
                  </div>
                );
              })()}
              {/* Yearly */}
              {(() => {
                const isCurrent = hasAccess && (subscription?.plan === 'club_yearly' || subscription?.plan === 'yearly');
                return (
                  <div style={{ background: '#fff', border: `2px solid ${isCurrent ? '#16794a' : C.terra}`, borderRadius: 16, padding: '28px 24px', textAlign: 'center', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: isCurrent ? '#16794a' : C.terra, color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>{isCurrent ? 'ТЕКУЩИЙ' : 'ВЫГОДНО'}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.gray500, marginBottom: 4 }}>Год</div>
                    <div style={{ fontSize: 36, fontWeight: 800, color: C.graphite }}>{formatPrice(CLUB_Y)} <span style={{ fontSize: 16, fontWeight: 500 }}>₽</span></div>
                    <div style={{ fontSize: 13, color: C.gray400, marginBottom: 20 }}>{formatPrice(CLUB_Y_PER_MONTH)} ₽/мес · экономия 17%</div>
                    {isCurrent && expiresLabel ? (
                      <div style={{ padding: '12px', background: '#e6f5ec', color: '#16794a', borderRadius: 10, fontWeight: 600, fontSize: 14 }}>✓ до {expiresLabel}</div>
                    ) : (
                      <Btn variant="terra" style={{ width: '100%' }} onClick={() => handlePay('club_yearly')} disabled={payLoading}>Оплатить</Btn>
                    )}
                  </div>
                );
              })()}
            </div>
            {notice?.type === 'pay' && <div style={{ maxWidth: 600, margin: '0 auto' }}>{renderNotice('pay')}</div>}
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
                  <p>6 интерактивных чек-листов (175 пунктов) под каждый этап.</p>
                  <ul className="club-list">
                    <li>Стяжка пола</li><li>Штукатурка стен</li><li>Электрика и розетки</li>
                    <li>Сантехника</li><li>Чистовая отделка</li><li>Установка дверей</li>
                  </ul>
                  <Btn variant="outline" onClick={() => navigate('/checklists')}>Открыть чек-листы</Btn>
                </div>
                <div className="club-card">
                  <h3>Консультация инженера</h3>
                  <p>В этом месяце доступно: <strong>{consultationsLeft ?? '…'} из {FREE_CONSULTATIONS_PER_MONTH}</strong> консультаций.</p>
                  <Btn variant="terra" onClick={handleConsultation} disabled={consultationsLeft === 0}>Записаться</Btn>
                  <div style={{ fontSize: 12, color: C.gray400, marginTop: 8 }}>
                    {consultationsLeft === null ? 'Загрузка остатка...' : `Осталось ${withCount(consultationsLeft, ['консультация', 'консультации', 'консультаций'])}`}
                  </div>
                  {renderNotice('consultation')}
                </div>
                <div className="club-card">
                  <h3>Управление подпиской</h3>
                  <p style={{ color: C.gray500, fontSize: 14 }}>
                    {subscription?.status === 'trial'
                      ? `Триал до ${expiresLabel || '—'}`
                      : `Активна до ${expiresLabel || '—'}`}
                  </p>
                  <div style={{ fontSize: 13, color: C.gray400, marginTop: 8 }}>
                    План: {labelOf(subscription?.plan)}
                  </div>
                  <button onClick={handleCancel}
                    style={{ marginTop: 12, background: 'none', border: 'none', color: '#dc3545', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
                    Отменить подписку
                  </button>
                  {renderNotice('cancel')}
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

        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={() => refreshSubscription()} />
      </main>
    </PageLayout>
  );
}
