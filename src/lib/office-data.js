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
      { id: 'partitions', title: 'Перегородки и двери', value: 2072 },
      { id: 'walls', title: 'Отделка стен', value: 11661 },
      { id: 'floors', title: 'Отделка пола', value: 5716 },
      { id: 'ceilings', title: 'Потолки', value: 3409 },
      { id: 'accessories', title: 'Установка аксессуаров', value: 90 },
      { id: 'furniture', title: 'Встраиваемая мебель и бытовая техника', value: 901 },
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
      { id: 'demolition', title: 'Демонтажные работы', value: 3108 },
      { id: 'partitions', title: 'Перегородки и двери', value: 13394 },
      { id: 'walls', title: 'Отделка стен', value: 9575 },
      { id: 'floors', title: 'Отделка пола', value: 9391 },
      { id: 'ceilings', title: 'Потолки', value: 5966 },
      { id: 'accessories', title: 'Установка аксессуаров', value: 533 },
      { id: 'furniture', title: 'Встраиваемая мебель и бытовая техника', value: 9770 },
      { id: 'signage', title: 'Установка вывесок и логотипов', value: 1176 },
    ] },
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
      { id: 'demolition', title: 'Демонтажные работы', value: 3108 },
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
  electrical: { title: 'Электрические и слаботочные системы', icon: '⚡' },
  mechanical: { title: 'Механические системы', icon: '🌬️' },
};
