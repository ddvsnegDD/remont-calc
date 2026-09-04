// Иллюстрации для секции «Почему расчёту можно доверять» на главной.
// Рисуются фоновым слоем тёмной карточки, поверх идёт градиентное затемнение,
// а ниже — иконка, заголовок и текст пункта (начинаются примерно с 185px из 400).
// Поэтому вся смысловая часть рисунка держится в полосе y ≈ 20…155.

const SVG_PROPS = {
  viewBox: '0 0 560 400',
  preserveAspectRatio: 'xMidYMin slice',
  style: { position: 'absolute', inset: 0, width: '100%', height: '100%' },
  'aria-hidden': 'true',
};

const FONT = "'Inter', system-ui, sans-serif";
const TERRA = '#B95C38';
const TERRA_LIGHT = '#D4845F';

// Цвета статей совпадают с разбивкой в результатах расчёта (B2CResultPage)
const WORKS = '#C97B48';
const ROUGH = '#8B6F5A';
const FINISH = '#3B5A87';

function Glow({ id, cx = 430, cy = 60, r = 190 }) {
  return (
    <>
      <defs>
        <radialGradient id={id}>
          <stop offset="0%" stopColor={TERRA} stopOpacity="0.22" />
          <stop offset="100%" stopColor={TERRA} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id})`} />
    </>
  );
}

/* 1. Реальные тендерные цены — распределение расценок и вилка расчёта */
export function TenderPricesVisual() {
  const base = 150;
  const cols = [
    { x: 64, h: 30 }, { x: 112, h: 48 }, { x: 160, h: 70 }, { x: 208, h: 96 },
    { x: 256, h: 114 }, { x: 304, h: 102 }, { x: 352, h: 78 }, { x: 400, h: 52 }, { x: 448, h: 32 },
  ];
  const bandX = 196, bandW = 194;
  return (
    <svg {...SVG_PROPS}>
      <Glow id="glowTender" />
      <rect x={bandX} y="36" width={bandW} height={base - 36} fill={TERRA} fillOpacity="0.13" rx="4" />
      {[bandX, bandX + bandW].map((x, i) => (
        <line key={i} x1={x} y1="36" x2={x} y2={base} stroke={TERRA} strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="5 5" />
      ))}
      {cols.map((c, i) => {
        const inside = c.x >= bandX && c.x + 30 <= bandX + bandW;
        return (
          <rect key={i} x={c.x} y={base - c.h} width="30" height={c.h} rx="4"
            fill={inside ? TERRA : '#FFFFFF'} fillOpacity={inside ? 0.85 : 0.13} />
        );
      })}
      <line x1="56" y1={base} x2="496" y2={base} stroke="#FFFFFF" strokeOpacity="0.16" strokeWidth="1" />
      <text x={bandX} y="26" fontFamily={FONT} fontSize="13" fontWeight="600" fill="#FFFFFF" fillOpacity="0.75" textAnchor="middle">48 000</text>
      <text x={bandX + bandW} y="26" fontFamily={FONT} fontSize="13" fontWeight="600" fill="#FFFFFF" fillOpacity="0.75" textAnchor="middle">76 000 ₽/м²</text>
    </svg>
  );
}

/* 2. Прозрачная детализация — каждая позиция разложена на работу и материалы */
export function BreakdownVisual() {
  const rows = [
    { label: 128, parts: [0.45, 0.3, 0.25] },
    { label: 96, parts: [0.62, 0.23, 0.15] },
    { label: 142, parts: [0.34, 0.41, 0.25] },
  ];
  const barX = 236, barW = 260, gap = 3;
  const legend = [
    { c: WORKS, t: 'работа', x: 64 },
    { c: ROUGH, t: 'черновые', x: 168 },
    { c: FINISH, t: 'чистовые', x: 292 },
  ];
  return (
    <svg {...SVG_PROPS}>
      <Glow id="glowBreakdown" />
      {legend.map((l, i) => (
        <g key={i}>
          <circle cx={l.x} cy="30" r="5" fill={l.c} />
          <text x={l.x + 12} y="35" fontFamily={FONT} fontSize="12" fill="#FFFFFF" fillOpacity="0.6">{l.t}</text>
        </g>
      ))}
      {rows.map((r, i) => {
        const y = 58 + i * 34;
        let cursor = barX;
        return (
          <g key={i}>
            <rect x="64" y={y + 3} width={r.label} height="8" rx="4" fill="#FFFFFF" fillOpacity="0.16" />
            {r.parts.map((p, j) => {
              const w = barW * p - gap;
              const seg = <rect key={j} x={cursor} y={y} width={w} height="14" rx="3" fill={[WORKS, ROUGH, FINISH][j]} fillOpacity="0.9" />;
              cursor += w + gap;
              return seg;
            })}
          </g>
        );
      })}
    </svg>
  );
}

/* 3. Учёт факторов сложности — базовая цена и коэффициенты поверх неё */
export function FactorsVisual() {
  const y = 108, h = 26;
  const segs = [
    { x: 64, w: 150, fill: '#FFFFFF', op: 0.14, k: null },
    { x: 218, w: 86, fill: TERRA, op: 0.35, k: '×1,15' },
    { x: 308, w: 72, fill: TERRA, op: 0.6, k: '×1,10' },
    { x: 384, w: 112, fill: TERRA, op: 0.9, k: '×1,25' },
  ];
  return (
    <svg {...SVG_PROPS}>
      <Glow id="glowFactors" cy="50" />
      {segs.map((s, i) => (
        <g key={i}>
          <rect x={s.x} y={y} width={s.w} height={h} rx="5" fill={s.fill} fillOpacity={s.op} />
          {s.k && (
            <>
              <line x1={s.x + s.w / 2} y1={y - 6} x2={s.x + s.w / 2} y2="62" stroke="#FFFFFF" strokeOpacity="0.22" strokeWidth="1" />
              <text x={s.x + s.w / 2} y="52" fontFamily={FONT} fontSize="13" fontWeight="600" fill={TERRA_LIGHT} textAnchor="middle">{s.k}</text>
            </>
          )}
        </g>
      ))}
      <text x="139" y={y + 17} fontFamily={FONT} fontSize="12" fill="#FFFFFF" fillOpacity="0.55" textAnchor="middle">база</text>
    </svg>
  );
}

/* 4. Расчёт, а не заявка — результат появляется на экране, без звонков */
export function InstantResultVisual() {
  return (
    <svg {...SVG_PROPS}>
      <Glow id="glowInstant" cx="300" cy="50" r="210" />
      <rect x="88" y="24" width="384" height="128" rx="14" fill="#FFFFFF" fillOpacity="0.05" stroke="#FFFFFF" strokeOpacity="0.14" />
      <line x1="88" y1="54" x2="472" y2="54" stroke="#FFFFFF" strokeOpacity="0.1" strokeWidth="1" />
      {[108, 124, 140].map((cx, i) => <circle key={i} cx={cx} cy="39" r="4" fill="#FFFFFF" fillOpacity="0.18" />)}
      <rect x="384" y="66" width="72" height="22" rx="11" fill={TERRA} fillOpacity="0.2" />
      <text x="420" y="81" fontFamily={FONT} fontSize="11" fontWeight="600" fill={TERRA_LIGHT} textAnchor="middle">сразу</text>
      <text x="116" y="78" fontFamily={FONT} fontSize="12" fill="#FFFFFF" fillOpacity="0.45">ваш расчёт</text>
      <text x="116" y="112" fontFamily={FONT} fontSize="26" fontWeight="700" fill={TERRA_LIGHT}>2 480 000 ₽</text>
      <rect x="116" y="128" width="280" height="6" rx="3" fill="#FFFFFF" fillOpacity="0.12" />
      <rect x="176" y="128" width="150" height="6" rx="3" fill={TERRA} />
      {[176, 326].map((cx, i) => <circle key={i} cx={cx} cy="131" r="5" fill={TERRA_LIGHT} />)}
    </svg>
  );
}
