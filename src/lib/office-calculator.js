// Office fit-out calculator — ES module version.
import { OFFICE_TIERS, OFFICE_BUDGET_RAW, OFFICE_SECTION_META, OFFICE_INFLATION_2026, OFFICE_SCALE_CONFIG } from './office-data';

const OFFICE_MEETING_ROOM_AREA = 13;
const OFFICE_MEETING_ROOM_RATE = 30000;
const OFFICE_MEETING_ROOMS_PER_M2 = 1 / 30;
const OFFICE_SERVER_ROOM_FIXED = 200000;
const OFFICE_URGENCY_MULT = 1.07;

// ── Scale helpers ──────────────────────────────────────────────────────
const FINISH_SECTIONS = new Set(['management', 'design', 'general', 'furniture']);
const ENGINEERING_SECTIONS = new Set(['electrical', 'mechanical']);

/**
 * Sum of all electrical + mechanical raw ₽/м² for a tier (before inflation).
 * Used as denominator when computing engineering scale multiplier.
 */
function baselineEngPerM2(tier) {
  const raw = OFFICE_BUDGET_RAW[tier];
  if (!raw) return 0;
  let sum = 0;
  for (const sec of raw) {
    if (!ENGINEERING_SECTIONS.has(sec.section)) continue;
    if (sec.subItems) {
      for (const it of sec.subItems) sum += it.value;
    } else {
      sum += sec.value;
    }
  }
  return sum;
}

/**
 * Returns the scale multiplier for a given section at a given area.
 * - area ≤ flatRateMax  → 1.0
 * - flatRateMax < area < scaleRateMin → linear interpolation 1 → target
 * - area ≥ scaleRateMin → full formula
 */
function getScaleMultiplier(area, sectionKey, tier, inflation) {
  const cfg = OFFICE_SCALE_CONFIG;
  if (area <= cfg.flatRateMax) return 1.0;

  let targetMult = 1.0; // multiplier at scaleRateMin boundary

  if (FINISH_SECTIONS.has(sectionKey)) {
    // Finish: volume discount — (refArea / area)^alpha, < 1.0 for large areas
    const fullMult = Math.pow(cfg.finish.refArea / area, cfg.finish.alpha);
    if (area >= cfg.scaleRateMin) return fullMult;
    // Interpolation zone
    targetMult = Math.pow(cfg.finish.refArea / cfg.scaleRateMin, cfg.finish.alpha);
  } else if (ENGINEERING_SECTIONS.has(sectionKey)) {
    // Engineering: calibrated from reference building
    const engCfg = cfg.engineering[tier];
    if (!engCfg) return 1.0; // no config for this tier yet (e.g. standard)
    const basePerM2 = baselineEngPerM2(tier) * inflation;
    if (basePerM2 <= 0) return 1.0;
    const scaledTarget = engCfg.targetPerM2 * inflation * Math.pow(engCfg.refArea / area, engCfg.alpha);
    const fullMult = scaledTarget / basePerM2;
    if (area >= cfg.scaleRateMin) return fullMult;
    // Interpolation zone
    const boundaryTarget = engCfg.targetPerM2 * inflation * Math.pow(engCfg.refArea / cfg.scaleRateMin, engCfg.alpha);
    targetMult = boundaryTarget / basePerM2;
  } else {
    return 1.0; // unknown section — no scale
  }

  // Linear interpolation between flatRateMax and scaleRateMin
  const t = (area - cfg.flatRateMax) / (cfg.scaleRateMin - cfg.flatRateMax);
  return 1.0 + t * (targetMult - 1.0);
}

