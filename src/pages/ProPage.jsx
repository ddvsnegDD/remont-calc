import { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import Btn from '../components/Btn';
import { C } from '../lib/theme';

const BENEFITS = [
  'Безлимит расчётов',
  'White-label PDF (логотип, реквизиты)',
  'Офисный fit-out калькулятор (25+ статей)',
  'Персональный менеджер',
  'Приоритетная поддержка (24 ч SLA)',
  'Экспорт CSV / Excel',
  'Чек-лист для заёмщика',
];

const FAQ = [
  { q: 'Как работает white-label PDF?', a: 'В настройках профиля загружаете логотип и реквизиты. Все PDF формируются с вашим брендом.' },
  { q: 'Есть ли скидка при годовой оплате?', a: 'Да, 12 месяцев = 29 000 ₽ (экономия 17%).' },
  { q: 'Что входит в чек-лист для заёмщика?', a: 'Список документов и шагов для получения ипотеки на ремонт. Готовится к публикации.' },
  { q: 'Можно ли совмещать PRO с партнёрской программой?', a: 'Да. PRO даёт инструменты, партнёрка — выплаты. Они независимы.' },
];

export default function ProPage() {
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
        <section style={{ padding: '60px 0 40px', background: `linear-gradient(180deg, #eaf2fb 0%, ${C.white} 100%)` }}>
          <div className="container">
            <div className="hero-grid">
              <div className="hero-content">
                <span className="section-label">Подписка PRO</span>
                <h1>PRO-кабинет для дизайнеров и техзаказчиков</h1>
                <p className="hero-lead">
                  Безлимитные расчёты, white-label PDF, экспорт в CSV, приоритетная поддержка. Всё за 2 900 ₽/мес.
                </p>
                <div className="hero-cta">
                  {subscribed ? (
                    <div style={{ display: 'inline-flex', gap: 10, alignItems: 'center', padding: '12px 18px', background: '#e6f5ec', color: '#16794a', borderRadius: 8, fontWeight: 600 }}>
                      ✓ PRO активен (демо)
                    </div>
                  ) : (
                    <Btn variant="dark" size="lg" onClick={() => setSubscribed(true)}>Оформить PRO за 2 900 ₽/мес</Btn>
                  )}
                </div>
                <div className="hero-stats" style={{ marginTop: 28 }}>
                  <div><div className="stat-num">2 900 ₽</div><div className="stat-label">в месяц · отмена в один клик</div></div>
                  <div><div className="stat-num">∞</div><div className="stat-label">расчётов в месяц</div></div>
                  <div><div className="stat-num">24 часа</div><div className="stat-label">SLA на ответ инженера</div></div>
                </div>
              </div>
              <div className="hero-visual">
                <div className="hero-visual-title">Что включено</div>
                <ul className="benefit-list">
                  {BENEFITS.map((b, i) => (
                    <li key={i}><span className="benefit-check" style={{ background: '#e8eef7' }}>✓</span><span>{b}</span></li>
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
                  <li>1 расчёт в месяц</li>
                  <li>Стандартные PDF-сметы</li>
                  <li>История расчётов</li>
                  <li className="off" style={{ textDecoration: 'line-through' }}>White-label PDF</li>
                  <li className="off" style={{ textDecoration: 'line-through' }}>Персональный менеджер</li>
                  <li className="off" style={{ textDecoration: 'line-through' }}>Приоритетная поддержка</li>
                  <li className="off" style={{ textDecoration: 'line-through' }}>Экспорт в CSV / Excel</li>
                </ul>
              </div>
              <div className="compare-col compare-featured">
                <div className="compare-name">PRO</div>
                <div className="compare-price">2 900 ₽<span style={{ fontSize: 14, color: C.gray500, fontWeight: 500 }}>/мес</span></div>
                <ul>
                  <li>Безлимит расчётов</li>
                  <li>White-label PDF (логотип, реквизиты)</li>
                  <li>Персональный менеджер</li>
                  <li>Приоритетная поддержка (24 ч SLA)</li>
                  <li>Экспорт в CSV / Excel</li>
                  <li>Чек-лист для заёмщика</li>
                </ul>
                <Btn variant="dark" size="lg" style={{ width: '100%', marginTop: 16 }}
                  onClick={() => subscribed ? null : setSubscribed(true)}
                  disabled={subscribed}>
                  {subscribed ? '✓ PRO уже активен' : 'Перейти на PRO'}
                </Btn>
              </div>
            </div>
          </div>
        </section>

        {/* Member area */}
        {subscribed && (
          <section>
            <div className="container" style={{ maxWidth: 960 }}>
              <div className="section-head">
                <span className="section-label">PRO-кабинет</span>
                <h2>Управление подпиской</h2>
              </div>
              <div className="club-grid">
                <div className="club-card">
                  <h3>White-label PDF</h3>
                  <p>Загрузите логотип — все PDF будут с вашим брендом.</p>
                  <Btn variant="outline" onClick={() => setNotice('White-label PDF — в демо не реализовано')}>Настроить →</Btn>
                </div>
                <div className="club-card">
                  <h3>Персональный менеджер</h3>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, background: C.gray50, borderRadius: 8, margin: '8px 0 12px' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: `linear-gradient(135deg, ${C.graphite}, ${C.gray600})`, color: 'white', display: 'grid', placeItems: 'center', fontWeight: 700 }}>АВ</div>
                    <div>
                      <div style={{ fontWeight: 600 }}>Анна Воронцова</div>
                      <div style={{ fontSize: 13, color: C.gray500 }}>Старший инженер пресейла · 8 лет</div>
                    </div>
                  </div>
                  <Btn variant="outline" onClick={() => setNotice('Чат с менеджером — в демо не реализовано')}>Написать →</Btn>
                </div>
                <div className="club-card">
                  <h3>Экспорт в CSV</h3>
                  <p>Скачайте историю расчётов одним файлом.</p>
                  <Btn variant="outline" onClick={() => setNotice('Экспорт CSV — в демо не реализовано')}>Скачать CSV →</Btn>
                </div>
                <div className="club-card">
                  <h3>Управление подпиской</h3>
                  <p style={{ color: C.gray500, fontSize: 14 }}>PRO активен (демо). Стоимость: 2 900 ₽/мес</p>
                  <Btn variant="outline" style={{ marginTop: 12 }} onClick={() => setSubscribed(false)}>Отменить подписку</Btn>
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
