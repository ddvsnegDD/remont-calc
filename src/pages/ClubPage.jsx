import { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import Btn from '../components/Btn';
import { C } from '../lib/theme';

const BENEFITS = [
  'Детальная смета по тендерным ценам (50+ позиций)',
  'Чек-листы приёмки этапов (12 шт)',
  'Скидки 5–15% у партнёров РПКМ',
  'Консультация инженера (30 мин/мес)',
  'Закрытый чат владельцев',
];

const FEATURES = [
  { icon: '🛁', title: 'Сантехника', desc: 'Скидка 10% у Roca, Hansgrohe, Grohe. Экономия 15–80 тыс ₽.' },
  { icon: '🪑', title: 'Мебель', desc: 'Скидка 7–12% у дилеров кухонь и встройки — от 30 тыс ₽.' },
  { icon: '💡', title: 'Свет', desc: 'Дисконт 10–15% у поставщиков светильников. Экономия 20+ тыс ₽.' },
  { icon: '📋', title: 'Приёмка этапов', desc: '12 чек-листов: стяжка, штукатурка, электрика, чистовая отделка.' },
  { icon: '📞', title: 'Консультация', desc: '30 минут с инженером в месяц. Можно копить — до 90 минут.' },
  { icon: '💬', title: 'Закрытый чат', desc: 'Telegram-чат для обмена опытом. Куратор и владельцы помогают.' },
];

const FAQ = [
  { q: 'Могу ли отменить подписку в любой момент?', a: 'Да, отмена одной кнопкой. После отмены доступ сохраняется до конца оплаченного месяца.' },
  { q: 'Чек-листы — это файлы или интерактивные?', a: 'Интерактивные веб-приложения с галочками и фотофиксацией нарушений.' },
  { q: 'Что, если ремонт делаю не у РПКМ?', a: 'Без разницы. Чек-листы и консультации универсальные — подходят для любого подрядчика.' },
  { q: 'Это рабочая подписка или демо?', a: 'Демо-проект. Оплата фиктивная. Логика подписки и интерфейс — рабочие.' },
];

export default function ClubPage() {
  const navigate = useNavigate();
  const [subscribed, setSubscribed] = useState(false);
  const [openFaq, setOpenFaq] = useState(-1);
  const [notice, setNotice] = useState(null);

  const toggleFaq = useCallback((i) => { setOpenFaq(prev => prev === i ? -1 : i); }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  return (
    <PageLayout>
      <main>
        {/* Hero */}
        <section className="hero" style={{ padding: '60px 0 40px' }}>
          <div className="container">
            <div className="hero-grid">
              <div className="hero-content">
                <span className="section-label">Подписка для владельцев</span>
                <h1>Клуб владельцев РПКМ</h1>
                <p className="hero-lead">
                  Не теряйтесь после сдачи ремонта. Принимайте этапы по чек-листам, экономьте у партнёров,
                  получайте поддержку инженера в чате. Первые 14 дней — бесплатно, потом 490 ₽/мес.
                </p>
                <div className="hero-cta">
                  {subscribed ? (
                    <div style={{ display: 'inline-flex', gap: 10, alignItems: 'center', padding: '12px 18px', background: '#e6f5ec', color: '#16794a', borderRadius: 8, fontWeight: 600 }}>
                      ✓ Подписка активна (демо)
                    </div>
                  ) : (
                    <>
                      <Btn variant="terra" size="lg" onClick={() => setSubscribed(true)}>Попробовать 14 дней бесплатно</Btn>
                      <Btn variant="outline" size="lg" onClick={() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })}>Подробнее</Btn>
                    </>
                  )}
                </div>
                {!subscribed && <div style={{ fontSize: 13, color: C.gray500, marginTop: 10 }}>Без карты. После 14 дней — 490 ₽/мес или отмена в один клик.</div>}
                <div className="hero-stats" style={{ marginTop: 28 }}>
                  <div><div className="stat-num">14 дней</div><div className="stat-label">бесплатный триал · без карты</div></div>
                  <div><div className="stat-num">490 ₽</div><div className="stat-label">в месяц · отмена в один клик</div></div>
                  <div><div className="stat-num">5–15%</div><div className="stat-label">скидки у партнёров</div></div>
                </div>
              </div>
              <div className="hero-visual">
                <div className="hero-visual-title">Что внутри клуба</div>
                <ul className="benefit-list">
                  {BENEFITS.map((b, i) => <li key={i}><span className="benefit-check">✓</span><span>{b}</span></li>)}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section style={{ background: C.gray50 }}>
          <div className="container">
            <div className="section-head">
              <span className="section-label">Окупаемость</span>
              <h2>Подписка окупается с первой покупки</h2>
              <p>Скидки партнёров перекрывают годовую стоимость подписки.</p>
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

        {/* Member area */}
        {subscribed && (
          <section>
            <div className="container" style={{ maxWidth: 960 }}>
              <div className="section-head">
                <span className="section-label">Кабинет участника</span>
                <h2>Добро пожаловать в клуб</h2>
              </div>
              <div className="club-grid">
                <div className="club-card" style={{ borderLeft: `4px solid ${C.terra}`, background: `linear-gradient(180deg, ${C.terraBg} 0%, white 60%)` }}>
                  <h3>📋 Детальная смета</h3>
                  <p>Расчёт по тендерным ценам РПКМ — 50+ позиций с конкретными артикулами.</p>
                  <Btn variant="terra" style={{ marginTop: 8 }} onClick={() => navigate('/b2c-detail')}>Создать детальную смету →</Btn>
                </div>
                <div className="club-card">
                  <h3>Чек-листы приёмки</h3>
                  <p>Готовые шаблоны под каждый этап.</p>
                  <ul className="club-list">
                    <li>📐 Стяжка пола</li><li>🧱 Штукатурка стен</li><li>⚡ Электрика и розетки</li>
                    <li>🚿 Сантехника</li><li>🎨 Чистовая отделка</li><li>🚪 Установка дверей</li>
                  </ul>
                  <Btn variant="outline" onClick={() => setNotice('Чек-листы — в демо только превью')}>Открыть библиотеку →</Btn>
                </div>
                <div className="club-card">
                  <h3>Скидки партнёров</h3>
                  <p>Промокоды активируются автоматически.</p>
                  <ul className="club-list">
                    <li>🛁 Roca · промо RPKM-ROCA-10</li><li>💡 Lightstar · промо RPKM-LS-12</li>
                    <li>🪑 Mria Kitchens · промо RPKM-MRIA-7</li><li>🪟 Schüco · промо RPKM-SCHU-8</li>
                  </ul>
                  <div style={{ fontSize: 12, color: C.gray500, marginTop: 8 }}>Демо-промокоды.</div>
                </div>
                <div className="club-card">
                  <h3>Консультация инженера</h3>
                  <p>В этом месяце доступно: <strong>30 минут</strong>.</p>
                  <Btn variant="terra" onClick={() => setNotice('Запись к инженеру — в демо не реализовано')}>Записаться</Btn>
                </div>
                <div className="club-card">
                  <h3>Управление подпиской</h3>
                  <p style={{ color: C.gray500, fontSize: 14 }}>🎁 Бесплатный триал (демо). После триала: 490 ₽/мес</p>
                  <Btn variant="outline" style={{ marginTop: 12 }} onClick={() => { setSubscribed(false); }}>Отменить триал</Btn>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* FAQ */}
        <section id="faq" style={{ background: C.gray50 }}>
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