// ── Main calculator ────────────────────────────────────────────────────
export const OfficeCalc = {
  compute(inputs) {
    const tier = inputs.tier && OFFICE_TIERS[inputs.tier] ? inputs.tier : 'business';
    const tierDef = OFFICE_TIERS[tier];
    const A = Math.max(1, parseFloat(inputs.area) || 0);
    const meetingRooms = Math.max(0, parseInt(inputs.meetingRooms) || 0);
    const workplaces = Math.max(0, parseInt(inputs.workplaces) || 0);
    const serverRoom = !!inputs.serverRoom;
    const urgency = inputs.urgency === 'fast' ? 'fast' : 'standard';
    const designProject = inputs.designProject === 'have' ? 'have' : 'need';
    const excludeOptional = new Set(inputs.excludeOptional || []);
    const includeOptional = new Set(inputs.includeOptional || []);

    const inflation = OFFICE_INFLATION_2026;
    const raw = OFFICE_BUDGET_RAW[tier];
    const sections = [];

    // ── Phase 1: compute base section totals (flat rates) ──
    for (const sec of raw) {
      const meta = OFFICE_SECTION_META[sec.section];
      const sectionEntry = { key: sec.section, title: meta?.title || sec.title, icon: meta?.icon || '•', lines: [], total: 0 };

      if (sec.section === 'design' && designProject === 'have') {
        sectionEntry.skipped = true;
        sectionEntry.skipReason = 'У клиента есть готовый дизайн-проект';
        sections.push(sectionEntry);
        continue;
      }

      if (sec.subItems) {
        for (const item of sec.subItems) {
          const isOptional = !!item.optional;
          let included = true;
          if (isOptional) {
            if (item.default === false) { included = includeOptional.has(item.id); }
            else { included = !excludeOptional.has(item.id); }
          }
          if (!included) {
            sectionEntry.lines.push({ id: item.id, title: item.title, optional: true, excluded: true, perM2: 0, total: 0 });
            continue;
          }
          const perM2 = Math.round(item.value * inflation);
          const lineTotal = Math.round(perM2 * A);
          sectionEntry.lines.push({ id: item.id, title: item.title, optional: isOptional, perM2, total: lineTotal });
          sectionEntry.total += lineTotal;
        }
      } else {
        const perM2 = Math.round(sec.value * inflation);
        const lineTotal = Math.round(perM2 * A);
        sectionEntry.lines.push({ id: sec.section, title: sec.title, perM2, total: lineTotal });
        sectionEntry.total = lineTotal;
      }
      sections.push(sectionEntry);
    }

    // ── Phase 2: apply scale multipliers for large areas ──
    const scaleApplied = A > OFFICE_SCALE_CONFIG.flatRateMax;
    let mainTotal = 0;
    for (const sec of sections) {
      if (sec.skipped) continue;
      const mult = getScaleMultiplier(A, sec.key, tier, inflation);
      if (mult !== 1.0) {
        sec.scaleMult = Math.round(mult * 1000) / 1000; // store for UI
        // Recalculate totals with multiplier
        sec.total = 0;
        for (const ln of sec.lines) {
          if (ln.excluded) continue;
          ln.perM2 = Math.round(ln.perM2 * mult);
          ln.total = Math.round(ln.perM2 * A);
          sec.total += ln.total;
        }
      }
      mainTotal += sec.total;
    }

    // ── Phase 3: modifiers (meeting rooms, server, urgency) ──
    const modifiers = [];
    const baselineMR = Math.round(A * OFFICE_MEETING_ROOMS_PER_M2);
    const extraMR = Math.max(0, meetingRooms - baselineMR);
    if (extraMR > 0) {
      const cost = OFFICE_MEETING_ROOM_RATE * OFFICE_MEETING_ROOM_AREA * extraMR;
      modifiers.push({ id: 'extra_meeting_rooms', label: `Дополнительные переговорные (${extraMR} шт сверх нормы ${baselineMR})`, hint: `${extraMR} × ${OFFICE_MEETING_ROOM_AREA} м² × ${OFFICE_MEETING_ROOM_RATE.toLocaleString('ru-RU')} ₽/м²`, cost });
      mainTotal += cost;
    }
    if (serverRoom) {
      modifiers.push({ id: 'server_room', label: 'Серверная', hint: 'Стойки, спец-климат, выделенные розетки', cost: OFFICE_SERVER_ROOM_FIXED });
      mainTotal += OFFICE_SERVER_ROOM_FIXED;
    }
    if (urgency === 'fast') {
      const cost = Math.round(mainTotal * (OFFICE_URGENCY_MULT - 1));
      modifiers.push({ id: 'urgency', label: 'Срочные сроки', hint: '+7% за работу в ускоренном графике', cost });
      mainTotal += cost;
    }

    return {
      tier, tierLabel: tierDef.label,
      inputs: { area: A, meetingRooms, workplaces, serverRoom, urgency, designProject, excludeOptional: [...excludeOptional], includeOptional: [...includeOptional] },
      sections, modifiers, scaleApplied,
      totals: { main: mainTotal, reserve: 0, grand: mainTotal, perM2Main: A > 0 ? Math.round(mainTotal / A) : 0, perM2Grand: A > 0 ? Math.round(mainTotal / A) : 0 },
      baselineRate: Math.round(tierDef.pricePerM2 * inflation),
      meta: { inflation, baselineMR, extraMR },
    };
  },
};

export { OFFICE_TIERS, OFFICE_BUDGET_RAW, OFFICE_INFLATION_2026 };
