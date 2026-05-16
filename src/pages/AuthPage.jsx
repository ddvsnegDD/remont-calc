import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Phone, User, Building2, LogIn, UserPlus, ArrowLeft, Info, Check } from 'lucide-react';
import { AuthField, AuthPasswordField } from '../components/AuthField';
import Btn from '../components/Btn';
import { C } from '../lib/theme';

function LoginScreen({ onSwitch }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: "100vh", background: C.graphite, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, position: "relative" }}>
      <div style={{ position: "absolute", top: "30%", left: "50%", width: 600, height: 600, transform: "translate(-50%, -50%)", background: "radial-gradient(circle, rgba(185,92,56,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
      <button onClick={() => navigate('/')} style={{ position: "absolute", top: 32, left: 32, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 16px", color: "rgba(255,255,255,0.5)", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontFamily: "'Inter', sans-serif", transition: "all 0.3s" }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
      ><ArrowLeft size={16} /> На главную</button>
      <div style={{ width: "100%", maxWidth: 420, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 24, padding: "48px 40px 40px", position: "relative", zIndex: 2, animation: "authCardIn 0.6s cubic-bezier(0.16,1,0.3,1), glowPulse 4s ease-in-out infinite" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 36 }}>
          <div style={{ width: 40, height: 40, background: `linear-gradient(135deg, ${C.terra}, ${C.terraLight})`, borderRadius: 10, display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: 17 }} className="font-golos">Р</div>
          <div>
            <div className="font-golos" style={{ fontWeight: 700, fontSize: 18, color: "#fff" }}>РПКМ</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Кабинет профи</div>
          </div>
        </div>
        <h2 className="font-golos" style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 6 }}>Добро пожаловать</h2>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", marginBottom: 36, lineHeight: 1.5 }}>Войдите, чтобы получить доступ к PRO-инструментам и партнёрскому кабинету.</p>
        <form onSubmit={e => { e.preventDefault(); navigate('/b2b-cabinet'); }}>
          <AuthField icon={Mail} label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} dark />
          <AuthPasswordField label="Пароль" value={password} onChange={e => setPassword(e.target.value)} dark />
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 28, marginTop: -12 }}>
            <button type="button" style={{ background: "none", border: "none", color: C.terra, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif", padding: 0 }}>Забыли пароль?</button>
          </div>
          <button type="submit" style={{ width: "100%", padding: "16px", background: `linear-gradient(135deg, ${C.terra}, ${C.terraHover})`, color: "#fff", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "all 0.3s", boxShadow: `0 4px 20px ${C.terraGlow}` }}>
            <LogIn size={18} /> Войти
          </button>
        </form>
        <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "28px 0" }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.1em" }}>или</span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
        </div>
        <button type="button" onClick={onSwitch} style={{ width: "100%", padding: "14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 15, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "all 0.3s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
        ><UserPlus size={18} /> Стать партнёром</button>
        <div style={{ marginTop: 24, padding: "14px 16px", background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.12)", borderRadius: 12, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <Info size={16} style={{ color: "rgba(147,197,253,0.7)", flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 13, color: "rgba(147,197,253,0.6)", lineHeight: 1.5 }}>Это демо-проект. Вход не требует реальных данных.</span>
        </div>
      </div>
    </div>
  );
}

function RegisterScreen({ onSwitch }) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: "100vh", background: C.graphite, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, position: "relative" }}>
      <div style={{ position: "absolute", top: "35%", left: "50%", width: 700, height: 700, transform: "translate(-50%, -50%)", background: "radial-gradient(circle, rgba(185,92,56,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />
      <button onClick={() => navigate('/')} style={{ position: "absolute", top: 32, left: 32, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 16px", color: "rgba(255,255,255,0.5)", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontFamily: "'Inter', sans-serif", transition: "all 0.3s" }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
      ><ArrowLeft size={16} /> На главную</button>
      <div style={{ width: "100%", maxWidth: 480, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 24, padding: "44px 40px 36px", position: "relative", zIndex: 2, animation: "authCardIn 0.6s cubic-bezier(0.16,1,0.3,1), glowPulse 4s ease-in-out infinite" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
          <div style={{ width: 40, height: 40, background: `linear-gradient(135deg, ${C.terra}, ${C.terraLight})`, borderRadius: 10, display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: 17 }} className="font-golos">Р</div>
          <div>
            <div className="font-golos" style={{ fontWeight: 700, fontSize: 18, color: "#fff" }}>РПКМ</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Регистрация</div>
          </div>
        </div>
        <h2 className="font-golos" style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginBottom: 6 }}>Станьте партнёром</h2>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", marginBottom: 32, lineHeight: 1.5 }}>Зарегистрируйтесь и получите доступ к партнёрской программе.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32 }}>
          {["5% от чека", "PRO-кабинет", "White-label PDF"].map((b, i) => (
            <span key={i} style={{ padding: "6px 14px", background: "rgba(185,92,56,0.1)", border: "1px solid rgba(185,92,56,0.2)", borderRadius: 20, fontSize: 12, fontWeight: 600, color: C.terraLight }}>{b}</span>
          ))}
        </div>
        <form onSubmit={e => { e.preventDefault(); if (agreed) navigate('/b2b-cabinet'); }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
            <AuthField icon={User} label="Имя" value={name} onChange={e => setName(e.target.value)} dark />
            <AuthField icon={Building2} label="Компания" value={company} onChange={e => setCompany(e.target.value)} dark />
          </div>
          <AuthField icon={Mail} label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} dark />
          <AuthField icon={Phone} label="Телефон" type="tel" value={phone} onChange={e => setPhone(e.target.value)} dark />
          <AuthPasswordField label="Придумайте пароль" value={password} onChange={e => setPassword(e.target.value)} dark />
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 28 }}>
            <div onClick={() => setAgreed(!agreed)} style={{ width: 22, height: 22, borderRadius: 6, border: agreed ? "none" : "2px solid rgba(255,255,255,0.15)", background: agreed ? C.terra : "transparent", display: "grid", placeItems: "center", cursor: "pointer", transition: "all 0.25s", flexShrink: 0, marginTop: 1 }}>
              {agreed && <Check size={14} color="#fff" strokeWidth={3} />}
            </div>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>Соглашаюсь с <span style={{ color: C.terraLight, cursor: "pointer" }}>условиями использования</span></span>
          </div>
          <button type="submit" style={{ width: "100%", padding: "16px", background: agreed ? `linear-gradient(135deg, ${C.terra}, ${C.terraHover})` : "rgba(255,255,255,0.06)", color: agreed ? "#fff" : "rgba(255,255,255,0.25)", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: agreed ? "pointer" : "not-allowed", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "all 0.4s", boxShadow: agreed ? `0 4px 20px ${C.terraGlow}` : "none" }}>
            <UserPlus size={18} /> Зарегистрироваться
          </button>
        </form>
        <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "24px 0" }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.1em" }}>или</span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
        </div>
        <button type="button" onClick={onSwitch} style={{ width: "100%", padding: "14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 15, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "all 0.3s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
        ><LogIn size={18} /> Уже есть аккаунт? Войти</button>
        <div style={{ marginTop: 20, padding: "14px 16px", background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.12)", borderRadius: 12, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <Info size={16} style={{ color: "rgba(147,197,253,0.7)", flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 13, color: "rgba(147,197,253,0.6)", lineHeight: 1.5 }}>Демо-проект — регистрация не создаёт реальный аккаунт.</span>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  return mode === "login"
    ? <LoginScreen onSwitch={() => setMode("register")} />
    : <RegisterScreen onSwitch={() => setMode("login")} />;
}
