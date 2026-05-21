// Office fit-out estimate data — ES module version.
export const OFFICE_INFLATION_2026 = 1.11;

export const OFFICE_TIERS = {
  standard: { key: 'standard', label: 'Стандарт', pricePerM2: 78614, description: 'Базовый, функциональный дизайн. Простые архитектурные решения. Стандартные обои, ламинат, линолеум или ковровое покрытие.', traits: ['Стандартные отделочные материалы', 'Базовое освещение и AV', 'Open space без декоративных элементов'] },
  business: { key: 'business', label: 'Бизнес', pricePerM2: 162389, description: 'Современный, стильный, эргономичный дизайн. Высококлассные обои, ламинат, ковровые покрытия. Дерево, стекло, металл, текстиль.', traits: ['Качественные материалы среднего сегмента', 'Системы бронирования и AV', 'Звукоизоляция переговорных'] },
  premium: { key: 'premium', label: 'Премиум', pricePerM2: 264207, description: 'Уникальный, роскошный дизайн. Дерево, мрамор, стекло, металл. Натуральный камень, паркет, KNX/Lutron, BMS.', traits: ['Натуральные материалы (мрамор, камень, шпон)', 'Полная диспетчеризация здания (BMS)', 'VIP-кабинеты'] },
};

export const OFFICE_BUDGET_RAW = {
  standard: [
    { section: 'management', title: 'Управление проектом', value: 3725 },
    { section: 'design', title: 'Проектная документация и дизайн-проект', value: 3968 },
    { section: 'general', title: 'Общестроительные работы', subItems: [
      { id: 'demolition', title: 'Демонтажные работы', optional: true, default: false, value: 2800 },
      { id: 'partitions', title: 'Перегородки и двери', value: 2072 },
      { id: 'walls', title: 'Отделка стен', value: 11661 },
      { id: 'floors', title: 'Отделка пола', value: 5716 },
      { id: 'ceilings', title: 'Потолки', value: 3409 },
      { id: 'accessories', title: 'Установка аксессуаров', value: 90 },
      { id: 'furniture', title: 'Встраиваемая мебель и бытовая техника', value: 901 },
      { id: 'signage', title: 'Установка вывесок и логотипов', value: 707 },
    ] },
    { section: 'electrical', title: 'Электрические и слаботочные системы', subItems: [
      { id: 'power', title: 'Электроснабжение и розетки', value: 7536 },
      { id: 'lighting', title: 'Система освещения', value: 1802 },
      { id: 'fire_alarm', title: 'Пожарная сигнализация и СОУЭ', value: 1834 },
      { id: 'scs', title: 'СКС и пассивное IT-оборудование', value: 8123 },
      { id: 'access', title: 'Контроль доступа', optional: true, value: 1291 },
      { id: 'cctv', title: 'Видеонаблюдение', optional: true, value: 1431 },
      { id: 'security', title: 'Охранная сигнализация', optional: true, value: 950 },
      { id: 'bms', title: 'Система диспетчеризации (BMS)', optional: true, default: false, value: 2838 },
    ] },
    { section: 'mechanical', title: 'Механические системы', subItems: [
      { id: 'ventilation', title: 'Вентиляция', value: 5410 },
      { id: 'climate', title: 'Кондиционирование', value: 2870 },
      { id: 'heating', title: 'Отопление', value: 1802 },
      { id: 'water', title: 'Водоснабжение и канализация', value: 1712 },
      { id: 'fire_pipe', title: 'Противопожарный водопровод', value: 360 },
      { id: 'gas_extinguishing', title: 'Система газового пожаротушения', value: 1068 },
      { id: 'smoke_removal', title: 'Система дымоудаления', optional: true, value: 257 },
    ] },
  ],
  business: [
    { section: 'management', title: 'Управление проектом', value: 4135 },
    { section: 'design', title: 'Проектная документация и дизайн-проект', value: 5267 },
    { section: 'general', title: 'Общестроительные работы', subItems: [
      { id: 'demolition', title: 'Демонтажные работы', optional: true, default: false, value: 3108 },
      { id: 'partitions', title: 'Перегородки и двери', value: 13394 },
      { id: 'walls', title: 'Отделка стен', value: 9575 },
      { id: 'floors', title: 'Отделка пола', value: 9391 },
      { id: 'ceilings', title: 'Потолки', value: 8950 },
      { id: 'accessories', title: 'Установка аксессуаров', value: 533 },
      { id: 'signage', title: 'Установка вывесок и логотипов', value: 1061 },
    ] },
    { section: 'furniture', title: 'Мебель', value: 9200 },
    { section: 'electrical', title: 'Электрические и слаботочные системы', subItems: [
      { id: 'power', title: 'Электроснабжение и розетки', value: 12157 },
      { id: 'lighting', title: 'Система освещения', value: 9005 },
      { id: 'fire_alarm', title: 'Пожарная сигнализация и СОУЭ', value: 4290 },
      { id: 'scs', title: 'СКС и пассивное IT-оборудование', value: 5260 },
      { id: 'access', title: 'Контроль доступа', optional: true, value: 2219 },
      { id: 'cctv', title: 'Видеонаблюдение', optional: true, value: 2724 },
      { id: 'security', title: 'Охранная сигнализация', optional: true, value: 1795 },
      { id: 'bms', title: 'Система диспетчеризации (BMS)', value: 5675 },
    ] },
    { section: 'mechanical', title: 'Механические системы', subItems: [
      { id: 'ventilation', title: 'Вентиляция', value: 8295 },
      { id: 'climate', title: 'Кондиционирование', value: 11742 },
      { id: 'heating', title: 'Отопление', value: 2338 },
      { id: 'water', title: 'Водоснабжение и канализация', value: 2888 },
      { id: 'fire_pipe', title: 'Противопожарный водопровод', value: 1093 },
      { id: 'gas_extinguishing', title: 'Система газового пожаротушения', value: 1015 },
      { id: 'smoke_removal', title: 'Система дымоудаления', optional: true, value: 569 },
    ] },
  ],
  premium: [
    { section: 'management', title: 'Управление проектом', value: 4135 },
    { section: 'design', title: 'Проектная документация и дизайн-проект', value: 7559 },
    { section: 'general', title: 'Общестроительные работы', subItems: [
      { id: 'demolition', title: 'Демонтажные работы', optional: true, default: false, value: 3108 },
      { id: 'partitions', title: 'Перегородки и двери', value: 21993 },
      { id: 'walls', title: 'Отделка стен', value: 17899 },
      { id: 'floors', title: 'Отделка пола', value: 17158 },
      { id: 'ceilings', title: 'Потолки', value: 10303 },
      { id: 'accessories', title: 'Установка аксессуаров', value: 2144 },
      { id: 'furniture', title: 'Встраиваемая мебель и бытовая техника', value: 15791 },
      { id: 'signage', title: 'Установка вывесок и логотипов', value: 1450 },
    ] },
    { section: 'electrical', title: 'Электрические и слаботочные системы', subItems: [
      { id: 'power', title: 'Электроснабжение и розетки', value: 17432 },
      { id: 'lighting', title: 'Система освещения', value: 17132 },
      { id: 'fire_alarm', title: 'Пожарная сигнализация и СОУЭ', value: 5721 },
      { id: 'scs', title: 'СКС и пассивное IT-оборудование', value: 9189 },
      { id: 'access', title: 'Контроль доступа', optional: true, value: 4994 },
      { id: 'cctv', title: 'Видеонаблюдение', optional: true, value: 5058 },
      { id: 'security', title: 'Охранная сигнализация', optional: true, value: 2132 },
      { id: 'bms', title: 'Система диспетчеризации (BMS)', value: 11049 },
    ] },
    { section: 'mechanical', title: 'Механические системы', subItems: [
      { id: 'ventilation', title: 'Вентиляция', value: 12693 },
      { id: 'climate', title: 'Кондиционирование', value: 16977 },
      { id: 'heating', title: 'Отопление', value: 4380 },
      { id: 'water', title: 'Водоснабжение и канализация', value: 7241 },
      { id: 'fire_pipe', title: 'Противопожарный водопровод', value: 1114 },
      { id: 'gas_extinguishing', title: 'Система газового пожаротушения', value: 1151 },
      { id: 'smoke_removal', title: 'Система дымоудаления', optional: true, value: 586 },
    ] },
  ],
};

