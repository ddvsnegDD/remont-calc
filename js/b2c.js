// B2C quiz logic
const STORAGE_LEADS = 'rpkm-b2c-leads';

const STEPS = [
    {
        id: 'apartment_type',
        title: 'Какой тип квартиры?',
        hint: 'От этого зависит набор работ — в новостройке начинаем с черновой, во вторичке с демонтажа.',
        type: 'cards',
        options: [
            { value: 'novostroyka', title: 'Новостройка', sub: 'Только получили ключи' },
            { value: 'vtorichka',   title: 'Вторичка',     sub: 'Жилая или после прежних хозяев' },
        ],
    },
    {
        id: 'house_type',
        title: 'Тип дома?',
        hint: 'Конструктив влияет на сложность перепланировок и инженерных работ.',
        type: 'cards',
        optionsFor: (a) => {
            if (a.apartment_type === 'novostroyka') {
                // Современный рынок Москвы 2026 — реально строящиеся типы домов
                return [
                    { value: 'nov_monolith',       title: 'Монолит',                         sub: 'Современный ЖК · бизнес/премиум · 25–60 эт' },
                    { value: 'nov_monolith_brick', title: 'Монолитно-кирпичные/блоки',       sub: 'Клубные дома · комфорт+ / бизнес' },
                    { value: 'nov_panel_new',      title: 'Панель (новая серия)',            sub: 'Град-1М, ДомНАД · ПИК / реновация' },
                    { value: 'nov_brick',          title: 'Кирпичные/блоки',                 sub: 'Малоэтажный премиум · до 9 этажей' },
                ];
            }
            // Вторичка — наследие советской и постсоветской застройки
            return [
                { value: 'vtor_panel',     title: 'Панель',                  sub: 'П-44, КОПЭ, И-155 · 70–90-е годы' },
                { value: 'vtor_stalinka',  title: 'Сталинка',                sub: 'Высокие потолки, толстые стены' },
                { value: 'vtor_monolith',  title: 'Монолит',                 sub: 'Постройка 1995–2010' },
                { value: 'vtor_brick_old', title: 'Кирпич старой постройки', sub: 'Дореволюционный или советский кирпич' },
            ];
        },
    },
    {
        id: 'finish_type',
        title: 'Что у вас по отделке от застройщика?',
        hint: 'White Box — предчистовая отделка от застройщика: стяжка с шумоизоляцией, штукатурка стен и потолков, перегородки, разводка электрики и сантехники, сантехфаянс. Без отделки — голые бетонные стены, коммуникации заведены только до квартиры.',
        type: 'cards',
        visible: (a) => a.apartment_type === 'novostroyka',
        options: [
            { value: 'no_finish', title: 'Без отделки',  sub: 'Голые стены · полный цикл ремонта 4-9 мес' },
            { value: 'whitebox',  title: 'White Box',    sub: 'Предчистовая · экономия ~50% и срок 1.5-4 мес' },
        ],
    },
    {
        id: 'area',
        title: 'Площадь квартиры',
        hint: 'Введите общую площадь в квадратных метрах.',
        type: 'area',
        min: 20,
        max: 250,
        defaultValue: 60,
    },
    {
        id: 'repair_type',
        title: 'Какой ремонт планируете?',
        hint: 'Если сомневаетесь — выбирайте «капитальный»: это базовый сценарий «под ключ».',
        type: 'cards',
        options: [
            { value: 'cosmetic', title: 'Косметический', sub: 'Поклеить обои, покрасить, обновить' },
            { value: 'capital',  title: 'Капитальный',   sub: 'Под ключ, стандартные материалы' },
            { value: 'euro',     title: 'Евроремонт',    sub: 'Современный интерьер, дизайн' },
            { value: 'premium',  title: 'Премиум',       sub: 'Натур. материалы, авторский подход' },
        ],
    },
    {
        id: 'replan',
        title: 'Нужна ли перепланировка?',
        hint: 'Снос/перенос стен, объединение комнат и т.п.',
        type: 'options',
        options: [
            { value: 'no',    label: 'Нет, не требуется', emoji: '🚫' },
            { value: 'light', label: 'Лёгкая (без затрагивания несущих)', emoji: '✏️' },
            { value: 'full',  label: 'Полная (со согласованием в МЖИ)', emoji: '🏗️' },
        ],
    },
    {
        id: 'comms',
        title: 'Замена коммуникаций?',
        hint: 'Электрика, сантехника, отопление.',
        type: 'options',
        options: [
            { value: 'none',      label: 'Не нужна — всё рабочее', emoji: '✅' },
            { value: 'partial',   label: 'Частичная (электрика ИЛИ сантехника)', emoji: '🔧' },
            { value: 'full',      label: 'Полная — электрика + сантехника', emoji: '⚡' },
            { value: 'full_plus', label: 'Полная + отопление / вентиляция', emoji: '🔥' },
        ],
    },
    {
        id: 'design',
        title: 'Есть ли дизайн-проект?',
        hint: 'Готовый проект помогает точнее посчитать материалы.',
        type: 'options',
        options: [
            { value: 'yes',  label: 'Да, готовый проект на руках', emoji: '📐' },
            { value: 'no',   label: 'Нет, посчитайте без него', emoji: '🤷' },
            { value: 'need', label: 'Нет, но хочу сделать у вас', emoji: '✨' },
        ],
    },
    {
        id: 'timing',
        title: 'Когда хотите начать?',
        hint: '',
        type: 'options',
        options: [
            { value: 'asap',     label: 'Срочно — в течение месяца', emoji: '🚀' },
            { value: 'months_3', label: 'Через 1–3 месяца', emoji: '📅' },
            { value: 'flexible', label: 'Не срочно, выбираю варианты', emoji: '⏳' },
        ],
    },
    {
        id: 'contact',
        title: 'Куда отправить расчёт?',
        hint: 'Расчёт будет показан сразу. Контакты нужны, чтобы куратор связался для записи на бесплатный замер.',
        type: 'contact',
    },
];

