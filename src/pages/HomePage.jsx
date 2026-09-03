import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Shield, FileText, User, Clock, Calculator, Star, ArrowRight, Check, Zap, Eye, Briefcase } from 'lucide-react';
import PageLayout from '../components/Layout';
import Btn from '../components/Btn';
import SectionLabel from '../components/SectionLabel';
import { useReveal } from '../lib/hooks';
import { C } from '../lib/theme';
import { PLANS, formatPrice } from '../data/tariffs';

/* --- CalcWidget (premium glassmorphism) --- */
function CalcWidget({ area, setArea, houseType, setHouseType, calculate, estimate, fmt }) {
  return (
    <div className="premium-calc-card">
      <h2 className="font-golos" style={{ fontSize: 22, fontWeight: 700, color: C.graphiteLight, marginBottom: 4, letterSpacing: "-0.02em" }}>
        Калькулятор ремонта
      </h2>
      <p style={{ fontSize: 14, color: C.gray400, marginBottom: 28 }}>
        Моментальный расчёт стоимости вашего проекта
      </p>

      <div style={{ marginBottom: 20 }}>
        <label className="premium-label">Площадь, м²</label>
        <input type="number" className="premium-input" value={area} onChange={e => setArea(Math.max(20, Math.min(300, +e.target.value || 20)))} placeholder="Введите площадь" />
      </div>

      <div style={{ marginBottom: 28 }}>
        <label className="premium-label">Тип жилья</label>
        <select className="premium-input premium-select" value={houseType} onChange={e => setHouseType(e.target.value)}>
          <option value="nov_monolith">Новостройка · монолит</option>
          <option value="nov_panel">Новостройка · панель</option>
          <option value="vtor_panel">Вторичка · панель</option>
          <option value="vtor_stalinka">Вторичка · сталинка</option>
          <option value="vtor_monolith">Вторичка · монолит</option>
        </select>
      </div>

      <button className="premium-cta" onClick={calculate}>
        <Calculator size={18} /> Рассчитать стоимость
      </button>

      {estimate && (
        <div className="premium-estimate">
          <div style={{ fontSize: 13, color: C.gray500, marginBottom: 4 }}>Ориентировочная стоимость</div>
          <div className="font-golos" style={{ fontSize: 28, fontWeight: 800, color: C.terra, letterSpacing: "-0.02em" }}>{fmt(estimate.low)} — {fmt(estimate.high)}</div>
          <div style={{ fontSize: 13, color: C.gray500, marginTop: 6 }}>Ориентировочная вилка. Детальный расчёт — в&nbsp;калькуляторе</div>
        </div>
      )}
    </div>
  );
}