export const OFFICE_SECTION_META = {
  management: { title: 'Управление проектом', icon: '📋' },
  design: { title: 'Проектная документация и дизайн-проект', icon: '📐' },
  general: { title: 'Общестроительные работы', icon: '🏗️' },
  furniture: { title: 'Мебель', icon: '🪑' },
  electrical: { title: 'Электрические и слаботочные системы', icon: '⚡' },
  mechanical: { title: 'Механические системы', icon: '🌬️' },
};

// ── Scale coefficients for large offices (5 000 – 50 000 м²) ──────────
// Zone 1: area ≤ flatRateMax  → multiplier = 1.0  (flat rates as-is)
// Zone 2: flatRateMax < area < scaleRateMin → linear interpolation
// Zone 3: area ≥ scaleRateMin → power-law scale  (refArea / area)^alpha
//
// Finish (general/furniture/management/design):
//   Volume discount — larger area → cheaper per-m² finish.
//   Formula: (finishRefArea / area)^finishAlpha
//
// Engineering (electrical + mechanical):
//   Rates calibrated from 43 672 m² reference building.
//   Formula: targetPerM2_inflated × (refArea / area)^alpha / baselinePerM2
//   baselinePerM2 = sum of all electrical+mechanical raw values × inflation
//   (computed at runtime so it stays in sync with OFFICE_BUDGET_RAW)

export const OFFICE_SCALE_CONFIG = {
  flatRateMax: 5000,     // м² — below this, rates unchanged
  scaleRateMin: 10000,   // м² — above this, full scale formula
  // Finish sections — applies to standard & business & premium
  finish: {
    alpha: 0.06,
    refArea: 5000,       // anchor point where mult = 1.0
  },
  // Engineering sections — per-tier calibration
  engineering: {
    standard: {
      refArea: 19226,        // Технопарк, надземная часть
      alpha: 0.20,
      targetPerM2: 32434,    // ₽/м² (механика 11 216 + ЭОМ 21 218)
    },
    business: {
      refArea: 43672,        // reference building area
      alpha: 0.20,
      targetPerM2: 42531,    // ₽/м² from engineering files (before inflation)
    },
    premium: {
      refArea: 43672,        // same ref as business (no separate file)
      alpha: 0.20,
      targetPerM2: 69932,    // extrapolated: baseline 116 849 × 0.5985 (business ratio)
    },
  },
};
