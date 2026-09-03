import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, User } from 'lucide-react';
import { C } from '../lib/theme';
import { useAuth } from '../lib/auth';
import Btn from './Btn';

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  // Handle hash scroll after navigation
  const scrollToHash = useCallback((hash) => {
    const id = hash.replace('#', '');
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      return true;
    }
    return false;
  }, []);

  const handleNavClick = useCallback((e, to) => {
    // Check if link has a hash (e.g. "/#hero" or "/#pricing")
    const hashIdx = to.indexOf('#');
    if (hashIdx === -1) return; // normal link, let React Router handle

    e.preventDefault();
    const path = to.slice(0, hashIdx) || '/';
    const hash = to.slice(hashIdx);

    if (location.pathname === path) {
      // Already on the right page — just scroll
      scrollToHash(hash);
    } else {
      // Navigate first, then scroll after render
      navigate(path);
      setTimeout(() => scrollToHash(hash), 100);
    }
  }, [location.pathname, navigate, scrollToHash]);

  const links = [
    { label: "Калькулятор", to: "/#hero" },
    { label: "Категории", to: "/#pricing" },
    { label: "Программы", to: "/club" },
  ];

  return (
    <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: scrolled ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.5)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderBottom: scrolled ? "1px solid rgba(0,0,0,0.05)" : "1px solid transparent", transition: "all 0.35s ease" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center", height: 72 }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{ width: 36, height: 36, background: C.graphiteLight, borderRadius: 8, display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: 15 }} className="font-golos">Р</div>
          <span className="font-golos" style={{ fontWeight: 700, fontSize: 18, color: C.graphiteLight, letterSpacing: "-0.02em" }}>РПКМ</span>
        </Link>

        <nav className="desktop-only" style={{ display: "flex", gap: 32, alignItems: "center" }}>
          {links.map(l => (
            <Link key={l.to} to={l.to} className="nav-link" style={{ color: C.gray500, fontSize: 15, fontWeight: 500, textDecoration: "none", transition: "color 0.3s", paddingBottom: 4 }}
              onClick={(e) => handleNavClick(e, l.to)}
              onMouseEnter={e => e.target.style.color = C.terra}
              onMouseLeave={e => e.target.style.color = C.gray500}
            >{l.label}</Link>
          ))}
        </nav>

        <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!loading && user ? (
            <>
              <div onClick={() => navigate(user.role === 'b2b' ? '/b2b-cabinet' : '/club')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: C.terraBg, borderRadius: 8, cursor: 'pointer', transition: 'opacity 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                <User size={16} color={C.terra} />
                <span style={{ fontSize: 13, fontWeight: 600, color: C.terra }}>{user.name || user.email.split('@')[0]}</span>
              </div>
              <button onClick={logout} style={{ background: 'none', border: 'none', color: C.gray400, fontSize: 13, cursor: 'pointer', padding: '8px 4px' }}
                onMouseEnter={e => e.target.style.color = C.terra}
                onMouseLeave={e => e.target.style.color = C.gray400}>Выйти</button>
            </>
          ) : (
            <Btn variant="dark" style={{ padding: "10px 18px", fontSize: 14 }} onClick={() => navigate('/login')}>Вход</Btn>
          )}
        </div>

        <button className="mobile-only" onClick={() => setMenuOpen(!menuOpen)} style={{ background: "none", border: "none", cursor: "pointer", padding: 8 }}>
          {menuOpen ? <X size={24} color={C.graphiteLight} /> : <Menu size={24} color={C.graphiteLight} />}
        </button>
      </div>

      {menuOpen && (
        <div className="mobile-only" style={{ background: "#fff", padding: "8px 24px 20px", borderTop: `1px solid ${C.gray100}` }}>
          {links.map(l => <Link key={l.to} to={l.to} onClick={(e) => { handleNavClick(e, l.to); setMenuOpen(false); }} style={{ display: "block", padding: "14px 0", color: C.graphiteLight, fontSize: 16, textDecoration: "none", borderBottom: `1px solid ${C.gray100}` }}>{l.label}</Link>)}
          {!loading && user ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
              <div onClick={() => { setMenuOpen(false); navigate(user.role === 'b2b' ? '/b2b-cabinet' : '/club'); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: C.terraBg, borderRadius: 8, cursor: 'pointer' }}>
                <User size={16} color={C.terra} />
                <span style={{ fontSize: 14, fontWeight: 600, color: C.terra }}>{user.name || user.email.split('@')[0]}</span>
              </div>
              <button onClick={() => { logout(); setMenuOpen(false); }} style={{ background: 'none', border: 'none', color: C.gray400, fontSize: 13, cursor: 'pointer' }}>Выйти</button>
            </div>
          ) : (
            <div style={{ marginTop: 16 }}>
              <Btn variant="dark" style={{ width: '100%', fontSize: 14 }} onClick={() => { setMenuOpen(false); navigate('/login'); }}>Вход</Btn>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const navigate = useNavigate();
  return (
    <footer style={{ background: "#111113", padding: "56px 0 28px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 40, marginBottom: 40 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, background: "rgba(255,255,255,0.1)", borderRadius: 8, display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: 14 }} className="font-golos">Р</div>
              <span className="font-golos" style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>РПКМ</span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.6, maxWidth: 300 }}>Калькулятор стоимости ремонта квартир и коммерческих помещений.</p>
          </div>
          <div>
            <h4 className="font-golos" style={{ color: "#fff", fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Калькулятор</h4>
            {[{l:"Для собственников", to:"/b2c"}, {l:"Для профи", to:"/b2b-quiz"}, {l:"Офисный fit-out", to:"/b2b-office"}].map(({l, to}, i) => (
              <Link key={i} to={to} style={{ display: "block", color: "rgba(255,255,255,0.4)", fontSize: 14, textDecoration: "none", marginBottom: 10, transition: "color 0.3s cubic-bezier(0.16,1,0.3,1), padding-left 0.3s ease" }}
                onMouseEnter={e => { e.target.style.color = C.terraLight; e.target.style.paddingLeft = "6px"; }}
                onMouseLeave={e => { e.target.style.color = "rgba(255,255,255,0.4)"; e.target.style.paddingLeft = "0"; }}
              >{l}</Link>
            ))}
          </div>
          <div>
            <h4 className="font-golos" style={{ color: "#fff", fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Программы</h4>
            {[{l:"Клуб владельцев", to:"/club"}, {l:"PRO-кабинет", to:"/pro"}].map(({l, to}, i) => (
              <Link key={i} to={to} style={{ display: "block", color: "rgba(255,255,255,0.4)", fontSize: 14, textDecoration: "none", marginBottom: 10, transition: "color 0.3s cubic-bezier(0.16,1,0.3,1), padding-left 0.3s ease" }}
                onMouseEnter={e => { e.target.style.color = C.terraLight; e.target.style.paddingLeft = "6px"; }}
                onMouseLeave={e => { e.target.style.color = "rgba(255,255,255,0.4)"; e.target.style.paddingLeft = "0"; }}
              >{l}</Link>
            ))}
          </div>
          <div>
            <h4 className="font-golos" style={{ color: "#fff", fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Контакты</h4>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, lineHeight: 1.8 }}>Поддержка по email<br />ddv1121@yandex.ru</p>
          </div>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>© 2026 РПКМ</span>
          <div style={{ display: "flex", gap: 20 }}>
            <Link to="/privacy" style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={e => e.target.style.color = "rgba(255,255,255,0.5)"}
              onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.25)"}
            >Политика конфиденциальности</Link>
            <Link to="/offer" style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={e => e.target.style.color = "rgba(255,255,255,0.5)"}
              onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.25)"}
            >Договор-оферта</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export { PageLayout };
export default function PageLayout({ children, dark = false }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header />
      <main style={{ flex: 1, paddingTop: 72, background: dark ? C.graphite : undefined }}>
        {children}
      </main>
      <Footer />
    </div>
  );
}
