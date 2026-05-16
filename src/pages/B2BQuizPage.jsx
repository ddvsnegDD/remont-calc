import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import Btn from '../components/Btn';
import { C } from '../lib/theme';
import { calculateB2B } from '../lib/calculator';

const STEPS = [
  { id: 'project_name', title: 'Название проекта', hint: 'Для удобства поиска в истории расчётов.', type: 'text', placeholder: 'Внутреннее название проекта' },
  { id: 'house_type', title: 'Тип здания', hint: 'Конструктив влияет на сложность работ.', type: 'cards',
    options: [
      { value: 'novostroyka_monolith', title: 'Новостройка монолит', sub: 'Свободная планировка' },
      { value: 'vtorichka_monolith', title: 'Вторичка монолит', sub: '90-2000-е, бизнес-класс' },
      { value: 'stalinka', title: 'Сталинка', sub: 'Высокие потолки, толстые стены' },
      { value: 'historic', title: 'Историч. реконструкция', sub: 'Особняк, охранная зона' },
    ] },
  { id: 'area', title: 'Площадь по полу (м²)', hint: 'Общая площадь объекта.', type: 'area', min: 50, max: 800, defaultValue: 150 },
  { id: 'rooms', title: 'Количество комнат', hint: 'Жилые + кухня-гостиная.', type: 'number', defaultValue: 3, min: 1, max: 12 },
  { id: 'bathrooms', title: 'Количество санузлов', hint: 'Включая мокрые зоны.', type: 'number', defaultValue: 2, min: 1, max: 8 },
  { id: 'windows', title: 'Количество окон', hint: 'Влияет на стоимость замены оконных блоков.', type: 'number', defaultValue: 4, min: 0, max: 30 },
  { id: 'floor_level', title: 'Этаж объекта', hint: 'Логистика материалов.', type: 'cards',
    options: [
      { value: 'low', title: '1–5 этаж', sub: 'Стандартная логистика' },
      { value: 'mid', title: '6–15 этаж', sub: 'Средняя сложность' },
      { value: 'high', title: '16–25 этаж', sub: 'Повышенная сложность' },
      { value: 'top', title: '25+ / пентхаус', sub: 'Спец. логистика, краны' },
    ] },
  { id: 'wall_finish', title: 'Тип отделки стен', hint: 'Доминирующий материал по площади.', type: 'cards',
    options: [
      { value: 'paint', title: 'Краска', sub: 'Декоративная или матовая' },
      { value: 'wallpaper', title: 'Обои', sub: 'Винил, флизелин, текстиль' },
      { value: 'decor_plaster', title: 'Декор. штукатурка', sub: 'Венецианка, травертин' },
      { value: 'panels', title: 'Панели', sub: 'МДФ, буазери' },
      { value: 'veneer', title: 'Шпон', sub: 'Стеновые панели из ценной породы' },
      { value: 'stone', title: 'Натуральный камень', sub: 'Мрамор, оникс' },
    ] },
  { id: 'ceiling_finish', title: 'Тип отделки потолков', type: 'cards',
    options: [
      { value: 'stretch', title: 'Натяжной', sub: 'Матовый или сатин' },
      { value: 'drywall', title: 'ГКЛ одноуровневый', sub: 'Базовое решение' },
      { value: 'drywall_multi', title: 'ГКЛ многоуровневый', sub: 'С нишами и подсветкой' },
      { value: 'plaster', title: 'Штукатурка', sub: 'Гладкая, под покраску' },
      { value: 'molding', title: 'Лепнина / молдинги', sub: 'Карнизы, кессоны' },
    ] },
  { id: 'floor_finish', title: 'Тип отделки полов', hint: 'Доминирующий материал.', type: 'cards',
    options: [
      { value: 'laminate', title: 'Ламинат', sub: 'Бытовой / коммерч.' },
      { value: 'parquet_eng', title: 'Паркет инженерный', sub: 'Многослойный' },
      { value: 'parquet_solid', title: 'Паркет массив', sub: 'Дуб, орех, ясень' },
      { value: 'porcelain', title: 'Керамогранит', sub: 'Под камень / дерево' },
      { value: 'marble', title: 'Мрамор / нат. камень', sub: 'Calacatta, Statuario' },
    ] },
  { id: 'engineering', title: 'Сложность инженерных систем', hint: 'Smart home — управление из одного интерфейса.', type: 'options',
    options: [
      { value: 'standard', label: 'Стандарт — обычная разводка', emoji: '🔌' },
      { value: 'smart_home', label: 'Smart home — KNX / Lutron', emoji: '📱' },
      { value: 'climate', label: 'Climate control + smart', emoji: '❄️' },
      { value: 'special', label: 'Спец. системы (кинотеатр, винотека)', emoji: '🎬' },
    ] },
  { id: 'supervision', title: 'Авторский надзор дизайнера', hint: 'Кто будет вести надзор.', type: 'options',
    options: [
      { value: 'included', label: 'Входит — дизайнер сам ведёт', emoji: '👨‍🎨' },
      { value: 'separate', label: 'Нужен отдельно от подрядчика', emoji: '➕' },
      { value: 'none', label: 'Не требуется', emoji: '🚫' },
    ] },
  { id: 'timing', title: 'Сроки начала работ', hint: 'Желаемая дата старта.', type: 'options',
    options: [
      { value: 'asap', label: 'Срочно — в течение месяца', emoji: '🚀' },
      { value: 'months_3', label: 'Через 1–3 месяца', emoji: '📅' },
      { value: 'flexible', label: 'Не определены / на этапе проекта', emoji: '⏳' },
    ] },
];

