// Detailed estimate calculator — ES module version.
import { SPEC_GROUPS, SPEC_GROUPS_PREMIUM, SPEC_DATA } from './spec-data';

const TIER_MULTIPLIERS = {
  capital: { finish: { wp: 1.0, mp: 1.0 }, sanitary: { wp: 1.0, mp: 1.0 }, engineering: { wp: 1.0, mp: 1.0 }, rough: { wp: 1.0, mp: 1.0 }, doors: { wp: 1.0, mp: 1.0 }, windows: { wp: 1.0, mp: 1.0 } },
  euro: { finish: { wp: 1.30, mp: 2.00 }, sanitary: { wp: 1.00, mp: 2.00 }, engineering: { wp: 1.0, mp: 1.0 }, rough: { wp: 1.0, mp: 1.0 }, doors: { wp: 1.0, mp: 1.0 }, windows: { wp: 1.0, mp: 1.0 } },
};

const PREMIUM_DIRECT = { wp: 1.0, mp: 1.0 };
const PREMIUM_RESERVE_PCT = 0.05;

export const TIER_LABELS = {
  capital: 'Капитальный',
  euro: 'Евроремонт',
  premium: 'Премиум',
};

const REPLAN_SURCHARGE = {
  no:    { label: 'Не требуется',                          fixed: 0,      pct: 0,    perM2: 0,   perRoom: 0 },
  light: { label: 'Лёгкая (без затрагивания несущих)',     fixed: 80000,  pct: 0,    perM2: 0,   perRoom: 0 },
  full:  { label: 'Полная (со согласованием в МЖИ)',       fixed: 80000,  pct: 0.05, perM2: 500, perRoom: 15000 },
};

function evalVolume(expr, ctx) {
  if (typeof expr !== 'string') return parseFloat(expr) || 0;
  const asNum = parseFloat(expr);
  if (!isNaN(asNum) && String(asNum) === expr.trim()) return asNum;
  try {
    const fn = new Function('area', 'sanitary', 'windows', 'rooms', 'Math', `"use strict"; return (${expr});`);
    const v = fn(ctx.area, ctx.sanitary, ctx.windows, ctx.rooms, Math);
    return typeof v === 'number' && isFinite(v) ? v : 0;
  } catch { return 0; }
}

function roundVol(v) { return Math.round(v * 100) / 100; }

