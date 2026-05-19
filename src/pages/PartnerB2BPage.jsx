import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import Btn from '../components/Btn';
import { C } from '../lib/theme';
import { X } from 'lucide-react';

function formatRub(n) { return Math.round(n).toLocaleString('ru-RU') + ' ₽'; }

const FAQ = [
  { q: 'Можно ли совмещать с авторским надзором?', a: 'Да. Партнёр-дизайнер может вести надзор и получать бонус одновременно.' },
  { q: 'Есть ли потолок выплаты с одного объекта?', a: 'Да, 1 000 000 ₽ с одного договора.' },
  { q: 'Как работает 10% скидка на следующий проект?', a: 'Каждый подтверждённый реферал +10% скидки. Максимум 50%. Списывается при подписании вашего договора.' },
  { q: 'Как заказчик узнаёт, что вы рекомендуете РПКМ?', a: 'Никак — это ваше право. Мы платим за результат, а не за упоминание.' },
  { q: 'Что с конкурирующими партнёрами?', a: 'Бонус получает первый, кто привёл клиента (по первому захвату cookie).' },
];

function NdaModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.5)', padding: 24 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, maxWidth: 640, width: '100%', maxHeight: '80vh', overflow: 'auto', padding: 32, position: 'relative' }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <X size={20} color={C.gray400} />
        </button>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.graphite, marginBottom: 16 }}>Соглашение о неразглашении (NDA)</h2>
        <div style={{ fontSize: 14, color: C.gray600, lineHeight: 1.7 }}>
          <p><strong>1. Предмет соглашения</strong></p>
          <p>Стороны обязуются не разглашать конфиденциальную информацию, полученную в рамках партнёрской программы РПКМ, включая: условия вознаграждения, данные клиентов, внутренние процессы компании.</p>
          <p style={{ marginTop: 12 }}><strong>2. Обязательства сторон</strong></p>
          <p>Партнёр обязуется: не передавать третьим лицам информацию о клиентах РПКМ; не использовать полученную информацию в целях, не связанных с партнёрской программой; хранить все материалы в защищённом виде.</p>
          <p style={{ marginTop: 12 }}><strong>3. Срок действия</strong></p>
          <p>Соглашение действует в течение всего периода участия в партнёрской программе и 2 (два) года после её прекращения.</p>
          <p style={{ marginTop: 12 }}><strong>4. Ответственность</strong></p>
          <p>За нарушение условий настоящего соглашения виновная сторона несёт ответственность в соответствии с действующим законодательством РФ.</p>
        </div>
        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <Btn variant="dark" onClick={onClose}>Закрыть</Btn>
        </div>
      </div>
    </div>
  );
}