export default function B2BQuizPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ area: 150, rooms: 3, bathrooms: 2, windows: 4 });

  const current = STEPS[step];
  const total = STEPS.length;
  const progress = (step / total) * 100;

  const setAnswer = useCallback((key, val) => {
    setAnswers(prev => ({ ...prev, [key]: val }));
  }, []);

  const validate = useCallback(() => {
    const v = answers[current.id];
    if (current.type === 'options' || current.type === 'cards') return !!v;
    if (current.type === 'area' || current.type === 'number') return v && v >= current.min && v <= current.max;
    if (current.type === 'text') return v && v.length >= 2;
    return true;
  }, [answers, current]);

  const next = useCallback(() => {
    if (!validate()) { alert(current.type === 'text' ? 'Введите название проекта' : 'Заполните поле'); return; }
    if (step < total - 1) { setStep(s => s + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else finish();
  }, [validate, step, total, current]);

  const back = useCallback(() => { if (step > 0) setStep(s => s - 1); }, [step]);

  const finish = useCallback(() => {
    const result = calculateB2B(answers);
    const calc = {
      id: 'calc-' + Date.now(),
      timestamp: new Date().toISOString(),
      projectName: answers.project_name || 'Без названия',
      answers,
      result,
    };
    try {
      const all = JSON.parse(localStorage.getItem('rpkm-b2b-calcs') || '[]');
      all.push(calc);
      localStorage.setItem('rpkm-b2b-calcs', JSON.stringify(all));
    } catch {}
    sessionStorage.setItem('rpkm-b2b-current', JSON.stringify(calc));
    navigate('/b2b-result');
  }, [answers, navigate]);

  const selectOption = useCallback((val) => {
    setAnswer(current.id, val);
    if (step < total - 1) { setStep(s => s + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else finish();
  }, [current, step, total, setAnswer, finish]);

  return (
    <PageLayout>
      <main className="quiz-page b2b">
        <div className="quiz-wrap">
          <div className="quiz-meta">
            <span>Шаг {step + 1} из {total}</span>
            <span>~5 минут</span>
          </div>
          <div className="quiz-progress b2b">
            <div className="quiz-progress-bar" style={{ width: `${progress}%` }} />
          </div>

          <div className="quiz-card">
            <div className="quiz-step">
              <h2>{current.title}</h2>
              {current.hint && <div className="quiz-hint">{current.hint}</div>}

              {current.type === 'cards' && (
                <div className="options-grid">
                  {current.options.map(o => (
                    <button key={o.value} type="button"
                      className={`option-card${answers[current.id] === o.value ? ' selected' : ''}`}
                      onClick={() => selectOption(o.value)}>
                      <div className="option-card-title">{o.title}</div>
                      <div className="option-card-sub">{o.sub}</div>
                    </button>
                  ))}
                </div>
              )}

              {current.type === 'options' && (
                <div className="options">
                  {current.options.map(o => (
                    <button key={o.value} type="button"
                      className={`option${answers[current.id] === o.value ? ' selected' : ''}`}
                      onClick={() => selectOption(o.value)}>
                      <span className="option-emoji">{o.emoji || '•'}</span>
                      <span>{o.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {current.type === 'area' && (
                <>
                  <div className="area-input">
                    <input type="number" value={answers[current.id] || current.defaultValue}
                      min={current.min} max={current.max}
                      onChange={e => setAnswer(current.id, Math.max(current.min, Math.min(current.max, +e.target.value || current.defaultValue)))} />
                    <div className="area-input-suffix">м²</div>
                  </div>
                  <input type="range" className="area-slider" min={current.min} max={current.max} step="5"
                    value={answers[current.id] || current.defaultValue}
                    onChange={e => setAnswer(current.id, +e.target.value)} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: C.gray500, fontSize: 13, marginTop: 6 }}>
                    <span>{current.min} м²</span><span>{current.max} м²</span>
                  </div>
                </>
              )}

              {current.type === 'number' && (
                <div className="area-input">
                  <input type="number" value={answers[current.id] || current.defaultValue}
                    min={current.min} max={current.max}
                    onChange={e => setAnswer(current.id, Math.max(current.min, Math.min(current.max, +e.target.value || current.defaultValue)))} />
                  <div className="area-input-suffix">шт</div>
                </div>
              )}

              {current.type === 'text' && (
                <input type="text" className="text-input" placeholder={current.placeholder || ''}
                  value={answers[current.id] || ''}
                  onChange={e => setAnswer(current.id, e.target.value.trim())} />
              )}
            </div>
          </div>

          <div className="quiz-nav">
            <Btn variant="outline" onClick={back} style={{ visibility: step === 0 ? 'hidden' : 'visible' }}>← Назад</Btn>
            {(current.type !== 'options' && current.type !== 'cards') && (
              <Btn variant="dark" onClick={next}>{step === total - 1 ? 'Сформировать смету' : 'Далее'}</Btn>
            )}
          </div>
        </div>
      </main>
    </PageLayout>
  );
}
