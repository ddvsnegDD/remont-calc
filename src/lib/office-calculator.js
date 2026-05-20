// Office fit-out calculator — ES module version.
import { OFFICE_TIERS, OFFICE_BUDGET_RAW, OFFICE_SECTION_META, OFFICE_INFLATION_2026 } from './office-data';

const OFFICE_MEETING_ROOM_AREA = 13;
const OFFICE_MEETING_ROOM_RATE = 30000;
const OFFICE_MEETING_ROOMS_PER_M2 = 1 / 30;
const OFFICE_SERVER_ROOM_FIXED = 200000;
const OFFICE_URGENCY_MULT = 1.07;


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
    let mainTotal = 0;

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
      mainTotal += sectionEntry.total;
    }

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
      sections, modifiers,
      totals: { main: mainTotal, reserve: 0, grand: mainTotal, perM2Main: A > 0 ? Math.round(mainTotal / A) : 0, perM2Grand: A > 0 ? Math.round(mainTotal / A) : 0 },
      baselineRate: Math.round(tierDef.pricePerM2 * inflation),
      meta: { inflation, baselineMR, extraMR },
    };
  },
};

export { OFFICE_TIERS, OFFICE_BUDGET_RAW, OFFICE_INFLATION_2026 };