/* --- HeroSection (premium with photographic background) --- */
function HeroSection() {
  const [area, setArea] = useState(60);
  const [houseType, setHouseType] = useState("nov_monolith");
  const [estimate, setEstimate] = useState(null);
  const navigate = useNavigate();
  const calculate = () => {
    const bases = { nov_monolith: 62000, nov_panel: 55000, vtor_panel: 58000, vtor_stalinka: 68000, vtor_monolith: 64000 };
    const base = bases[houseType] || 62000;
    setEstimate({ low: Math.round(base * 0.85 * area), high: Math.round(base * 1.15 * area) });
  };
  const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace(".", ",") + " млн ₽" : n.toLocaleString("ru-RU") + " ₽";
  const [ref, vis] = useReveal();

  return (
    <section id="hero" className="premium-hero">
      {/* Photographic background */}
      <div className="premium-hero-bg">
        <img src="/images/hero-interior.jpg" alt="" loading="eager" />
      </div>

      {/* Blueprint grid overlay */}
      <div className="premium-hero-blueprint" />

      <div ref={ref} className={`premium-hero-inner reveal ${vis ? "visible" : ""}`}>
        <div className="premium-hero-grid">
          {/* Left: Content */}
          <div>
            <div className="premium-badge">
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.terra, display: "inline-block" }} />
              Онлайн-калькулятор ремонта
            </div>

            <h1 className="font-display" style={{ fontSize: "clamp(40px, 4.8vw, 62px)", lineHeight: 1.06, color: C.graphiteLight, letterSpacing: "-0.01em", marginBottom: 24, fontWeight: 600 }}>
              Рассчитайте стоимость<br />ремонта <em style={{ color: C.terra, fontStyle: "italic" }}>за&nbsp;3&nbsp;минуты</em>
            </h1>

            <div className="premium-divider" />

            <p style={{ fontSize: 17, lineHeight: 1.65, color: C.gray500, maxWidth: 440, marginBottom: 28 }}>
              Прозрачный предварительный расчёт для квартир и офисов — без скрытых смет, лишних звонков и сложных таблиц.
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 40 }}>
              {[
                { text: "Без звонка менеджеру", icon: <User size={14} /> },
                { text: "Для квартир и офисов", icon: <Briefcase size={14} /> },
                { text: "Прозрачный расчёт", icon: <Eye size={14} /> },
              ].map((item, i) => (
                <span key={i} className="premium-pill">{item.icon}{item.text}</span>
              ))}
            </div>

            <div style={{ display: "flex" }}>
              {[{ n: "5000+", l: "позиций в базе" }, { n: "~50", l: "позиций в смете" }, { n: "3 мин", l: "на расчёт" }].map((s, i) => (
                <div key={i} style={{ paddingRight: i < 2 ? 28 : 0, marginRight: i < 2 ? 28 : 0, borderRight: i < 2 ? "1px solid rgba(185,92,56,0.12)" : "none" }}>
                  <div className="font-golos" style={{ fontSize: 28, fontWeight: 800, color: C.graphiteLight, letterSpacing: "-0.02em", lineHeight: 1 }}>{s.n}</div>
                  <div style={{ fontSize: 13, color: C.gray400, marginTop: 4 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Calculator */}
          <div>
            <CalcWidget area={area} setArea={setArea} houseType={houseType} setHouseType={setHouseType} calculate={calculate} estimate={estimate} fmt={fmt} />
          </div>
        </div>
      </div>

      {/* Trust bar — bottom */}
      <div className="premium-trust-bar">
        <div className="premium-trust-item">
          <div className="premium-trust-icon"><FileText size={18} /></div>
          <span>Цены из реальных тендерных смет</span>
        </div>
        <div className="premium-trust-item">
          <div className="premium-trust-icon"><User size={18} /></div>
          <span>Без звонков и&nbsp;менеджеров</span>
        </div>
        <div className="premium-trust-item">
          <div className="premium-trust-icon"><Clock size={18} /></div>
          <span>Расчёт за 3&nbsp;минуты</span>
        </div>
      </div>
    </section>
  );
}

/* --- BentoSection --- */
function BentoSection() {
  const [ref, vis] = useReveal();
  const cards = [
    { title: "Отвечаете на вопросы", desc: "9 шагов: площадь, тип дома, перепланировка, коммуникации, отделка. Занимает 3 минуты.", icon: <Zap size={28} />, accent: C.terra, bg: C.offWhite },
    { title: "Получаете вилку цены", desc: "Ориентировочный диапазон с разбивкой на работы, черновые и чистовые материалы.", icon: <Calculator size={28} />, accent: C.terra, bg: C.offWhite },
    { title: "Открываете детальную смету", desc: "По подписке — расчёт по ~50 позициям на основе реальных тендерных цен.", icon: <FileText size={28} />, accent: C.graphiteLight, bg: C.gray100 },
  ];
  return (
    <section style={{ padding: "80px 0", background: "#fff" }}>
      <div ref={ref} style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div className={`reveal ${vis ? "visible" : ""}`} style={{ textAlign: "center", marginBottom: 48 }}>
          <SectionLabel>Процесс</SectionLabel>
          <h2 className="font-golos" style={{ fontSize: "clamp(28px, 3.5vw, 40px)", fontWeight: 800, color: C.graphiteLight }}>Как работает расчёт</h2>
        </div>
        <div className="bento-grid">
          {cards.map((c, i) => (
            <div key={i} className={`reveal ${vis ? "visible" : ""} reveal-d${i + 1}`} style={{ borderRadius: 20, padding: 32, background: c.bg, display: "flex", flexDirection: "column", justifyContent: "flex-end", position: "relative", overflow: "hidden", transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)", cursor: "pointer", border: `1px solid ${C.gray200}` }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-6px)"; e.currentTarget.style.boxShadow = "0 20px 50px rgba(0,0,0,0.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <div>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: C.terraBg, display: "grid", placeItems: "center", color: c.accent, marginBottom: 16 }}>{c.icon}</div>
                <h3 className="font-golos" style={{ fontSize: 22, fontWeight: 700, color: C.graphiteLight, marginBottom: 8 }}>{c.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: C.gray600 }}>{c.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mobile-only" style={{ display: "grid", gap: 16 }}>
          {cards.map((c, i) => (
            <div key={i} style={{ borderRadius: 16, padding: 24, background: c.bg, border: `1px solid ${C.gray200}` }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: C.terraBg, display: "grid", placeItems: "center", color: c.accent, marginBottom: 12 }}>{c.icon}</div>
              <h3 className="font-golos" style={{ fontSize: 18, fontWeight: 700, color: C.graphiteLight, marginBottom: 6 }}>{c.title}</h3>
              <p style={{ fontSize: 14, color: C.gray600, lineHeight: 1.5 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --- PricingSection --- */
function PricingSection() {
  const [ref, vis] = useReveal();
  const navigate = useNavigate();
  const tiers = [
    { name: "Эконом", price: "35–55", unit: "тыс ₽/м²", term: "3–4 мес", desc: "Базовый ремонт, бюджетные материалы", gradient: "linear-gradient(180deg, #C4B5A3 0%, #8B7D6B 100%)", tier: "capital" },
    { name: "Комфорт", price: "60–85", unit: "тыс ₽/м²", term: "4–6 мес", desc: "Современный интерьер, качественные материалы", gradient: "linear-gradient(180deg, #A0896C 0%, #6B5B45 100%)", featured: true, tier: "euro" },
    { name: "Бизнес", price: "100–150", unit: "тыс ₽/м²", term: "6–9 мес", desc: "Дизайн-проект, сложные инженерные решения", gradient: "linear-gradient(180deg, #7A8B8F 0%, #4A5A5F 100%)", tier: "euro" },
    { name: "Премиум", price: "200+", unit: "тыс ₽/м²", term: "от 9 мес", desc: "Эксклюзивные материалы, индивидуальный дизайн", gradient: "linear-gradient(180deg, rgba(40,35,30,0.3) 0%, rgba(20,18,15,0.9) 100%)", hasImage: true, tier: "premium" },
  ];
  return (
    <section id="pricing" style={{ padding: "80px 0", background: "#fff" }}>
      <div ref={ref} style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div className={`reveal ${vis ? "visible" : ""}`} style={{ textAlign: "center", marginBottom: 48 }}>
          <SectionLabel>Категории</SectionLabel>
          <h2 className="font-golos" style={{ fontSize: "clamp(28px, 3.5vw, 40px)", fontWeight: 800, color: C.graphiteLight }}>Цены по категориям ремонта</h2>
          <p style={{ color: C.gray500, marginTop: 8, fontSize: 16 }}>Ориентировочная стоимость за 1 м² и типичная длительность работ. Детальный расчёт — в калькуляторе.</p>
        </div>
        <div className="pricing-grid">
          {tiers.map((t, i) => (
            <div key={i} className={`reveal ${vis ? "visible" : ""} reveal-d${i + 1}`} style={{ position: "relative", height: 500, borderRadius: 20, overflow: "hidden", cursor: "pointer", transition: "transform 0.5s cubic-bezier(0.16,1,0.3,1), box-shadow 0.5s ease" }}
              onClick={() => navigate(`/b2c?tier=${t.tier}`)}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 20px 50px rgba(0,0,0,0.2)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <div style={{ position: "absolute", inset: 0, background: t.hasImage ? `url('/images/premium-bg.jpeg') center/cover no-repeat, ${t.gradient}` : t.gradient, transition: "transform 0.7s cubic-bezier(0.16,1,0.3,1)" }} />
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "65%", background: "linear-gradient(to top, rgba(22,22,24,0.95) 0%, transparent 100%)", opacity: 0.8 }} />
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 28 }}>
                {t.featured && <span style={{ display: "inline-block", padding: "4px 12px", background: C.terra, color: "#fff", borderRadius: 20, fontSize: 11, fontWeight: 700, marginBottom: 12 }}>ПОПУЛЯРНЫЙ</span>}
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 8 }}>{t.name}</div>
                <div className="font-golos" style={{ fontSize: 36, fontWeight: 800, color: "#fff" }}>{t.price}<span style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.6)", marginLeft: 6 }}>{t.unit}</span></div>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", margin: "10px 0 6px", lineHeight: 1.5 }}>{t.desc}</p>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 16 }}><Clock size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />{t.term}</div>
                <Btn variant="outlineLight" style={{ padding: "10px 20px", fontSize: 13, width: "100%", borderRadius: 10 }}>Выбрать <ArrowRight size={14} /></Btn>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --- GuaranteesSection --- */
function GuaranteesSection() {
  const [ref, vis] = useReveal();
  const [openIdx, setOpenIdx] = useState(0);
  const items = [
    { icon: <FileText size={22} />, title: "Реальные тендерные цены", body: "В основе — расценки из тендерных смет на объекты жилой недвижимости, включая элитную, и на отделку офисов." },
    { icon: <Eye size={22} />, title: "Прозрачная детализация", body: "Каждая позиция расписана отдельно: работа, черновые материалы, чистовые материалы." },
    { icon: <Calculator size={22} />, title: "Учёт факторов сложности", body: "Тип дома, перепланировка, замена коммуникаций, площадь — каждый фактор влияет на итог через отдельный коэффициент." },
    { icon: <Shield size={22} />, title: "Расчёт, а не заявка", body: "Результат вы получаете сразу на экране. Никто не перезвонит, чтобы «уточнить детали»." },
  ];
  return (
    <section id="basis" style={{ padding: "80px 0", background: C.offWhite }}>
      <div ref={ref} style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div className={`reveal ${vis ? "visible" : ""}`} style={{ textAlign: "center", marginBottom: 48 }}>
          <SectionLabel>Основа расчёта</SectionLabel>
          <h2 className="font-golos" style={{ fontSize: "clamp(28px, 3.5vw, 40px)", fontWeight: 800, color: C.graphiteLight }}>Почему расчёту можно доверять</h2>
        </div>
        <div className="guarantees-grid">
          <div className={`reveal ${vis ? "visible" : ""}`}>
            {items.map((item, i) => (
              <div key={i} style={{ borderBottom: `1px solid ${C.gray200}`, cursor: "pointer", padding: "0 12px", margin: "0 -12px", borderRadius: openIdx === i ? 12 : 0 }} onClick={() => setOpenIdx(openIdx === i ? -1 : i)}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 0" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: openIdx === i ? C.terraBg : C.gray100, color: openIdx === i ? C.terra : C.gray500, display: "grid", placeItems: "center", transition: "all 0.35s", flexShrink: 0 }}>{item.icon}</div>
                  <span className="font-golos" style={{ fontSize: 18, fontWeight: 600, color: openIdx === i ? C.terra : C.graphiteLight, flex: 1, transition: "color 0.3s" }}>{item.title}</span>
                  <ChevronDown size={20} style={{ color: openIdx === i ? C.terra : C.gray400, transition: "transform 0.35s", transform: openIdx === i ? "rotate(180deg)" : "rotate(0)" }} />
                </div>
                <div className={`accordion-body ${openIdx === i ? "open" : ""}`} style={{ paddingBottom: openIdx === i ? 20 : 0, paddingLeft: 58 }}>
                  <p style={{ fontSize: 15, lineHeight: 1.7, color: C.gray600 }}>{item.body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className={`reveal ${vis ? "visible" : ""} reveal-d2 guarantee-card-visual`} style={{ borderRadius: 20, height: 400, overflow: "hidden", position: "relative", background: C.graphite }}>
            <div key={openIdx} style={{ position: "relative", zIndex: 2, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "32px 36px", animation: "scaleIn 0.35s cubic-bezier(0.16,1,0.3,1)" }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(12px)", display: "grid", placeItems: "center", marginBottom: 16, color: "#fff" }}>
                {items[Math.max(0, openIdx)]?.icon || <Shield size={24} />}
              </div>
              <h3 className="font-golos" style={{ fontSize: 26, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{items[Math.max(0, openIdx)]?.title}</h3>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: "rgba(255,255,255,0.8)", maxWidth: 360 }}>{items[Math.max(0, openIdx)]?.body}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --- ClubSection --- */
function ClubSection() {
  const [ref, vis] = useReveal();
  const navigate = useNavigate();
  return (
    <section id="club" style={{ padding: "80px 0", background: "#fff" }}>
      <div ref={ref} style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div className={`reveal ${vis ? "visible" : ""}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
          <div>
            <SectionLabel>Клуб владельцев</SectionLabel>
            <h2 className="font-golos" style={{ fontSize: "clamp(26px, 3vw, 36px)", fontWeight: 800, color: C.graphiteLight, marginBottom: 16 }}>Профессиональные инструменты для вашего ремонта</h2>
            <div style={{ display: "grid", gap: 14, marginBottom: 28 }}>
              {[
                "Детальная смета по 50 позициям с тендерными ценами",
                "Чек-листы приёмки квартиры и контроля подрядчика",
                "Консультации инженера — до 3 вопросов в месяц",
                "Закрытые разборы объектов с реальными бюджетами",
              ].map((txt, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: C.terraBg, color: C.terra, display: "grid", placeItems: "center", flexShrink: 0, marginTop: 1 }}><Check size={12} strokeWidth={3} /></div>
                  <span style={{ fontSize: 15, color: C.gray600, lineHeight: 1.5 }}>{txt}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={`reveal ${vis ? "visible" : ""} reveal-d2`} style={{ background: C.offWhite, borderRadius: 20, padding: 32, border: `1px solid ${C.gray200}` }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: C.gray500, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Подписка</div>
              <div className="font-golos" style={{ fontSize: 48, fontWeight: 800, color: C.graphiteLight, lineHeight: 1 }}>{formatPrice(PLANS.club_monthly.price)} <span style={{ fontSize: 20, fontWeight: 600 }}>₽/мес</span></div>
              <div style={{ fontSize: 14, color: C.gray400, marginTop: 8 }}>или {formatPrice(PLANS.club_yearly.price)} ₽/год <span style={{ color: C.terra, fontWeight: 600 }}>−17%</span></div>
            </div>
            <div style={{ background: "#fff", borderRadius: 16, padding: 20, marginBottom: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
              {[
                { icon: "📋", text: "Детальная смета ~50 позиций" },
                { icon: "💬", text: "3 консультации инженера/мес" },
                { icon: "✅", text: "Чек-листы приёмки и контроля" },
                { icon: "🎓", text: "Закрытые разборы объектов" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: i < 3 ? `1px solid ${C.gray100}` : "none" }}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <span style={{ fontSize: 14, color: C.gray600 }}>{item.text}</span>
                </div>
              ))}
            </div>
            <Btn variant="terra" style={{ width: "100%", padding: 14 }} onClick={() => navigate('/club')}>Попробовать 14 дней бесплатно</Btn>
            <div style={{ fontSize: 12, color: C.gray400, textAlign: "center", marginTop: 10 }}>Отмена в любой момент · Без автосписания</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --- ProSection --- */
function ProSection() {
  const [ref, vis] = useReveal();
  const navigate = useNavigate();
  const cards = [
    { icon: <Star size={28} />, title: "PRO-кабинет", desc: "White-label PDF-сметы с логотипом вашей студии, безлимитные расчёты.", cta: "Подключить PRO", to: "/pro", price: `${formatPrice(PLANS.pro_monthly.price)} ₽/мес`, highlights: ["Безлимит расчётов", { text: "White-label PDF", soon: true }, "Экспорт CSV"] },
  ];
  return (
    <section id="pro" style={{ padding: "100px 0", position: "relative", overflow: "hidden", background: `url('/images/dark-pro-bg.jpeg') center/cover no-repeat, linear-gradient(135deg, #0F0F11 0%, #1A1A1C 30%, #222225 60%, #1A1A1C 100%)` }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(10,10,12,0.65)" }} />
      <div ref={ref} style={{ position: "relative", zIndex: 2, maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div className={`reveal ${vis ? "visible" : ""}`} style={{ textAlign: "center", marginBottom: 56 }}>
          <SectionLabel light>Для профессионалов</SectionLabel>
          <h2 className="font-golos" style={{ fontSize: "clamp(28px, 3.5vw, 42px)", fontWeight: 800, color: "#fff" }}>Территория профи</h2>
          <p style={{ color: "rgba(255,255,255,0.5)", marginTop: 8, fontSize: 16 }}>Инструменты для дизайнеров, архитекторов и технических заказчиков.</p>
        </div>
        <div className="pro-grid">
          {cards.map((c, i) => (
            <div key={i} className={`glass-card reveal ${vis ? "visible" : ""} reveal-d${i + 1}`} style={{ padding: 36, borderRadius: 24 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(185,92,56,0.15)", color: C.terra, display: "grid", placeItems: "center", marginBottom: 20 }}>{c.icon}</div>
              <h3 className="font-golos" style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{c.title}</h3>
              {c.price && <div style={{ fontSize: 14, color: C.terra, fontWeight: 600, marginBottom: 12 }}>{c.price}</div>}
              <p style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.6)", marginBottom: 20 }}>{c.desc}</p>
              <div style={{ marginBottom: 24 }}>
                {c.highlights.map((h, j) => (
                  <div key={j} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0" }}>
                    <Check size={14} style={{ color: C.terra }} />
                    <span style={{ fontSize: 14, color: "rgba(255,255,255,0.75)" }}>
                      {typeof h === "string" ? h : <>{h.text}<span style={{ color: "rgba(255,255,255,0.4)" }}> · готовится</span></>}
                    </span>
                  </div>
                ))}
              </div>
              <Btn variant="outlineLight" style={{ width: "100%", borderRadius: 12, borderColor: "rgba(185,92,56,0.4)", color: C.terraLight }} onClick={() => navigate(c.to)}>{c.cta} <ArrowRight size={14} /></Btn>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --- Main Page --- */
export default function HomePage() {
  return (
    <PageLayout>
      <HeroSection />
      <PricingSection />
      <BentoSection />
      <GuaranteesSection />
      <ClubSection />
      <ProSection />
    </PageLayout>
  );
}