const state = {
    step: 0,
    answers: {},
};

const $ = (id) => document.getElementById(id);

function visibleSteps() {
    return STEPS.filter(s => !s.visible || s.visible(state.answers));
}

function currentStep() {
    return visibleSteps()[state.step];
}

function render() {
    const visible = visibleSteps();
    const step = visible[state.step];
    const total = visible.length;
    $('progress-bar').style.width = ((state.step / total) * 100) + '%';
    $('quiz-step-num').textContent = `Шаг ${state.step + 1} из ${total}`;
    $('back-btn').style.visibility = state.step === 0 ? 'hidden' : 'visible';

    // Resolve dynamic options for this step
    const stepOptions = typeof step.optionsFor === 'function'
        ? step.optionsFor(state.answers)
        : step.options;

    const card = $('quiz-card');
    let html = `
        <div class="quiz-step">
            <h2>${step.title}</h2>
            ${step.hint ? `<div class="quiz-hint">${step.hint}</div>` : ''}
    `;

    if (step.type === 'options') {
        html += '<div class="options">';
        for (const o of stepOptions) {
            const sel = state.answers[step.id] === o.value ? 'selected' : '';
            html += `<button type="button" class="option ${sel}" data-value="${o.value}">
                <span class="option-emoji">${o.emoji || '•'}</span>
                <span>${o.label}</span>
            </button>`;
        }
        html += '</div>';
    } else if (step.type === 'cards') {
        html += '<div class="options-grid">';
        for (const o of stepOptions) {
            const sel = state.answers[step.id] === o.value ? 'selected' : '';
            html += `<button type="button" class="option-card ${sel}" data-value="${o.value}">
                <div class="option-card-title">${o.title}</div>
                <div class="option-card-sub">${o.sub}</div>
            </button>`;
        }
        html += '</div>';
    } else if (step.type === 'area') {
        const cur = state.answers.area || step.defaultValue;
        html += `
            <div class="area-input">
                <input type="number" id="area-num" value="${cur}" min="${step.min}" max="${step.max}">
                <div class="area-input-suffix">м²</div>
            </div>
            <input type="range" class="area-slider" id="area-range" min="${step.min}" max="${step.max}" step="1" value="${cur}">
            <div style="display:flex;justify-content:space-between;color:var(--gray-500);font-size:13px;margin-top:6px;">
                <span>${step.min} м²</span><span>${step.max} м²</span>
            </div>
        `;
    } else if (step.type === 'contact') {
        html += `
            <div class="form-field">
                <label>Как вас зовут?</label>
                <input type="text" class="text-input" id="contact-name" placeholder="Имя" value="${state.answers.name || ''}">
            </div>
            <div class="form-field">
                <label>Телефон</label>
                <input type="tel" class="text-input" id="contact-phone" placeholder="+7 (___) ___-__-__" value="${state.answers.phone || ''}">
            </div>
            <div class="form-field">
                <label>Telegram или email (опционально)</label>
                <input type="text" class="text-input" id="contact-extra" placeholder="@username или email" value="${state.answers.extra || ''}">
            </div>
            <label class="checkbox-row">
                <input type="checkbox" id="agree" ${state.answers.agree ? 'checked' : ''}>
                <span>Согласен на обработку персональных данных. Это демо-проект — данные сохраняются только в моём браузере.</span>
            </label>
        `;
    }

    html += `</div>`;
    card.innerHTML = html;

    // Wire up handlers
    if (step.type === 'options' || step.type === 'cards') {
        card.querySelectorAll('[data-value]').forEach((btn) => {
            btn.addEventListener('click', () => {
                state.answers[step.id] = btn.dataset.value;
                next();
            });
        });
    } else if (step.type === 'area') {
        const num = $('area-num'), rng = $('area-range');
        const sync = (val) => {
            const v = Math.max(step.min, Math.min(step.max, parseInt(val) || step.defaultValue));
            num.value = v;
            rng.value = v;
            state.answers.area = v;
        };
        num.addEventListener('input', (e) => sync(e.target.value));
        rng.addEventListener('input', (e) => sync(e.target.value));
        state.answers.area = state.answers.area || step.defaultValue;
    }

    const visTotal = visibleSteps().length;
    $('next-btn').textContent = state.step === visTotal - 1 ? 'Получить расчёт' : 'Далее';
    $('next-btn').style.display = (step.type === 'options' || step.type === 'cards') ? 'none' : '';
}

