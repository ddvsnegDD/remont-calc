// Pricing engine for РПКМ renovation calculator
// All prices in RUB per sqm

const TIERS = {
    cosmetic:    { label: 'Косметический',     baseLow: 18000, baseHigh: 25000 },
    capital:     { label: 'Капитальный стандарт', baseLow: 25000, baseHigh: 40000 },
    euro:        { label: 'Евроремонт',         baseLow: 40000, baseHigh: 60000 },
    euro_top:    { label: 'Евроремонт+',        baseLow: 60000, baseHigh: 90000 },
    premium:     { label: 'Премиум',            baseLow: 90000, baseHigh: 150000 },
    luxury:      { label: 'Люкс',               baseLow: 150000, baseHigh: 250000 },
};

// House type modifiers (applied to base ₽/m²)
// Modern Moscow market 2026 — newbuild types per stroi.mos.ru / ЕРЗ analysis
const HOUSE_MOD = {
    // Новостройка (актуально для строящихся ЖК)
    nov_monolith:        { label: 'Новостройка · монолит',                    mod: 1.00 },
    nov_monolith_brick:  { label: 'Новостройка · монолитно-кирпичные/блоки',  mod: 1.02 },
    nov_panel_new:       { label: 'Новостройка · панель (новая серия)',       mod: 0.96 },
    nov_brick:           { label: 'Новостройка · кирпич/блоки',               mod: 1.06 },

    // Вторичка (наследие советской и постсоветской застройки)
    vtor_panel:          { label: 'Вторичка · панель (П-44, КОПЭ, И-155)',    mod: 1.00 },
    vtor_stalinka:       { label: 'Вторичка · сталинка',                       mod: 1.10 },
    vtor_monolith:       { label: 'Вторичка · монолит (1995–2010)',           mod: 1.05 },
    vtor_brick_old:      { label: 'Вторичка · кирпич старой постройки',        mod: 1.08 },
    historic:            { label: 'Историч. реконструкция',                    mod: 1.18 },

    // Legacy keys — kept for back-compat with B2B form (не показываются в B2C)
    novostroyka_monolith:{ label: 'Новостройка монолит',  mod: 1.00 },
    novostroyka_panel:   { label: 'Новостройка панель',   mod: 0.96 },
    vtorichka_monolith:  { label: 'Вторичка монолит',     mod: 1.03 },
    vtorichka_panel:     { label: 'Вторичка панель',      mod: 0.98 },
    stalinka:            { label: 'Сталинка',             mod: 1.10 },
};

// Pre-finishing state (only relevant for новостройка)
// Per market analysis: WhiteBox saves ~30-35% on full renovation
const FINISH_MOD = {
    no_finish: { label: 'Без отделки (голые стены)', mod: 1.00 },
    whitebox:  { label: 'White Box (предчистовая)',  mod: 0.70 },
};

// Communications replacement
const COMMS_MOD = {
    none:     { label: 'Не нужна',                       mod: 1.00 },
    partial:  { label: 'Частичная (электрика ИЛИ сантех)', mod: 1.05 },
    full:     { label: 'Полная (электрика + сантех)',    mod: 1.10 },
    full_plus:{ label: 'Полная + отопление/вентиляция',  mod: 1.16 },
};

// Replanning
const REPLAN_MOD = {
    no:       { label: 'Не требуется',                   mod: 1.00 },
    light:    { label: 'Лёгкая (без затрагивания несущих)', mod: 1.05 },
    full:     { label: 'Полная (со согласованием)',      mod: 1.12 },
};

// Has design project
const DESIGN_MOD = {
    yes:      { label: 'Есть',                           mod: 1.00 },
    no:       { label: 'Нет, но рассчитайте без него',   mod: 1.03 },
    need:     { label: 'Нужно сделать',                  mod: 1.07 },
};

// Timeline
const TIMING_MOD = {
    flexible: { label: 'Не срочно',                       mod: 1.00 },
    months_3: { label: 'Через 1–3 месяца',                mod: 1.00 },
    asap:     { label: 'Срочно (в течение месяца)',       mod: 1.07 },
};

// === B2B-specific modifiers ===
const WALL_FINISH = {
    paint:        { label: 'Краска',                  mod: 1.00 },
    wallpaper:    { label: 'Обои',                    mod: 1.00 },
    decor_plaster:{ label: 'Декоративная штукатурка', mod: 1.10 },
    panels:       { label: 'Панели (МДФ/буазери)',    mod: 1.18 },
    veneer:       { label: 'Шпон / стеновые панели',  mod: 1.28 },
    stone:        { label: 'Натуральный камень',      mod: 1.40 },
};

const CEILING_FINISH = {
    stretch:      { label: 'Натяжной',                mod: 1.00 },
    drywall:      { label: 'Гипсокартон одноуровн.',  mod: 1.05 },
    drywall_multi:{ label: 'Гипсокартон многоуровн.', mod: 1.12 },
    plaster:      { label: 'Штукатурка',              mod: 1.03 },
    molding:      { label: 'Лепнина / молдинги',      mod: 1.22 },
};

