import { C } from '../lib/theme';

const Btn = ({ children, variant = "terra", style: sx, disabled, ...rest }) => {
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    gap: 8, padding: "14px 28px", borderRadius: 10, fontWeight: 600,
    fontSize: 15, border: "none", cursor: "pointer", textDecoration: "none",
    transition: "all 0.3s cubic-bezier(0.16,1,0.3,1)",
    fontFamily: "'Inter', sans-serif", WebkitTapHighlightColor: "transparent",
  };
  const variants = {
    terra: { ...base, background: C.terra, color: "#fff", boxShadow: `0 4px 16px ${C.terraGlow}` },
    dark: { ...base, background: C.graphiteLight, color: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" },
    outline: { ...base, background: "transparent", border: `1.5px solid ${C.gray200}`, color: C.graphiteLight },
    outlineLight: { ...base, background: "transparent", border: "1.5px solid rgba(255,255,255,0.25)", color: "#fff" },
    white: { ...base, background: "#fff", color: C.graphiteLight, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  };
  const disabledStyle = disabled ? { opacity: 0.5, cursor: 'not-allowed', pointerEvents: 'none' } : {};
  return (
    <button
      disabled={disabled}
      style={{ ...variants[variant], ...disabledStyle, ...sx }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.filter = "brightness(1.1)";
        e.currentTarget.style.boxShadow = variant === "terra"
          ? `0 12px 28px ${C.terraGlow}`
          : variant === "dark" ? "0 10px 24px rgba(0,0,0,0.18)"
          : variant === "white" ? "0 10px 24px rgba(0,0,0,0.1)"
          : "0 8px 20px rgba(0,0,0,0.08)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.filter = "brightness(1)";
        e.currentTarget.style.boxShadow = variants[variant].boxShadow || "none";
      }}
      onMouseDown={e => {
        e.currentTarget.style.transform = "translateY(0) scale(0.97)";
        e.currentTarget.style.filter = "brightness(0.95)";
      }}
      onMouseUp={e => {
        e.currentTarget.style.transform = "translateY(-3px) scale(1)";
        e.currentTarget.style.filter = "brightness(1.1)";
      }}
      {...rest}
    >{children}</button>
  );
};

export default Btn;
