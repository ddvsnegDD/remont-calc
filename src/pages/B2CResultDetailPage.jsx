import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import Btn from '../components/Btn';
import { C } from '../lib/theme';
import { generateB2CDetailReportHTML, openReportWindow } from '../lib/estimateReport';
import { positions } from '../lib/plural';
import { tierTitle } from '../data/tierNames';

function formatRub(n) {
  if (!Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('ru-RU') + ' ₽';
}

export default function B2CResultDetailPage() {
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [openGroups, setOpenGroups] = useState(new Set([0]));

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('rpkm-last-b2c-detail');
      if (raw) setLead(JSON.parse(raw));
    } catch {}
  }, []);

  const toggleGroup = (i) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  if (!lead) {
    return (
      <PageLayout>
        <div className="quiz-page">
          <div className="quiz-wrap" style={{ maxWidth: 920 }}>
            <div className="quiz-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <h2>Расчёт не найден</h2>
              <p style={{ color: C.gray500, margin: '12px 0 24px' }}>Возможно, сессия истекла.</p>
              <Btn variant="terra" onClick={() => navigate('/b2c-detail')}>К детальному расчёту</Btn>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  const r = lead.result;
  const inp = r.inputs;

  // Режим показываем только на уровнях, где он влияет на состав и человек его
  // выбирал. На косметическом и премиуме он задан жёстко — см. MODE_LOCKED_TIERS
  // в B2CDetailPage.jsx, часть 7. Список дублируется в estimateReport.js
  // (generateB2CDetailReportHTML) — правка одного места не забывает второе.
  const MODE_SHOWN_TIERS = ['capital', 'euro'];
  const modeLabel = r.mode === 'whitebox' ? 'White Box' : 'Полная отделка';
  const heading = MODE_SHOWN_TIERS.includes(r.tier)
    ? `Детальная смета · ${tierTitle(r.tier)} · ${modeLabel}`
    : `Детальная смета · ${tierTitle(r.tier)}`;

  // Те же уровни, что ROOMS_WINDOWS_IRRELEVANT_TIERS в B2CDetailPage.jsx (часть 7).
  const ROOMS_WINDOWS_IRRELEVANT_TIERS = ['cosmetic'];
  const showRoomsWindows = !ROOMS_WINDOWS_IRRELEVANT_TIERS.includes(r.tier);

  return (
    <PageLayout>
      <div className="quiz-page">
        <div className="quiz-wrap" style={{ maxWidth: 920 }}>
          <div className="quiz-card">
            {/* Hero */}
            <div className="result-hero">
              <div className="result-label">{heading}</div>
              <div className="result-price"><span className="accent">{formatRub(r.totals.grand)}</span></div>
              <div style={{ fontSize: 16, color: C.gray500, marginTop: 4 }}>
                {r.perM2.toLocaleString('ru-RU')} ₽/м² · {positions(r.lines.length)}
              </div>
              {lead.contact?.email && (
                <div style={{ fontSize: 13, color: C.gray500, marginTop: 8 }}>
                  Копия расчёта отправлена на {lead.contact.email}
                </div>
              )}
              <div className="result-disclaimer" style={{ fontWeight: 500 }}>
                <strong>Расчёт носит предварительный характер.</strong> Это вилка стоимости на основе
                средней цены 1 м² и факторов сложности. Итоговая смета зависит от конкретных
                материалов и подрядчика.
              </div>
            </div>

            <div style={{ textAlign: 'center', margin: '-8px 0 20px' }}>
              <Btn variant="outline" style={{ padding: '10px 20px', fontSize: 13 }} onClick={() => openReportWindow(generateB2CDetailReportHTML(lead))}>🖨️ Печать сметы</Btn>
            </div>

            {/* Meta */}
            <div className="result-meta" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
              <div><div className="meta-item-label">Площадь</div><div className="meta-item-value">{inp.area} м²</div></div>
              {showRoomsWindows && <div><div className="meta-item-label">Комнат</div><div className="meta-item-value">{inp.rooms}</div></div>}
              <div><div className="meta-item-label">Санузлов</div><div className="meta-item-value">{inp.sanitary}</div></div>
              {showRoomsWindows && <div><div className="meta-item-label">Окон</div><div className="meta-item-value">{inp.windows}</div></div>}
            </div>

            {/* Bar */}
            <h3 style={{ marginTop: 28, marginBottom: 12 }}>Работы и материалы</h3>
            <div className="result-bar">
              <div className="result-bar-segment" style={{ background: '#c97b48', flex: r.totals.worksPct }}>{r.totals.worksPct}% Работы · {formatRub(r.totals.works)}</div>
              <div className="result-bar-segment" style={{ background: '#3b5a87', flex: r.totals.matPct }}>{r.totals.matPct}% Материалы · {formatRub(r.totals.materials)}</div>
            </div>

            {/* Groups */}
            <h3 style={{ marginTop: 28, marginBottom: 12 }}>Разделы сметы</h3>
            <div className="spec-groups">
              {r.groups.map((g, i) => {
                const grandShare = Math.round(g.total / r.totals.grand * 100);
                const isOpen = openGroups.has(i);
                return (
                  <div key={i} className={`spec-group${isOpen ? ' open' : ''}`}>
                    <div className="spec-group-head" onClick={() => toggleGroup(i)}>
                      <div className="spec-group-icon">{g.icon}</div>
                      <div className="spec-group-title">
                        <div className="spec-group-name">{g.title}</div>
                        <div className="spec-group-meta">{positions(g.lines.length)} · {grandShare}% от сметы</div>
                      </div>
                      <div className="spec-group-amount">{formatRub(g.total)}</div>
                      <div className="spec-group-chevron">▾</div>
                    </div>
                    <div className="spec-group-body">
                      <div className="spec-table-scroll"><table className="spec-table">
                        <thead>
                          <tr><th>Работа</th><th>Материал</th><th>Объём</th><th>Работы</th><th>Материалы</th><th>Итого</th></tr>
                        </thead>
                        <tbody>
                          {g.lines.map((ln, j) => (
                            <tr key={j}>
                              <td>{ln.name}</td>
                              <td><span className="material-name">{ln.material || '—'}</span></td>
                              <td className="num">{ln.volume.toLocaleString('ru-RU')} {ln.unit}</td>
                              <td className="num">{formatRub(ln.workCost)}</td>
                              <td className="num">{formatRub(ln.matCost)}</td>
                              <td className="num"><strong>{formatRub(ln.total)}</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table></div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="alert alert-info" style={{ marginTop: 28 }}>
              <strong>Что дальше?</strong> Смету можно выгрузить и использовать как основу для сравнения
              предложений подрядчиков: каждая позиция расписана отдельно, объёмы и расценки видны.
            </div>

          </div>
        </div>
      </div>
    </PageLayout>
  );
}