function validateStep() {
    const step = currentStep();
    if (step.type === 'options' || step.type === 'cards') {
        return !!state.answers[step.id];
    }
    if (step.type === 'area') {
        const a = state.answers.area;
        return a && a >= step.min && a <= step.max;
    }
    if (step.type === 'contact') {
        const name = $('contact-name')?.value.trim();
        const phone = $('contact-phone')?.value.trim();
        const agree = $('agree')?.checked;
        if (!name || name.length < 2) { showError('Введите имя'); return false; }
        if (!phone || phone.replace(/\D/g, '').length < 10) { showError('Введите корректный телефон'); return false; }
        if (!agree) { showError('Нужно согласие на обработку данных'); return false; }
        state.answers.name = name;
        state.answers.phone = phone;
        state.answers.extra = $('contact-extra')?.value.trim() || '';
        state.answers.agree = true;
        return true;
    }
    return true;
}

function showError(msg) {
    let err = $('quiz-error');
    if (!err) {
        err = document.createElement('div');
        err.id = 'quiz-error';
        err.className = 'form-error';
        $('quiz-card').appendChild(err);
    }
    err.textContent = msg;
    setTimeout(() => err && err.remove(), 3500);
}

function next() {
    if (!validateStep()) return;
    const visTotal = visibleSteps().length;
    if (state.step < visTotal - 1) {
        state.step++;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        finish();
    }
}

function back() {
    if (state.step > 0) {
        state.step--;
        render();
    }
}

function saveLeadLocal(record) {
    try {
        const all = JSON.parse(localStorage.getItem(STORAGE_LEADS) || '[]');
        all.unshift(record);
        localStorage.setItem(STORAGE_LEADS, JSON.stringify(all.slice(0, 200)));
    } catch {}
}

function finish() {
    const result = calculateB2C(state.answers);
    const lead = {
        id: 'b2c-' + Date.now(),
        timestamp: new Date().toISOString(),
        kind: 'b2c',
        answers: state.answers,
        result,
    };
    saveLeadLocal(lead);
    sessionStorage.setItem('rpkm-last-b2c', JSON.stringify(lead));
    location.href = 'b2c-result.html';
}

document.addEventListener('DOMContentLoaded', () => {
    $('next-btn').addEventListener('click', next);
    $('back-btn').addEventListener('click', back);
    render();
});
