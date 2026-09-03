import { useState, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import PageLayout from '../components/Layout';
import Btn from '../components/Btn';
import { C } from '../lib/theme';
import { SpecCalc } from '../lib/spec-calculator';
import { calculateB2C } from '../lib/calculator';

const STEPS = [
  { id:'apartment_type', title:'Какой тип квартиры?', hint:'От этого зависит набор работ.', type:'cards',
    options:[{value:'novostroyka',title:'Новостройка',sub:'Только получили ключи'},{value:'vtorichka',title:'Вторичка',sub:'Жилая или после прежних хозяев'}] },
  { id:'house_type', title:'Тип дома?', hint:'Конструктив влияет на сложность перепланировок.', type:'cards',
    optionsFor: a => a.apartment_type === 'novostroyka' ? [
      {value:'nov_monolith',title:'Монолит',sub:'Современный ЖК · бизнес/премиум'},
      {value:'nov_monolith_brick',title:'Монолитно-кирпичные',sub:'Клубные дома · комфорт+'},
      {value:'nov_panel_new',title:'Панель (новая серия)',sub:'ПИК / реновация'},
      {value:'nov_brick',title:'Кирпичные/блоки',sub:'Малоэтажный премиум'},
    ] : [
      {value:'vtor_panel',title:'Панель',sub:'П-44, КОПЭ, И-155'},
      {value:'vtor_stalinka',title:'Сталинка',sub:'Высокие потолки, толстые стены'},
      {value:'vtor_monolith',title:'Монолит',sub:'Свободная планировка'},
      {value:'vtor_brick_old',title:'Кирпич старой постройки',sub:'Дореволюционный или советский'},
    ] },
  { id:'finish_type', title:'Что у вас по отделке от застройщика?', hint:'White Box экономит ~50%.', type:'cards',
    visible: a => a.apartment_type === 'novostroyka',
    options:[{value:'no_finish',title:'Без отделки',sub:'Голые стены'},{value:'whitebox',title:'White Box',sub:'Предчистовая · экономия ~50%'}] },
  { id:'area', title:'Площадь квартиры', hint:'Введите общую площадь в м².', type:'area', min:20, max:250, defaultValue:60 },
  { id:'replan', title:'Нужна ли перепланировка?', type:'options',
    options:[{value:'no',label:'Нет',emoji:'🚫'},{value:'light',label:'Лёгкая (без затрагивания несущих)',emoji:'✏️'},{value:'full',label:'Полная (со согласованием в МЖИ)',emoji:'🏗️'}] },
  { id:'comms', title:'Замена коммуникаций?', type:'options',
    options:[{value:'none',label:'Не нужна',emoji:'✅'},{value:'partial',label:'Частичная',emoji:'🔧'},{value:'full',label:'Полная — электрика + сантехника',emoji:'⚡'},{value:'full_plus',label:'Полная + отопление / вентиляция',emoji:'🔥'}] },
  { id:'design', title:'Есть ли дизайн-проект?', type:'options',
    options:[{value:'yes',label:'Да, готовый проект на руках',emoji:'📐'},{value:'no',label:'Нет, посчитайте без него',emoji:'🤷'},{value:'need',label:'Нет, но планирую заказать',emoji:'✨'}] },
  { id:'timing', title:'Когда хотите начать?', type:'options',
    options:[{value:'asap',label:'Срочно — в течение месяца',emoji:'🚀'},{value:'months_3',label:'Через 1–3 месяца',emoji:'📅'},{value:'flexible',label:'Не срочно',emoji:'⏳'}] },
  { id:'contact', title:'Куда отправить расчёт?', hint:'Пришлём расчёт на почту и сохраним его в личном кабинете.', type:'contact' },
];

export default function B2CQuizPage() {
  const [showMode, setShowMode] = useState(true);
  const [calcMode, setCalcMode] = useState('quick'); // 'quick' | 'detail'
  const [step, setStep] = useState(0);
  const [searchParams] = useSearchParams();
  const tierFromUrl = searchParams.get('tier');
  const validTiers = ['cosmetic', 'capital', 'euro', 'premium'];
  const initialTier = validTiers.includes(tierFromUrl) ? tierFromUrl : 'capital';
  const [answers, setAnswers] = useState({ area: 60, repair_type: initialTier });
  const [contactData, setContactData] = useState({ name: '', phone: '', extra: '', agree: false });
  const [formError, setFormError] = useState('');
  const navigate = useNavigate();

  const visibleSteps = STEPS.filter(s => !s.visible || s.visible(answers));
  const current = visibleSteps[step];
  const total = visibleSteps.length;
  const progress = (step / total) * 100;

  const setAnswer = (key, val) => setAnswers(prev => ({ ...prev, [key]: val }));

  const next = useCallback(() => {
    if (step < total - 1) { setFormError(''); setStep(step + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else {
      // Валидация контактных данных
      if (!contactData.name || contactData.name.trim().length < 2) { setFormError('Введите имя (минимум 2 символа)'); return; }
      const cleanPhone = contactData.phone.replace(/[^\d+]/g, '');
      if (!/^\+7\d{10}$/.test(cleanPhone)) { setFormError('Введите телефон в формате +7XXXXXXXXXX'); return; }
      if (contactData.extra && contactData.extra.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactData.extra.trim())) { setFormError('Введите корректный email'); return; }
      if (!contactData.agree) { setFormError('Необходимо согласие на обработку данных'); return; }
      setFormError('');

      if (calcMode === 'quick') {
        // Быстрый расчёт — вилка стоимости (от-до)
        const result = calculateB2C(answers);
        const lead = {
          id: 'b2c-' + Date.now(), timestamp: new Date().toISOString(), kind: 'b2c',
          result,
          contact: { name: contactData.name, phone: contactData.phone, email: contactData.extra },
        };
        sessionStorage.setItem('rpkm-last-b2c', JSON.stringify(lead));
        navigate('/b2c-result');
      } else {
        // Детальная смета — SpecCalc ~50 позиций
        const quizArea = parseFloat(answers.area) || 60;
        const tierMap = { cosmetic: 'capital', capital: 'capital', euro: 'euro', premium: 'premium' };
        const quizTier = tierMap[answers.repair_type] || 'capital';
        const quizMode = (quizTier === 'premium') ? 'full' : (answers.finish_type === 'whitebox' ? 'whitebox' : 'full');
        const quizReplan = answers.replan || 'no';
        const quizRooms = quizArea < 35 ? 1 : quizArea < 55 ? 2 : quizArea < 80 ? 3 : quizArea < 120 ? 4 : 5;
        const quizSanitary = quizArea < 60 ? 1 : quizArea < 120 ? 2 : 3;
        const quizWindows = quizArea < 35 ? 2 : quizArea < 55 ? 3 : quizArea < 80 ? 4 : quizArea < 120 ? 6 : 8;
        const specResult = SpecCalc.compute({ area: quizArea, rooms: quizRooms, sanitary: quizSanitary, windows: quizWindows, mode: quizMode, tier: quizTier, replan: quizReplan });
        const lead = {
          id: 'b2c-detail-' + Date.now(), timestamp: new Date().toISOString(), kind: 'b2c-detail',
          result: specResult,
          contact: { name: contactData.name, phone: contactData.phone, email: contactData.extra },
        };
        sessionStorage.setItem('rpkm-last-b2c-detail', JSON.stringify(lead));
        navigate('/b2c-result-detail');
      }
    }
  }, [step, total, answers, contactData, calcMode, navigate]);

  const handleCardClick = (id, value) => {
    setAnswer(id, value);
    if (id === 'design' && value === 'yes') { navigate('/b2c-detail?source=has-project'); return; }
    setTimeout(() => { if (step < total - 1) setStep(step + 1); }, 150);
  };

  if (showMode) {
    return (
      <PageLayout>
        <div style={{ padding: "100px 0 60px", background: C.offWhite, minHeight: "100vh" }}>
          <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px" }}>
            <div style={{ background: "#fff", borderRadius: 20, padding: "32px 28px", boxShadow: "0 8px 32px rgba(0,0,0,0.06)" }}>
              <h2 className="font-golos" style={{ textAlign: "center", fontSize: 24, fontWeight: 800, color: C.graphiteLight, marginBottom: 8 }}>Какой расчёт вам нужен?</h2>
              <p style={{ textAlign: "center", color: C.gray500, marginBottom: 24 }}>Два варианта — простой по среднерыночным ценам и детальный по тендерным сметам.</p>
              <div className="mode-choice-grid">
                <div style={{ border: `1.5px solid ${C.gray200}`, borderRadius: 16, padding: 24, cursor: "pointer", transition: "all 0.3s", textAlign: "center" }}
                  onClick={() => setShowMode(false)}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.terra; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.gray200; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
                  <h3 className="font-golos" style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Быстрый расчёт</h3>
                  <p style={{ fontSize: 14, color: C.gray500, marginBottom: 16 }}>Вилка стоимости (от-до) за 2 минуты</p>
                  <Btn variant="terra" style={{ width: "100%" }}>Начать бесплатный расчёт</Btn>
                </div>
                <div style={{ border: `1.5px solid ${C.terra}`, borderRadius: 16, padding: 24, cursor: "pointer", transition: "all 0.3s", textAlign: "center", background: C.terraBg }}
                  onClick={() => navigate('/b2c-detail')}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
                  <h3 className="font-golos" style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Детальная смета</h3>
                  <p style={{ fontSize: 14, color: C.gray500, marginBottom: 16 }}>Точный расчёт по тендерным ценам РПКМ</p>
                  <Btn variant="dark" style={{ width: "100%" }}>Перейти к детальному расчёту</Btn>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  const stepOptions = current?.optionsFor ? current.optionsFor(answers) : current?.options;

  return (
    <PageLayout>
      <div style={{ padding: "100px 0 60px", background: C.offWhite, minHeight: "100vh" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.gray500, marginBottom: 8 }}>
            <span>Шаг {step + 1} из {total}</span><span>~3 минуты</span>
          </div>
          <div style={{ height: 4, background: C.gray200, borderRadius: 2, marginBottom: 24 }}>
            <div style={{ height: "100%", background: C.terra, borderRadius: 2, width: `${progress}%`, transition: "width 0.4s ease" }} />
          </div>
          <div style={{ background: "#fff", borderRadius: 20, padding: "28px 24px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)", animation: "fadeInUp 0.4s ease" }}>
            <h2 className="font-golos" style={{ fontSize: 22, fontWeight: 700, color: C.graphiteLight, marginBottom: 6 }}>{current.title}</h2>
            {current.hint && <p style={{ fontSize: 14, color: C.gray500, marginBottom: 20, lineHeight: 1.5 }}>{current.hint}</p>}

            {(current.type === 'cards') && (
              <div style={{ display: "grid", gridTemplateColumns: stepOptions.length <= 2 ? "1fr 1fr" : "1fr 1fr", gap: 12 }}>
                {stepOptions.map(o => (
                  <button key={o.value} onClick={() => handleCardClick(current.id, o.value)}
                    style={{ padding: "16px 14px", border: answers[current.id] === o.value ? `2px solid ${C.terra}` : `1.5px solid ${C.gray200}`, borderRadius: 14, background: answers[current.id] === o.value ? C.terraBg : "#fff", cursor: "pointer", textAlign: "left", transition: "all 0.25s" }}
                    onMouseEnter={e => { if (answers[current.id] !== o.value) e.currentTarget.style.borderColor = C.terraLight; }}
                    onMouseLeave={e => { if (answers[current.id] !== o.value) e.currentTarget.style.borderColor = C.gray200; }}
                  >
                    <div className="font-golos" style={{ fontSize: 16, fontWeight: 600, color: C.graphiteLight, marginBottom: 4 }}>{o.title}</div>
                    <div style={{ fontSize: 13, color: C.gray500 }}>{o.sub}</div>
                  </button>
                ))}
              </div>
            )}

            {(current.type === 'options') && (
              <div style={{ display: "grid", gap: 10 }}>
                {stepOptions.map(o => (
                  <button key={o.value} onClick={() => handleCardClick(current.id, o.value)}
                    style={{ padding: "14px 16px", border: answers[current.id] === o.value ? `2px solid ${C.terra}` : `1.5px solid ${C.gray200}`, borderRadius: 12, background: answers[current.id] === o.value ? C.terraBg : "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left", transition: "all 0.25s", fontSize: 15, color: C.graphiteLight, fontFamily: "'Inter', sans-serif" }}
                  >
                    <span style={{ fontSize: 20 }}>{o.emoji}</span>
                    <span>{o.label}</span>
                  </button>
                ))}
              </div>
            )}

            {current.type === 'area' && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <input type="number" value={answers.area || current.defaultValue} onChange={e => setAnswer('area', Math.max(current.min, Math.min(current.max, +e.target.value || current.defaultValue)))}
                    style={{ flex: 1, padding: "14px 16px", border: `1.5px solid ${C.gray200}`, borderRadius: 10, fontSize: 18, fontWeight: 600, color: C.graphiteLight, outline: "none", fontFamily: "'Inter', sans-serif" }} />
                  <span style={{ fontSize: 16, color: C.gray500, fontWeight: 500 }}>м²</span>
                </div>
                <input type="range" min={current.min} max={current.max} value={answers.area || current.defaultValue} onChange={e => setAnswer('area', +e.target.value)} style={{ width: "100%" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.gray500, marginTop: 6 }}>
                  <span>{current.min} м²</span><span>{current.max} м²</span>
                </div>
              </div>
            )}

            {current.type === 'contact' && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: C.gray600, marginBottom: 6 }}>Как вас зовут?</label>
                  <input type="text" value={contactData.name} onChange={e => setContactData(p => ({ ...p, name: e.target.value }))} placeholder="Имя"
                    style={{ width: "100%", padding: "12px 14px", border: `1.5px solid ${C.gray200}`, borderRadius: 10, fontSize: 15, outline: "none", fontFamily: "'Inter', sans-serif" }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: C.gray600, marginBottom: 6 }}>Телефон</label>
                  <input type="tel" value={contactData.phone} onChange={e => setContactData(p => ({ ...p, phone: e.target.value }))} placeholder="+7 (___) ___-__-__"
                    style={{ width: "100%", padding: "12px 14px", border: `1.5px solid ${C.gray200}`, borderRadius: 10, fontSize: 15, outline: "none", fontFamily: "'Inter', sans-serif" }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: C.gray600, marginBottom: 6 }}>Telegram или email (опционально)</label>
                  <input type="text" value={contactData.extra} onChange={e => setContactData(p => ({ ...p, extra: e.target.value }))} placeholder="@username или email"
                    style={{ width: "100%", padding: "12px 14px", border: `1.5px solid ${C.gray200}`, borderRadius: 10, fontSize: 15, outline: "none", fontFamily: "'Inter', sans-serif" }} />
                </div>
                <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                  <input type="checkbox" checked={contactData.agree} onChange={e => setContactData(p => ({ ...p, agree: e.target.checked }))} style={{ marginTop: 3 }} />
                  <span style={{ fontSize: 13, color: C.gray500 }}>Даю согласие на обработку персональных данных в соответствии с <a href="/privacy" target="_blank" style={{ color: C.terra }}>Политикой конфиденциальности</a> (152-ФЗ).</span>
                </label>
                {formError && <div style={{ color: '#c53030', fontSize: 14, marginTop: 12, padding: '10px 14px', background: '#fff5f5', borderRadius: 8, border: '1px solid #feb2b2' }}>{formError}</div>}
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
            <Btn variant="outline" style={{ visibility: step === 0 ? "hidden" : "visible" }} onClick={() => setStep(Math.max(0, step - 1))}>← Назад</Btn>
            {(current.type === 'area' || current.type === 'contact') && (
              <Btn variant="terra" onClick={next}>{step === total - 1 ? 'Получить расчёт' : 'Далее'}</Btn>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
