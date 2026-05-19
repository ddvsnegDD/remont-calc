import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import Btn from '../components/Btn';
import { C } from '../lib/theme';

function formatRub(n) { return Math.round(n).toLocaleString('ru-RU') + ' ₽'; }

const FAQ = [
  { q: 'Когда выплачиваются бонусы?', a: 'После подписания договора. Выплата раз в месяц с 1-го по 5-е число на карту.' },
  { q: 'Что даёт статус «Амбассадор»?', a: 'После 3-го реферала ставка повышается с 5 000 до 7 000 ₽. Статус бессрочный.' },
  { q: 'Что если клиент откажется от договора?', a: 'Бонус не выплачивается. Мы платим только за реальные сделки.' },
  { q: 'Сколько действует реф-ссылка?', a: '30 дней с момента первого перехода клиента.' },
  { q: 'Как отслеживать свои начисления?', a: 'После регистрации вы получите доступ в партнёрский кабинет, где отображаются все заявки, начисления и статус выплат.' },
];

export default function PartnerB2CPage() {
  const [registered, setRegistered] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [openFaq, setOpenFaq] = useState(-1);

  const register = useCallback(() => {
    if (!name || name.length < 2) { alert('Введите имя'); return; }
    if (!contact || contact.length < 5) { alert('Укажите контакт'); return; }
    setRegistered(true);
  }, [name, contact]);

  const refCode = 'REF-' + Math.random().toString(36).slice(2, 7).toUpperCase();

  return (
    <PageLayout>
      <main>
        {/* Pitch */}
        <section className="hero" style={{ padding: '60px 0 32px' }}>
          <div className="container">
            <div className="hero-grid">
              <div className="hero-content">
                <span className="section-label">Партнёрская программа · B2C</span>
                <h1>Рекомендуйте РПКМ — получайте 5 000 ₽ за реферала</h1>
                <p className="hero-lead">
                  Поделитесь реф-ссылкой. Когда реферал запишется на замер и подпишет договор — вы получите 5 000 ₽.
                  С 3-го реферала статус «Амбассадор» и ставка 7 000 ₽.
                </p>
                <div className="hero-cta">
                  <a href="#join"><Btn variant="terra" size="lg">Получить реф-ссылку</Btn></a>
                  <a href="#how"><Btn variant="outline" size="lg">Как это работает</Btn></a>
                </div>
                <div className="hero-stats">
                  <div><div className="stat-num">5 000 ₽</div><div className="stat-label">за каждого реферала</div></div>
                  <div><div className="stat-num">7 000 ₽</div><div className="stat-label">после 3-го · «Амбассадор»</div></div>
                  <div><div className="stat-num">30 дней</div><div className="stat-label">срок «жизни» ссылки</div></div>
                </div>
              </div>
              <div className="hero-visual">
                <div className="hero-visual-title">Шкала вознаграждений</div>
                <div className="price-card"><div><div className="price-card-label">1-й реферал</div><div className="price-card-sub">Standard · подписан договор</div></div><div className="price-card-value">5 000 ₽</div></div>
                <div className="price-card"><div><div className="price-card-label">2-й реферал</div><div className="price-card-sub">Standard · подписан договор</div></div><div className="price-card-value">5 000 ₽</div></div>
                <div className="price-card" style={{ borderLeftColor: '#16794a' }}><div><div className="price-card-label">3-й и далее</div><div className="price-card-sub">Статус «Амбассадор» 🏆</div></div><div className="price-card-value" style={{ color: '#16794a' }}>7 000 ₽</div></div>
              </div>
            </div>
          </div>
        </section>

        {/* How */}
        <section id="how">
          <div className="container">
            <div className="section-head">
              <span className="section-label">Как это работает</span>
              <h2>Три шага до первой выплаты</h2>
            </div>
            <div className="steps">
              <div className="step"><h3>Получите ссылку</h3><p>Оставьте имя и контакт — сгенерируем уникальный реф-код.</p></div>
              <div className="step"><h3>Поделитесь с друзьями</h3><p>Отправьте ссылку в мессенджере. Клиент закрепляется за вами на 30 дней.</p></div>
              <div className="step"><h3>Получите 5 000 ₽</h3><p>Реферал подписал договор — начисление. С 3-го реферала — 7 000 ₽.</p></div>
            </div>
          </div>
        </section>

        {/* Join / Cabinet */}
        <section id="join" style={{ background: C.gray50 }}>
          <div className="container" style={{ maxWidth: 720 }}>
            {!registered ? (
              <div className="quiz-card" style={{ background: 'white' }}>
                <h2 style={{ marginBottom: 8 }}>Получите реф-ссылку</h2>
                <p style={{ color: C.gray500, marginBottom: 24 }}>Уйдёт меньше минуты.</p>
                <div className="form-field"><label>Как вас зовут</label><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Имя" /></div>
                <div className="form-field"><label>Телефон или email</label><input type="text" value={contact} onChange={e => setContact(e.target.value)} placeholder="+7 (...) или email" /></div>
                <Btn variant="terra" size="lg" style={{ width: '100%', marginTop: 8 }} onClick={register}>Получить ссылку</Btn>
                <p style={{ fontSize: 12, color: C.gray500, marginTop: 14, textAlign: 'center' }}>
                  Нажимая кнопку, вы соглашаетесь с условиями программы.
                </p>
              </div>
            ) : (
              <div className="quiz-card" style={{ background: 'white' }}>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, color: C.gray500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Партнёрский кабинет</div>
                  <h2 style={{ margin: '4px 0 0' }}>Привет, {name}</h2>
                  <div style={{ fontSize: 14, color: C.gray500 }}>Код: <strong style={{ color: C.terra }}>{refCode}</strong> · текущая ставка <strong>5 000 ₽</strong>/реферал</div>
                  <div style={{ fontSize: 13, color: C.terra, marginTop: 4 }}>Ещё 3 подтверждённых реферала — и вы Амбассадор (7 000 ₽)</div>
                </div>
                <div className="ref-link-box">
                  <div style={{ fontSize: 13, color: C.gray500, marginBottom: 6 }}>Ваша реферальная ссылка</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                    <input type="text" readOnly value={`${window.location.origin}/b2c?ref=${refCode}`} style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: `1px solid ${C.gray200}` }} />
                    <Btn variant="terra" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/b2c?ref=${refCode}`); alert('Скопировано!'); }}>Скопировать</Btn>
                  </div>
                </div>
                <div className="ref-stats" style={{ marginTop: 20 }}>
                  <div className="ref-stat"><div className="ref-stat-label">Заявки</div><div className="ref-stat-value">0</div></div>
                  <div className="ref-stat"><div className="ref-stat-label">Начислено</div><div className="ref-stat-value">0 ₽</div></div>
                  <div className="ref-stat"><div className="ref-stat-label">Подтверждено</div><div className="ref-stat-value">0 ₽</div></div>
                </div>
                <div style={{ padding: 28, textAlign: 'center', color: C.gray500, background: C.gray50, borderRadius: 8, marginTop: 20 }}>
                  Пока нет начислений. Поделитесь ссылкой — и они появятся здесь.
                </div>
              </div>
            )}
          </div>
        </section>

        {/* FAQ */}
        <section>
          <div className="container" style={{ maxWidth: 800 }}>
            <div className="section-head">
              <span className="section-label">Вопросы</span>
              <h2>Часто спрашивают</h2>
            </div>
            <div className="faq-list">
              {FAQ.map((f, i) => (
                <div key={i} className={`faq-item${openFaq === i ? ' open' : ''}`}>
                  <div className="faq-q" onClick={() => setOpenFaq(prev => prev === i ? -1 : i)}>{f.q}</div>
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
