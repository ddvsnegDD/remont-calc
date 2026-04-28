// B2B quiz — extended (12+ questions)
const STEPS = [
    {
        id: 'project_name',
        title: 'Название проекта',
        hint: 'Для удобства поиска в истории расчётов. Пример: «Хамовники 180 м², клиент ИП».',
        type: 'text',
        placeholder: 'Внутреннее название проекта',
    },
    {
        id: 'house_type',
        title: 'Тип здания',
        hint: 'Конструктив влияет на сложность работ.',
        type: 'cards',
        options: [
            { value: 'novostroyka_monolith', title: 'Новостройка монолит', sub: 'Свободная планировка' },
            { value: 'vtorichka_monolith',   title: 'Вторичка монолит', sub: '90-2000-е, бизнес-класс' },
            { value: 'stalinka',             title: 'Сталинка', sub: 'Высокие потолки, толстые стены' },
            { value: 'historic',             title: 'Историч. реконструкция', sub: 'Особняк, охранная зона' },
        ],
    },
    {
        id: 'area',
        title: 'Площадь по полу (м²)',
        hint: 'Общая площадь объекта.',
        type: 'area',
        min: 50, max: 800, defaultValue: 150,
    },
    {
        id: 'rooms',
        title: 'Количество комнат',
        hint: 'Жилые + кухня-гостиная.',
        type: 'number',
        defaultValue: 3,
        min: 1, max: 12,
    },
    {
        id: 'bathrooms',
        title: 'Количество санузлов',
        hint: 'Включая мокрые зоны (хамам, сауна, постирочная).',
        type: 'number',
        defaultValue: 2,
        min: 1, max: 8,
    },
    {
        id: 'floor_level',
        title: 'Этаж объекта',
        hint: 'Логистика материалов: на верхние этажи стоимость доставки/подъёма выше.',
        type: 'cards',
        options: [
            { value: 'low',  title: '1–5 этаж',   sub: 'Стандартная логистика' },
            { value: 'mid',  title: '6–15 этаж',  sub: 'Средняя сложность' },
            { value: 'high', title: '16–25 этаж', sub: 'Повышенная сложность' },
            { value: 'top',  title: '25+ / пентхаус', sub: 'Спец. логистика, краны' },
        ],
    },
    {
        id: 'wall_finish',
        title: 'Тип отделки стен',
        hint: 'Доминирующий материал по площади. Если несколько — выберите самый дорогой.',
        type: 'cards',
        options: [
            { value: 'paint',         title: 'Краска', sub: 'Декоративная или матовая' },
            { value: 'wallpaper',     title: 'Обои', sub: 'Винил, флизелин, текстиль' },
            { value: 'decor_plaster', title: 'Декор. штукатурка', sub: 'Венецианка, травертин' },
            { value: 'panels',        title: 'Панели', sub: 'МДФ, буазери' },
            { value: 'veneer',        title: 'Шпон', sub: 'Стеновые панели из ценной породы' },
            { value: 'stone',         title: 'Натуральный камень', sub: 'Мрамор, оникс, травертин' },
        ],
    },
    {
        id: 'ceiling_finish',
        title: 'Тип отделки потолков',
        hint: '',
        type: 'cards',
        options: [
            { value: 'stretch',       title: 'Натяжной',                sub: 'Матовый или сатин' },
            { value: 'drywall',       title: 'Гипсокартон одноуровн.',  sub: 'Базовое решение' },
            { value: 'drywall_multi', title: 'Гипсокартон многоуровн.', sub: 'С нишами и подсветкой' },
            { value: 'plaster',       title: 'Штукатурка',              sub: 'Гладкая, под покраску' },
            { value: 'molding',       title: 'Лепнина / молдинги',      sub: 'Карнизы, кессоны, медальоны' },
        ],
    },
    {
        id: 'floor_finish',
        title: 'Тип отделки полов',
        hint: 'Доминирующий материал.',
        type: 'cards',
        options: [
            { value: 'laminate',      title: 'Ламинат',           sub: 'Бытовой / коммерч.' },
            { value: 'parquet_eng',   title: 'Паркет инженерный', sub: 'Однополосный, многослойн.' },
            { value: 'parquet_solid', title: 'Паркет массив',     sub: 'Дуб, орех, ясень' },
            { value: 'porcelain',     title: 'Керамогранит',      sub: 'Под камень / дерево' },
            { value: 'marble',        title: 'Мрамор / нат. камень', sub: 'Calacatta, Statuario' },
        ],
    },
    {
        id: 'engineering',
        title: 'Сложность инженерных систем',
        hint: 'Smart home — управление светом/климатом из одного интерфейса.',
        type: 'options',
        options: [
            { value: 'standard',   label: 'Стандарт — обычная разводка', emoji: '🔌' },
            { value: 'smart_home', label: 'Smart home — KNX / Lutron', emoji: '📱' },
            { value: 'climate',    label: 'Climate control + smart', emoji: '❄️' },
            { value: 'special',    label: 'Спец. системы (кинотеатр, винотека, аквариум)', emoji: '🎬' },
        ],
    },
    {
        id: 'supervision',
        title: 'Авторский надзор дизайнера',
        hint: 'Кто будет вести надзор за реализацией.',
        type: 'options',
        options: [
            { value: 'included', label: 'Входит — дизайнер сам ведёт', emoji: '👨‍🎨' },
            { value: 'separate', label: 'Нужен отдельно от подрядчика', emoji: '➕' },
            { value: 'none',     label: 'Не требуется', emoji: '🚫' },
        ],
    },
    {
        id: 'timing',
        title: 'Сроки начала работ',
        hint: 'Желаемая дата старта на объекте.',
        type: 'options',
        options: [
            { value: 'asap',     label: 'Срочно — в течение месяца', emoji: '🚀' },
            { value: 'months_3', label: 'Через 1–3 месяца', emoji: '📅' },
            { value: 'flexible', label: 'Не определены / на этапе проекта', emoji: '⏳' },
        ],
    },
];