export default function PartnerB2BPage() {
  const [registered, setRegistered] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [agree, setAgree] = useState(false);
  const [openFaq, setOpenFaq] = useState(-1);
  const [ndaOpen, setNdaOpen] = useState(false);

  const register = useCallback(() => {
    if (!name || name.length < 2) { alert('Введите имя'); return; }
    if (!contact || contact.length < 5) { alert('Укажите контакт'); return; }
    if (!agree) { alert('Нужно согласие с условиями'); return; }
    setRegistered(true);
  }, [name, contact, agree]);

  const refCode = 'REF-B2B-' + Math.random().toString(36).slice(2, 7).toUpperCase();

  return (
    <PageLayout>
      <NdaModal open={ndaOpen} onClose={() => setNdaOpen(false)} />
      <main>
        {/* Pitch */}
        <section style={{ padding: '60px 0 32px', background: `linear-gradient(180deg, #eaf2fb 0%, ${C.white} 100%)` }}>
          <div className="container">
            <div className="hero-grid">
              <div className="hero-content">
                <span className="section-label">Партнёрская программа · B2B</span>
                <h1>1% от чека + 10% скидка на ваш следующий проект</h1>
                <p className="hero-lead">
                  Для дизайнеров, архитекторов и техзаказчиков. Если ваш клиент выберет РПКМ — выплатим 1% от суммы договора
                  (250–800 тыс ₽ на премиум-объектах) + накапливаем 10% скидки на ваш собственный проект.
                </p>
                <div className="hero-cta">
                  <a href="#join"><Btn variant="dark" size="lg">Стать партнёром</Btn></a>
                  <a href="#how"><Btn variant="outline" size="lg">Как это работает</Btn></a>
                </div>
                <div className="hero-stats">
                  <div><div className="stat-num">1%</div><div className="stat-label">от чека · до 1 млн ₽</div></div>
                  <div><div className="stat-num">10%</div><div className="stat-label">скидка на ваш проект</div></div>
                  <div style={{ cursor: 'pointer' }} onClick={() => setNdaOpen(true)}><div className="stat-num" style={{ textDecoration: 'underline', textDecorationStyle: 'dotted' }}>NDA</div><div className="stat-label">соглашение о неразглашении</div></div>
                </div>
              </div>
              <div className="hero-visual">
                <div className="hero-visual-title">Пример выплаты партнёру</div>
                <div className="price-card"><div><div className="price-card-label">Бизнес-объект 120 м²</div><div className="price-card-sub">Чек 14 400 000 ₽ · 1%</div></div><div className="price-card-value">144 000 ₽</div></div>
                <div className="price-card"><div><div className="price-card-label">Премиум 200 м²</div><div className="price-card-sub">Чек 80 000 000 ₽ · 1%</div></div><div className="price-card-value">800 000 ₽</div></div>
                <div className="price-card"><div><div className="price-card-label">Комфорт 80 м²</div><div className="price-card-sub">Чек 5 800 000 ₽ · 1%</div></div><div className="price-card-value">58 000 ₽</div></div>
              </div>
            </div>
          </div>
        </section>

        {/* How */}
        <section id="how">
          <div className="container">
            <div className="section-head">
              <span className="section-label">Сценарий</span>
              <h2>Как мы работаем с партнёрами</h2>
            </div>
            <div className="steps">
              <div className="step"><h3>Регистрация и NDA</h3><p>Получаете персональный код и личный кабинет. Подписываем NDA.</p></div>
              <div className="step"><h3>Презентация заказчику</h3><p>Используете PDF-смету РПКМ. Клиент переходит по реф-ссылке.</p></div>
              <div className="step"><h3>1% + 10% скидки</h3><p>Начисление при подписании договора. Выплата раз в месяц.</p></div>
            </div>
          </div>
        </section>

        {/* Join / Cabinet */}
        <section id="join" style={{ background: C.gray50 }}>
          <div className="container" style={{ maxWidth: 720 }}>
            {!registered ? (
              <div className="quiz-card" style={{ background: 'white' }}>
                <h2 style={{ marginBottom: 8 }}>Регистрация партнёра</h2>
                <p style={{ color: C.gray500, marginBottom: 24 }}>Подписываем NDA и выдаём реф-код. Минута.</p>
                <div className="form-field"><label>Имя / студия</label><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Анна Петрова · студия Form" /></div>
                <div className="form-field"><label>Контакт для связи</label><input type="text" value={contact} onChange={e => setContact(e.target.value)} placeholder="Email или Telegram" /></div>
                <label className="checkbox-row">
                  <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
                  <span>Согласен с условиями партнёрской программы и <a href="#" onClick={e => { e.preventDefault(); e.stopPropagation(); setNdaOpen(true); }} style={{ color: C.terra, textDecoration: 'underline', cursor: 'pointer' }}>NDA</a>.</span>
                </label>
                <Btn variant="dark" size="lg" style={{ width: '100%', marginTop: 12 }} onClick={register}>Получить реф-код</Btn>
              </div>
            ) : (
              <div className="quiz-card" style={{ background: 'white' }}>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, color: C.gray500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Партнёрский кабинет · B2B</div>
                  <h2 style={{ margin: '4px 0 0' }}>{name}</h2>
                  <div style={{ fontSize: 14, color: C.gray500 }}>Промокод: <strong>{refCode}</strong> · ставка 1% · кап {formatRub(1000000)}/объект</div>
                </div>
                <div className="ref-link-box">
                  <div style={{ fontSize: 13, color: C.gray500, marginBottom: 6 }}>Ваша реферальная ссылка</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                    <input type="text" readOnly value={`${window.location.origin}/?ref=${refCode}`} style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: `1px solid ${C.gray200}` }} />
                    <Btn variant="dark" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/?ref=${refCode}`); alert('Скопировано!'); }}>Скопировать</Btn>
                  </div>
                </div>
                <div className="ref-stats" style={{ marginTop: 20 }}>
                  <div className="ref-stat"><div className="ref-stat-label">Лиды</div><div className="ref-stat-value">0</div></div>
                  <div className="ref-stat"><div className="ref-stat-label">Начислено</div><div className="ref-stat-value">0 ₽</div></div>
                  <div className="ref-stat"><div className="ref-stat-label">К выплате</div><div className="ref-stat-value">0 ₽</div></div>
                  <div className="ref-stat"><div className="ref-stat-label">Скидка на ваш проект</div><div className="ref-stat-value">0%</div></div>
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
