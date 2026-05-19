import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import { C } from '../lib/theme';

function formatRub(n) { return Math.round(n).toLocaleString('ru-RU') + ' ₽'; }

// Generate mock data for N days
function generateMockData(days) {
  const data = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const weekday = d.getDay();
    const base = weekday === 0 || weekday === 6 ? 0.4 : 1;
    data.push({
      date: dateStr,
      page_view: Math.round((40 + Math.random() * 80) * base),
      quiz_start: Math.round((8 + Math.random() * 20) * base),
      lead_created: Math.round((2 + Math.random() * 8) * base),
      booked: Math.round((0.5 + Math.random() * 3) * base),
    });
  }
  return data;
}

function computeKPI(byDay) {
  const totalLeads = byDay.reduce((s, d) => s + d.lead_created, 0);
  const totalViews = byDay.reduce((s, d) => s + d.page_view, 0);
  const totalQuiz = byDay.reduce((s, d) => s + d.quiz_start, 0);
  const totalBooked = byDay.reduce((s, d) => s + d.booked, 0);
  const adSpend = totalViews * 12;
  return {
    totalLeads,
    cpl: totalLeads > 0 ? Math.round(adSpend / totalLeads) : 0,
    adSpend,
    avgCheque: Math.round(3200000 + Math.random() * 2000000),
    quizConversion: totalQuiz > 0 ? Math.round(totalLeads / totalQuiz * 100) : 0,
    bookingConversion: totalLeads > 0 ? Math.round(totalBooked / totalLeads * 100) : 0,
    subscriptions: Math.round(3 + Math.random() * 8),
    subscriptionsCancelled: Math.round(Math.random() * 3),
    churnPct: Math.round(10 + Math.random() * 15),
    partners: Math.round(2 + Math.random() * 5),
    retentionWins: Math.round(Math.random() * 4),
  };
}

function renderSvgLineChart(byDay, key, color) {
  const w = 800, h = 200, padL = 36, padR = 12, padT = 16, padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const max = Math.max(1, ...byDay.map(d => d[key]));
  const stepX = byDay.length > 1 ? innerW / (byDay.length - 1) : 0;

  let grid = '';
  for (let t = 0; t <= 4; t++) {
    const y = padT + innerH - (t / 4) * innerH;
    const v = Math.round((t / 4) * max);
    grid += `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="#eef0f5" stroke-width="1"/>`;
    grid += `<text x="${padL - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="#8b91a3">${v}</text>`;
  }
  const stride = Math.max(1, Math.floor(byDay.length / 6));
  let xlabels = '';
  byDay.forEach((d, i) => {
    if (i % stride !== 0 && i !== byDay.length - 1) return;
    const x = padL + i * stepX;
    xlabels += `<text x="${x}" y="${h - 8}" text-anchor="middle" font-size="11" fill="#8b91a3">${d.date.slice(5)}</text>`;
  });
  const path = byDay.map((d, i) => {
    const x = padL + i * stepX;
    const y = padT + innerH - (d[key] / max) * innerH;
    return (i === 0 ? 'M' : 'L') + x + ',' + y;
  }).join(' ');

  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px;display:block;">
    ${grid}<path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>${xlabels}
  </svg>`;
}

function renderMultiLine(byDay) {
  const w = 800, h = 240, padL = 36, padR = 12, padT = 16, padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const series = [
    { key: 'page_view', color: '#1e3a5f' },
    { key: 'quiz_start', color: '#c97b48' },
    { key: 'booked', color: '#16794a' },
  ];
  const max = Math.max(1, ...byDay.flatMap(d => series.map(s => d[s.key])));
  const stepX = byDay.length > 1 ? innerW / (byDay.length - 1) : 0;

  let grid = '';
  for (let t = 0; t <= 4; t++) {
    const y = padT + innerH - (t / 4) * innerH;
    const v = Math.round((t / 4) * max);
    grid += `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="#eef0f5" stroke-width="1"/>`;
    grid += `<text x="${padL - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="#8b91a3">${v}</text>`;
  }
  const stride = Math.max(1, Math.floor(byDay.length / 6));
  let xlabels = '';
  byDay.forEach((d, i) => {
    if (i % stride !== 0 && i !== byDay.length - 1) return;
    const x = padL + i * stepX;
    xlabels += `<text x="${x}" y="${h - 8}" text-anchor="middle" font-size="11" fill="#8b91a3">${d.date.slice(5)}</text>`;
  });
  let lines = '';
  for (const s of series) {
    const path = byDay.map((d, i) => {
      const x = padL + i * stepX;
      const y = padT + innerH - (d[s.key] / max) * innerH;
      return (i === 0 ? 'M' : 'L') + x + ',' + y;
    }).join(' ');
    lines += `<path d="${path}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round"/>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px;display:block;">${grid}${lines}${xlabels}</svg>`;
}

