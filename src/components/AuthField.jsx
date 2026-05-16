import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { C } from '../lib/theme';

export function AuthField({ icon: Icon, label, type = "text", value, onChange, dark = true }) {
  const [focused, setFocused] = useState(false);
  const active = focused || value.length > 0;

  return (
    <div style={{ position: "relative", marginBottom: 28 }}>
      <label style={{
        position: "absolute", left: 0,
        top: active ? -8 : 14,
        fontSize: active ? 11 : 16,
        fontWeight: active ? 600 : 400,
        color: focused ? C.terra : (dark ? "rgba(255,255,255,0.35)" : C.gray400),
        transition: "all 0.25s cubic-bezier(0.16,1,0.3,1)",
        pointerEvents: "none",
        letterSpacing: active ? "0.04em" : 0,
        textTransform: active ? "uppercase" : "none",
        zIndex: 1,
      }}>{label}</label>
      <div className={`auth-field-wrap ${focused ? "focused" : ""}`} style={{ display: "flex", alignItems: "center", gap: 0 }}>
        <input
          type={type} value={value} onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={dark ? "auth-input" : "auth-input-light"}
          style={{ paddingRight: 36 }}
        />
        <Icon size={18} style={{
          position: "absolute", right: 0, top: 16,
          color: focused ? C.terra : (dark ? "rgba(255,255,255,0.2)" : C.gray400),
          transition: "color 0.3s, transform 0.3s",
          transform: focused ? "scale(1.1)" : "scale(1)",
        }} />
      </div>
    </div>
  );
}

export function AuthPasswordField({ label, value, onChange, dark = true }) {
  const [focused, setFocused] = useState(false);
  const [show, setShow] = useState(false);
  const active = focused || value.length > 0;

  return (
    <div style={{ position: "relative", marginBottom: 28 }}>
      <label style={{
        position: "absolute", left: 0,
        top: active ? -8 : 14,
        fontSize: active ? 11 : 16,
        fontWeight: active ? 600 : 400,
        color: focused ? C.terra : (dark ? "rgba(255,255,255,0.35)" : C.gray400),
        transition: "all 0.25s cubic-bezier(0.16,1,0.3,1)",
        pointerEvents: "none",
        letterSpacing: active ? "0.04em" : 0,
        textTransform: active ? "uppercase" : "none",
        zIndex: 1,
      }}>{label}</label>
      <div className={`auth-field-wrap ${focused ? "focused" : ""}`} style={{ display: "flex", alignItems: "center" }}>
        <input
          type={show ? "text" : "password"}
          value={value} onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={dark ? "auth-input" : "auth-input-light"}
          style={{ paddingRight: 60 }}
        />
        <button type="button" onClick={() => setShow(!show)} style={{
          position: "absolute", right: 0, top: 12,
          background: "none", border: "none", cursor: "pointer", padding: 4,
          color: focused ? C.terra : (dark ? "rgba(255,255,255,0.2)" : C.gray400),
          transition: "color 0.3s, transform 0.3s",
          transform: focused ? "scale(1.1)" : "scale(1)",
        }}>
          {show ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      </div>
    </div>
  );
}
