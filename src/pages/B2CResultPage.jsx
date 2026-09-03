import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import Btn from '../components/Btn';
import { C } from '../lib/theme';
import { formatRub, formatDays } from '../lib/calculator';

export default function B2CResultPage() {
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('rpkm-last-b2c');
      if (raw) setLead(JSON.parse(raw));
    } catch {}
  }, []);

  if (!lead) {
    return (
      <PageLayout>
        <div className="quiz-page">
          <div className="quiz-wrap">
            <div className="quiz-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <h2>Расчёт не найден</h2>
              <p style={{ color: C.gray500, margin: '12px 0 24px' }}>Возможно, сессия истекла. Сделайте новый расчёт.</p>
              <Btn variant="terra" onClick={() => navigate('/b2c')}>Перейти к калькулятору</Btn>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  const r = lead.result;
  const colors = { works: '#c97b48', rough: '#8b6f5a', finish: '#3b5a87' };
  const labels = { works: 'Работы', rough: 'Черновые', finish: 'Чистовые' };
  const breakdownItems = [
    ['Работы', r.breakdown.works, 'Демонтаж, подготовка, монтаж'],
    ['Черновые материалы', r.breakdown.rough, 'Стяжка, штукатурка, проводка, трубы'],
    ['Чистовые материалы', r.breakdown.finish, 'Краска, плитка, ламинат, сантехника'],
  ];

  return (
    <PageLayout>
      <div className="quiz-page">
        <div className="quiz-wrap">
          <div className="quiz-card">
            {/* Hero */}
            <div className="result-hero">
              <div className="result-label">Ваш ориентировочный расчёт</div>
              <div className="result-price">
                <span className="accent">{formatRub(r.totalLow)}</span> — <span className="accent">{formatRub(r.totalHigh)}</span>
              </div>
              {lead.contact?.email && (
                <div style={{ fontSize: 13, color: C.gray500, marginTop: 8 }}>
                  Копия расчёта отправлена на {lead.contact.email}
                </div>
              )}
              <div className="result-disclaimer">
                <strong>Расчёт носит предварительный характер.</strong> Это вилка стоимости на основе
                средней цены 1 м² и факторов сложности. Итоговая смета зависит от конкретных
                материалов и подрядчика.
              </div>
            </div>

            {/* Bar */}
            <h3 style={{ marginBottom: 12 }}>Разбивка стоимости</h3>
            <div className="result-bar">
              {['works', 'rough', 'finish'].map(k => {
                const pct = Math.round(r.breakdown[k].pct * 100);
                return <div key={k} className="result-bar-segment" style={{ background: colors[k], flex: pct }}>{pct}% {labels[k]}</div>;
              })}
            </div>

            {/* Breakdown */}
            <div className="result-breakdown">
              {breakdownItems.map(([label, b, sub]) => (
                <div key={label} className="breakdown-row">
                  <div>
                    <div className="breakdown-label">{label}</div>
                    <div className="breakdown-sub">{sub}</div>
                  </div>
                  <div>
                    <div className="breakdown-amount">{formatRub(b.low)} — {formatRub(b.high)}</div>
                    <div className="breakdown-amount-sub">{Math.round(b.pct * 100)}% от сметы</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Meta */}
            <h3 style={{ marginTop: 28, marginBottom: 12 }}>Параметры расчёта</h3>
            <div className="result-meta">
              <div><div className="meta-item-label">Площадь</div><div className="meta-item-value">{r.area} м²</div></div>
              <div><div className="meta-item-label">Категория</div><div className="meta-item-value">{r.tierLabel}</div></div>
              <div><div className="meta-item-label">Цена за м²</div><div className="meta-item-value">{r.lowPerM2.toLocaleString('ru-RU')}–{r.highPerM2.toLocaleString('ru-RU')} ₽</div></div>
            </div>

            <div className="alert alert-info">
              <strong>Сроки реализации:</strong> {formatDays(r.days)}.
              Оценка по типовому графику работ.
            </div>

            {/* CTA */}
            <div className="result-cta">
              <h3>Нужна детальная смета?</h3>
              <p>Расчёт по ~50 позициям с разбивкой на работы и материалы — в подписке Клуба владельцев.</p>
              <Btn variant="terra" size="lg" onClick={() => navigate('/b2c-detail')}>Открыть детальную смету</Btn>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