const state = { step: 0, answers: {} };
const $ = (id) => document.getElementById(id);

function render() {
    const step = STEPS[state.step];
    const total = STEPS.length;
    $('progress-bar').style.width = ((state.step / total) * 100) + '%';
    $('quiz-step-num').textContent = `Шаг ${state.step + 1} из ${total}`;
    $('back-btn').style.visibility = state.step === 0 ? 'hidden' : 'visible';

    const card = $('quiz-card');
    let html = `<div class="quiz-step"><h2>${step.title}</h2>`;
    if (step.hint) html += `<div class="quiz-hint">${step.hint}</div>`;

    if (step.type === 'options') {
        html += '<div class="options">';
        for (const o of step.options) {
            const sel = state.answers[step.id] === o.value ? 'selected' : '';
            html += `<button type="button" class="option ${sel}" data-value="${o.value}">
                <span class="option-emoji">${o.emoji || '•'}</span>
                <span>${o.label}</span>
            </button>`;
        }
        html += '</div>';
    } else if (step.type === 'cards') {
        html += '<div class="options-grid">';
        for (const o of step.options) {
            const sel = state.answers[step.id] === o.value ? 'selected' : '';
            html += `<button type="button" class="option-card ${sel}" data-value="${o.value}">
                <div class="option-card-title">${o.title}</div>
                <div class="option-card-sub">${o.sub}</div>
            </button>`;
        }
        html += '</div>';
    } else if (step.type === 'area') {
        const cur = state.answers[step.id] || step.defaultValue;
        html += `
            <div class="area-input">
                <input type="number" id="area-num" value="${cur}" min="${step.min}" max="${step.max}">
                <div class="area-input-suffix">м²</div>
            </div>
            <input type="range" class="area-slider" id="area-range" min="${step.min}" max="${step.max}" step="5" value="${cur}">
            <div style="display:flex;justify-content:space-between;color:var(--gray-500);font-size:13px;margin-top:6px;">
                <span>${step.min} м²</span><span>${step.max} м²</span>
            </div>
        `;
    } else if (step.type === 'number') {
        const cur = state.answers[step.id] || step.defaultValue;
        html += `
            <div class="area-input">
                <input type="number" id="num-input" value="${cur}" min="${step.min}" max="${step.max}">
                <div class="area-input-suffix">шт</div>
            </div>
        `;
    } else if (step.type === 'text') {
        html += `<input type="text" class="text-input" id="text-input" placeholder="${step.placeholder || ''}" value="${state.answers[step.id] || ''}">`;
    }

    html += `</div>`;
    card.innerHTML = html;

    if (step.type === 'options' || step.type === 'cards') {
        card.querySelectorAll('[data-value]').forEach((btn) => {
            btn.addEventListener('click', () => {
                state.answers[step.id] = btn.dataset.value;
                next();
            });
        });
    } else if (step.type === 'area' || step.type === 'number') {
        const num = $(step.type === 'area' ? 'area-num' : 'num-input');
        const rng = $('area-range');
        const sync = (val) => {
            const v = Math.max(step.min, Math.min(step.max, parseInt(val) || step.defaultValue));
            num.value = v;
            if (rng) rng.value = v;
            state.answers[step.id] = v;
        };
        num.addEventListener('input', (e) => sync(e.target.value));
        if (rng) rng.addEventListener('input', (e) => sync(e.target.value));
        state.answers[step.id] = state.answers[step.id] || step.defaultValue;
    } else if (step.type === 'text') {
        const inp = $('text-input');
        inp.addEventListener('input', () => state.answers[step.id] = inp.value.trim());
    }

    $('next-btn').textContent = state.step === STEPS.length - 1 ? 'Сформировать смету' : 'Далее';
    $('next-btn').style.display = (step.type === 'options' || step.type === 'cards') ? 'none' : '';
}

function validate() {
    const step = STEPS[state.step];
    const v = state.answers[step.id];
    if (step.type === 'options' || step.type === 'cards') return !!v;
    if (step.type === 'area' || step.type === 'number') return v && v >= step.min && v <= step.max;
    if (step.type === 'text') return !!v && v.length >= 2;
    return true;
}

function next() {
    if (!validate()) {
        const step = STEPS[state.step];
        alert(step.type === 'text' ? 'Введите название проекта' : 'Заполните поле');
        return;
    }
    if (state.step < STEPS.length - 1) {
        state.step++;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        finish();
    }
}

function back() {
    if (state.step > 0) { state.step--; render(); }
}

function finish() {
    const user = Auth.requireAuth();
    if (!user) return;
    const result = calculateB2B(state.answers);
    const calc = {
        id: 'calc-' + Date.now(),
        userId: user.id,
        timestamp: new Date().toISOString(),
        projectName: state.answers.project_name || 'Без названия',
        answers: state.answers,
        result,
    };
    Calcs.save(calc);
    location.href = 'b2b-result.html?id=' + calc.id;
}

document.addEventListener('DOMContentLoaded', () => {
    Auth.requireAuth();
    $('next-btn').addEventListener('click', next);
    $('back-btn').addEventListener('click', back);
    render();
});