const FLOOR_FINISH = {
    laminate:     { label: 'Ламинат',                 mod: 1.00 },
    parquet_eng:  { label: 'Паркет инженерный',       mod: 1.10 },
    parquet_solid:{ label: 'Паркет массив',           mod: 1.22 },
    porcelain:    { label: 'Керамогранит',            mod: 1.05 },
    marble:       { label: 'Мрамор / натур. камень',  mod: 1.32 },
};

const ENGINEERING = {
    standard:     { label: 'Стандарт',                mod: 1.00 },
    smart_home:   { label: 'Smart home',              mod: 1.12 },
    climate:      { label: 'Climate control + smart', mod: 1.20 },
    special:      { label: 'Спец. системы (кинотеатр, винотека)', mod: 1.30 },
};

const SUPERVISION = {
    included:     { label: 'Входит в проект',         mod: 1.00 },
    separate:     { label: 'Нужен отдельно',          mod: 1.05 },
    none:         { label: 'Не требуется',            mod: 1.00 },
};

const FLOOR_LEVEL = {
    low:          { label: '1–5 этаж',                mod: 1.00 },
    mid:          { label: '6–15 этаж',               mod: 1.02 },
    high:         { label: '16–25 этаж',              mod: 1.05 },
    top:          { label: '25+ / пентхаус',          mod: 1.08 },
};

// Cost split: works / rough materials / finishing materials
function getSplit(tier) {
    if (tier === 'cosmetic' || tier === 'capital') {
        return { works: 0.45, rough: 0.20, finish: 0.35 };
    }
    if (tier === 'euro' || tier === 'euro_top') {
        return { works: 0.40, rough: 0.18, finish: 0.42 };
    }
    return { works: 0.35, rough: 0.15, finish: 0.50 };
}

// Estimate construction duration in working days (rough rule of thumb: 1m² ≈ 1 day for capital, less for cosmetic, more for premium)
function estimateDays(area, tier) {
    const factor = {
        cosmetic: 0.45,
        capital: 0.85,
        euro: 1.0,
        euro_top: 1.2,
        premium: 1.5,
        luxury: 1.9,
    }[tier] || 1.0;
    const days = Math.round(area * factor);
    return Math.max(30, days);
}

function tierFromAnswers(answers) {
    if (answers.repair_type === 'cosmetic') return 'cosmetic';
    if (answers.repair_type === 'capital')  return 'capital';
    if (answers.repair_type === 'euro')     return 'euro';
    if (answers.repair_type === 'premium')  return 'euro_top';
    return 'capital';
}

// === MAIN B2C calculation ===
function calculateB2C(answers) {
    const tier = tierFromAnswers(answers);
    const tierDef = TIERS[tier];
    const area = parseFloat(answers.area) || 60;

    const houseKey = answers.house_type;
    const houseMod = (HOUSE_MOD[houseKey] || { mod: 1.00 }).mod;
    const commsMod = (COMMS_MOD[answers.comms] || { mod: 1.00 }).mod;
    const replanMod = (REPLAN_MOD[answers.replan] || { mod: 1.00 }).mod;
    const designMod = (DESIGN_MOD[answers.design] || { mod: 1.00 }).mod;
    const timingMod = (TIMING_MOD[answers.timing] || { mod: 1.00 }).mod;
    // Finish type only applies to новостройка (otherwise mod = 1.00)
    const finishMod = answers.apartment_type === 'novostroyka' && answers.finish_type
        ? (FINISH_MOD[answers.finish_type] || { mod: 1.00 }).mod
        : 1.00;

    const totalMod = houseMod * commsMod * replanMod * designMod * timingMod * finishMod;

    const lowPerM2 = Math.round(tierDef.baseLow * totalMod);
    const highPerM2 = Math.round(tierDef.baseHigh * totalMod);

    const totalLow = lowPerM2 * area;
    const totalHigh = highPerM2 * area;

    const split = getSplit(tier);

    return {
        tier,
        tierLabel: tierDef.label,
        area,
        lowPerM2,
        highPerM2,
        totalLow,
        totalHigh,
        avgTotal: Math.round((totalLow + totalHigh) / 2),
        breakdown: {
            works:  { low: Math.round(totalLow * split.works),  high: Math.round(totalHigh * split.works),  pct: split.works },
            rough:  { low: Math.round(totalLow * split.rough),  high: Math.round(totalHigh * split.rough),  pct: split.rough },
            finish: { low: Math.round(totalLow * split.finish), high: Math.round(totalHigh * split.finish), pct: split.finish },
        },
        days: estimateDays(area, tier),
        modifiers: Object.fromEntries(Object.entries({
            'Тип дома':       HOUSE_MOD[houseKey]?.label,
            'Отделка':        answers.apartment_type === 'novostroyka' ? FINISH_MOD[answers.finish_type]?.label : null,
            'Коммуникации':   COMMS_MOD[answers.comms]?.label,
            'Перепланировка': REPLAN_MOD[answers.replan]?.label,
            'Дизайн-проект':  DESIGN_MOD[answers.design]?.label,
            'Сроки':          TIMING_MOD[answers.timing]?.label,
        }).filter(([k, v]) => !!v)),
    };
}