export const SpecCalc = {
  compute(inputs) {
    const { area, sanitary, windows, rooms, mode, replan, tier } = inputs;
    const A = Math.max(1, parseFloat(area) || 0);
    const S = Math.max(0, parseInt(sanitary) || 0);
    const W = Math.max(0, parseInt(windows) || 0);
    const R = Math.max(0, parseInt(rooms) || 0);
    const replanKey = REPLAN_SURCHARGE[replan] ? replan : 'no';
    const isPremium = tier === 'premium';
    const tierKey = isPremium ? 'premium' : (TIER_MULTIPLIERS[tier] ? tier : 'capital');

    const items = isPremium
      ? SPEC_DATA.premium
      : (mode === 'whitebox') ? SPEC_DATA.whitebox : SPEC_DATA.full;
    const specGroups = isPremium ? SPEC_GROUPS_PREMIUM : SPEC_GROUPS;

    const ctx = { area: A, sanitary: S, windows: W, rooms: R };
    const lines = [];
    for (const it of items) {
      const vol = evalVolume(it.vol, ctx);
      if (vol === 0 || isNaN(vol)) continue;
      const wpMult = it.wpx ? evalVolume(it.wpx, ctx) : 1;

      let effectiveWp, effectiveMp;
      if (isPremium) {
        effectiveWp = it.wp * wpMult * PREMIUM_DIRECT.wp;
        effectiveMp = it.mp * PREMIUM_DIRECT.mp;
      } else {
        const cls = it.cls || 'rough';
        const tierMult = TIER_MULTIPLIERS[tierKey];
        const tm = tierMult[cls] || tierMult.rough;
        effectiveWp = it.wp * wpMult * tm.wp;
        effectiveMp = it.mp * tm.mp;
      }

      const workCost = vol * effectiveWp;
      const matCost = vol * effectiveMp;
      lines.push({
        g: it.g, sub: it.sub, cls: it.cls || 'direct', name: it.name, material: it.mat,
        unit: it.unit, volume: roundVol(vol),
        workPrice: effectiveWp, matPrice: effectiveMp,
        unitPrice: effectiveWp + effectiveMp,
        workCost: Math.round(workCost), matCost: Math.round(matCost),
        total: Math.round(workCost + matCost),
      });
    }

    const groupMap = {};
    for (const g of specGroups) groupMap[g.prefix] = { ...g, lines: [], total: 0, workTotal: 0, matTotal: 0 };
    for (const ln of lines) {
      const g = groupMap[ln.g];
      if (!g) continue;
      g.lines.push(ln);
      g.total += ln.total;
      g.workTotal += ln.workCost;
      g.matTotal += ln.matCost;
    }
    const groups = Object.values(groupMap).filter(g => g.lines.length > 0);

    let grandTotal = lines.reduce((s, l) => s + l.total, 0);
    let workTotal = lines.reduce((s, l) => s + l.workCost, 0);
    let matTotal = lines.reduce((s, l) => s + l.matCost, 0);

    // Premium: add 5% reserve for unforeseen expenses
    if (isPremium) {
      const reserveCost = Math.round(grandTotal * PREMIUM_RESERVE_PCT);
      const reserveGroup = {
        prefix: 'reserve', title: 'Резерв на непредвиденные расходы (5%)', icon: '🛡️',
        lines: [{ g: 'reserve', sub: 'reserve', cls: 'direct', name: 'Резерв на непредвиденные расходы', material: '5% от общей сметы',
          unit: 'компл', volume: 1, workPrice: 0, matPrice: reserveCost, unitPrice: reserveCost,
          workCost: 0, matCost: reserveCost, total: reserveCost }],
        total: reserveCost, workTotal: 0, matTotal: reserveCost,
      };
      groups.push(reserveGroup);
      lines.push(reserveGroup.lines[0]);
      grandTotal += reserveCost;
      matTotal += reserveCost;
    }

    const replanDef = REPLAN_SURCHARGE[replanKey];
    let replanCost = 0;
    if (replanDef && (replanDef.fixed > 0 || replanDef.pct > 0 || replanDef.perM2 > 0 || replanDef.perRoom > 0)) {
      const approvalCost = replanDef.fixed + (replanDef.perM2 || 0) * A + (replanDef.perRoom || 0) * Math.max(0, R - 1);
      const worksCost = grandTotal * replanDef.pct;
      replanCost = Math.round(approvalCost + worksCost);
      let desc;
      if (replanDef.pct > 0 || replanDef.perM2 > 0) {
        const parts = [];
        if (replanDef.pct > 0) parts.push(`${(replanDef.pct*100).toFixed(0)}% от сметы за работы (${Math.round(worksCost).toLocaleString('ru-RU')} ₽)`);
        parts.push(`согласование в МЖИ — ${Math.round(approvalCost).toLocaleString('ru-RU')} ₽`);
        desc = parts.join(' · ');
      } else {
        desc = 'Снос ненесущих стен, возведение новых перегородок, перенос розеток';
      }
      const replanGroup = {
        prefix: 'replan', title: 'Перепланировка', icon: '🧱',
        lines: [{ g: 'replan', sub: 'replan', name: replanDef.label, material: desc, unit: 'компл', volume: 1,
          workPrice: Math.round(replanCost * 0.9), matPrice: Math.round(replanCost * 0.1), unitPrice: replanCost,
          workCost: Math.round(replanCost * 0.9), matCost: Math.round(replanCost * 0.1), total: replanCost }],
        total: replanCost, workTotal: Math.round(replanCost * 0.9), matTotal: Math.round(replanCost * 0.1),
      };
      groups.push(replanGroup);
      lines.push(replanGroup.lines[0]);
      grandTotal += replanCost;
      workTotal += replanGroup.workTotal;
      matTotal += replanGroup.matTotal;
    }

    return {
      mode, tier: tierKey, tierLabel: TIER_LABELS[tierKey],
      inputs: { area: A, sanitary: S, windows: W, rooms: R, replan: replanKey, tier: tierKey },
      replanLabel: replanDef ? replanDef.label : null, replanCost,
      lines, groups,
      totals: {
        grand: grandTotal, works: workTotal, materials: matTotal,
        worksPct: grandTotal > 0 ? Math.round(workTotal / grandTotal * 100) : 0,
        matPct: grandTotal > 0 ? Math.round(matTotal / grandTotal * 100) : 0,
      },
      perM2: A > 0 ? Math.round(grandTotal / A) : 0,
    };
  },
};