function renderBarChart(items, color) {
  const max = Math.max(1, ...items.map(i => i.value));
  return items.map((it, i) => (
    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
      <div style={{ width: 90, fontSize: 13, color: C.gray600, textAlign: 'right', flexShrink: 0 }}>{it.label}</div>
      <div style={{ flex: 1, height: 24, background: C.gray100, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${(it.value / max) * 100}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
      <div style={{ width: 40, fontSize: 13, fontWeight: 600 }}>{it.value}</div>
    </div>
  ));
}

function renderFunnel(byDay) {
  const totalViews = byDay.reduce((s, d) => s + d.page_view, 0);
  const totalQuiz = byDay.reduce((s, d) => s + d.quiz_start, 0);
  const totalLeads = byDay.reduce((s, d) => s + d.lead_created, 0);
  const totalBooked = byDay.reduce((s, d) => s + d.booked, 0);
  const steps = [
    { label: 'Просмотры', value: totalViews },
    { label: 'Запуск квиза', value: totalQuiz },
    { label: 'Лиды', value: totalLeads },
    { label: 'Записи на замер', value: totalBooked },
  ];
  const max = steps[0].value || 1;
  return steps.map((s, i) => {
    const pct = Math.round(s.value / max * 100);
    return (
      <div key={i} style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
          <span>{s.label}</span><span style={{ fontWeight: 600 }}>{s.value} ({pct}%)</span>
        </div>
        <div style={{ height: 20, background: C.gray100, borderRadius: 4 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: C.terra, borderRadius: 4, opacity: 1 - i * 0.15 }} />
        </div>
      </div>
    );
  });
}

export default function DashboardPage() {
  const [days, setDays] = useState(30);
  const byDay = useMemo(() => generateMockData(days), [days]);
  const kpi = useMemo(() => computeKPI(byDay), [byDay]);

  const tiers = useMemo(() => {
    return [
      { label: 'Капитальный', value: Math.round(kpi.totalLeads * 0.45) },
      { label: 'Евроремонт', value: Math.round(kpi.totalLeads * 0.30) },
      { label: 'Премиум', value: Math.round(kpi.totalLeads * 0.15) },
      { label: 'Косметический', value: Math.round(kpi.totalLeads * 0.10) },
    ];
  }, [kpi]);

  const cplColor = kpi.cpl <= 1500 ? '#16794a' : kpi.cpl <= 3000 ? '#8a4a00' : '#c4314b';
  const churnColor = kpi.churnPct > 20 ? '#c4314b' : kpi.churnPct > 10 ? '#8a4a00' : '#16794a';

  return (
    <PageLayout>
      <main className="dashboard-page">
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
            <div>
              <span className="section-label">Дашборд</span>
              <h1 style={{ fontSize: 32, margin: '4px 0 6px' }}>Аналитика воронок</h1>
              <p style={{ color: C.gray500, margin: 0 }}>Показатели за {days} дней.</p>
            </div>
            <div className="dash-range">
              {[7, 14, 30].map(d => (
                <button key={d} className={days === d ? 'active' : ''} onClick={() => setDays(d)}>{d} дней</button>
              ))}
            </div>
          </div>

          {/* KPI */}
          <div className="kpi-grid">
            <div className="kpi-tile"><div className="kpi-label">Лиды</div><div className="kpi-value">{kpi.totalLeads}</div><div className="kpi-sub">за {days} дней</div></div>
            <div className="kpi-tile"><div className="kpi-label">CPL</div><div className="kpi-value" style={{ color: cplColor }}>{formatRub(kpi.cpl)}</div><div className="kpi-sub">бюджет {formatRub(kpi.adSpend)} ÷ {kpi.totalLeads}</div></div>
            <div className="kpi-tile"><div className="kpi-label">Средний чек</div><div className="kpi-value">{formatRub(kpi.avgCheque)}</div><div className="kpi-sub">по расчётам</div></div>
            <div className="kpi-tile"><div className="kpi-label">Конверсия квиз→лид</div><div className="kpi-value">{kpi.quizConversion}%</div><div className="kpi-sub">от запусков</div></div>
            <div className="kpi-tile"><div className="kpi-label">Конверсия в запись</div><div className="kpi-value">{kpi.bookingConversion}%</div><div className="kpi-sub">из лидов</div></div>
            <div className="kpi-tile"><div className="kpi-label">Подписки</div><div className="kpi-value">{kpi.subscriptions}</div><div className="kpi-sub">Club + PRO</div></div>
            <div className="kpi-tile"><div className="kpi-label">Churn</div><div className="kpi-value" style={{ color: churnColor }}>{kpi.churnPct}%</div><div className="kpi-sub">{kpi.subscriptionsCancelled} отмен</div></div>
            <div className="kpi-tile"><div className="kpi-label">Партнёры</div><div className="kpi-value">{kpi.partners}</div><div className="kpi-sub">регистраций</div></div>
            <div className="kpi-tile"><div className="kpi-label">Дожим сработал</div><div className="kpi-value">{kpi.retentionWins}</div><div className="kpi-sub">офферов принято</div></div>
          </div>

          {/* Line chart */}
          <div className="dash-card">
            <div className="dash-card-head">
              <h3>Лиды по дням</h3>
              <div className="dash-card-sub">Создано заявок (B2C + B2B)</div>
            </div>
            <div dangerouslySetInnerHTML={{ __html: renderSvgLineChart(byDay, 'lead_created', '#c97b48') }} />
            <div className="dash-legend">
              <span><span className="legend-dot" style={{ background: C.terra }} />Лиды</span>
            </div>
          </div>

          {/* Two-column */}
          <div className="dash-row">
            <div className="dash-card">
              <div className="dash-card-head"><h3>Воронка квиза</h3><div className="dash-card-sub">От просмотра до записи на замер</div></div>
              {renderFunnel(byDay)}
            </div>
            <div className="dash-card">
              <div className="dash-card-head"><h3>Категории ремонта</h3><div className="dash-card-sub">Распределение лидов</div></div>
              {renderBarChart(tiers, C.terra)}
            </div>
          </div>

          {/* Multi-line */}
          <div className="dash-card">
            <div className="dash-card-head"><h3>Активность по дням</h3><div className="dash-card-sub">Просмотры, квизы, записи</div></div>
            <div dangerouslySetInnerHTML={{ __html: renderMultiLine(byDay) }} />
            <div className="dash-legend">
              <span><span className="legend-dot" style={{ background: '#1e3a5f' }} />Просмотры</span>
              <span><span className="legend-dot" style={{ background: '#c97b48' }} />Квизы</span>
              <span><span className="legend-dot" style={{ background: '#16794a' }} />Записи</span>
            </div>
          </div>

        </div>
      </main>
    </PageLayout>
  );
}