// === MAIN B2B calculation ===
function calculateB2B(answers) {
    // B2B always uses premium tier as base; luxury kicks in only on extreme combos
    let tier = 'premium';
    let luxScore = 0;
    if (answers.wall_finish === 'stone') luxScore++;
    if (answers.floor_finish === 'marble') luxScore++;
    if (answers.ceiling_finish === 'molding') luxScore++;
    if (answers.engineering === 'special') luxScore++;
    if (luxScore >= 3) tier = 'luxury';

    const tierDef = TIERS[tier];
    const area = parseFloat(answers.area) || 150;

    const houseMod = (HOUSE_MOD[answers.house_type] || { mod: 1.00 }).mod;
    const floorLvl = (FLOOR_LEVEL[answers.floor_level] || { mod: 1.00 }).mod;
    const wallMod  = (WALL_FINISH[answers.wall_finish] || { mod: 1.00 }).mod;
    const ceilMod  = (CEILING_FINISH[answers.ceiling_finish] || { mod: 1.00 }).mod;
    const flrMod   = (FLOOR_FINISH[answers.floor_finish] || { mod: 1.00 }).mod;
    const engMod   = (ENGINEERING[answers.engineering] || { mod: 1.00 }).mod;
    const supMod   = (SUPERVISION[answers.supervision] || { mod: 1.00 }).mod;

    // Bathroom and room count cost factor
    const baths = parseInt(answers.bathrooms || 1);
    const rooms = parseInt(answers.rooms || 3);
    const bathMod = 1 + Math.max(0, baths - 1) * 0.025;
    const roomMod = 1 + Math.max(0, rooms - 3) * 0.012;

    // Average finish multiplier (weighted)
    const finishMod = (wallMod * 0.4 + ceilMod * 0.25 + flrMod * 0.35);

    const totalMod = houseMod * floorLvl * finishMod * engMod * supMod * bathMod * roomMod;

    const lowPerM2 = Math.round(tierDef.baseLow * totalMod);
    const highPerM2 = Math.round(tierDef.baseHigh * totalMod);

    const totalLow = lowPerM2 * area;
    const totalHigh = highPerM2 * area;

    const split = getSplit(tier);

    return {
        tier,
        tierLabel: tierDef.label,
        area,
        lowPerM2,
        highPerM2,
        totalLow,
        totalHigh,
        avgTotal: Math.round((totalLow + totalHigh) / 2),
        breakdown: {
            demo:    { low: Math.round(totalLow * 0.06),         high: Math.round(totalHigh * 0.06),         label: 'Демонтаж' },
            rough:   { low: Math.round(totalLow * split.rough),  high: Math.round(totalHigh * split.rough),  label: 'Черновые работы и материалы' },
            engineering: { low: Math.round(totalLow * 0.18),     high: Math.round(totalHigh * 0.18),         label: 'Инженерные системы' },
            finishing: { low: Math.round(totalLow * (split.works + split.finish - 0.24)), high: Math.round(totalHigh * (split.works + split.finish - 0.24)), label: 'Отделка и чистовые материалы' },
        },
        days: estimateDays(area, tier),
        modifiers: {
            'Тип здания': HOUSE_MOD[answers.house_type]?.label,
            'Этажность': FLOOR_LEVEL[answers.floor_level]?.label,
            'Стены': WALL_FINISH[answers.wall_finish]?.label,
            'Потолки': CEILING_FINISH[answers.ceiling_finish]?.label,
            'Полы': FLOOR_FINISH[answers.floor_finish]?.label,
            'Инженерия': ENGINEERING[answers.engineering]?.label,
            'Авторский надзор': SUPERVISION[answers.supervision]?.label,
            'Санузлы': baths + ' шт',
            'Комнаты': rooms + ' шт',
        },
    };
}

function formatRub(n) {
    if (n >= 1_000_000) {
        const millions = n / 1_000_000;
        return millions.toFixed(millions >= 10 ? 1 : 2).replace('.', ',') + ' млн ₽';
    }
    return n.toLocaleString('ru-RU') + ' ₽';
}

function formatRubFull(n) {
    return Math.round(n).toLocaleString('ru-RU') + ' ₽';
}

function formatDays(days) {
    const months = Math.round(days / 22 * 10) / 10;
    return `~${days} раб. дней (${months.toString().replace('.', ',')} мес)`;
}
