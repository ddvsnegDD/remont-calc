import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { C } from '../lib/theme';
import { useAuth } from '../lib/auth';
import Btn from './Btn';

export default function LoginModal({ open, onClose, onSuccess }) {
  const { sendCode, verify } = useAuth();
  const [step, setStep] = useState('email'); // email | code | success
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [consent, setConsent] = useState(false);
  const codeRef = useRef(null);

  useEffect(() => {
    if (step === 'code' && codeRef.current) codeRef.current.focus();
  }, [step]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep('email');
        setEmail('');
        setCode('');
        setError('');
        setConsent(false);
      }, 300);
    }
  }, [open]);

  const handleSendCode = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) { setError('Введите корректный email'); return; }
    if (!consent) { setError('Необходимо согласие на обработку данных'); return; }
    setError('');
    setLoading(true);
    try {
      await sendCode(email);
      setStep('code');
      setCountdown(60);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!code || code.length < 4) { setError('Введите 4-значный код'); return; }
    setError('');
    setLoading(true);
    try {
      await verify(email, code);
      setStep('success');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setError('');
    try {
      await sendCode(email);
      setCountdown(60);
    } catch (err) {
      setError(err.message);
    }
  };

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}>
      {/* Backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />

      {/* Card */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 400, background: '#fff', borderRadius: 20, padding: '36px 32px 32px', boxShadow: '0 24px 60px rgba(0,0,0,0.2)', animation: 'authCardIn 0.4s cubic-bezier(0.16,1,0.3,1)' }}
        onClick={e => e.stopPropagation()}>

        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: C.gray400, borderRadius: 8, transition: 'all 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.color = C.graphite}
          onMouseLeave={e => e.currentTarget.style.color = C.gray400}>
          <X size={20} />
        </button>

        {step === 'email' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12, textAlign: 'center' }}>🔑</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: C.graphite, textAlign: 'center', marginBottom: 8 }}>Вход в Клуб</h2>
            <p style={{ fontSize: 14, color: C.gray500, textAlign: 'center', marginBottom: 24, lineHeight: 1.5 }}>
              Укажите email — отправим код для входа. Без пароля.
            </p>
            <form onSubmit={handleSendCode}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
                style={{ width: '100%', padding: '14px 16px', border: `1.5px solid ${C.gray200}`, borderRadius: 10, fontSize: 16, outline: 'none', transition: 'border 0.2s', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = C.terra}
                onBlur={e => e.target.style.borderColor = C.gray200}
              />
              {error && <div style={{ color: '#dc3545', fontSize: 13, marginTop: 8 }}>{error}</div>}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 16, cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={e => { setConsent(e.target.checked); setError(''); }}
                  style={{ marginTop: 2, accentColor: C.terra, width: 16, height: 16, flexShrink: 0 }}
                />
                <span style={{ fontSize: 12, color: C.gray500, lineHeight: 1.5 }}>
                  Соглашаюсь с{' '}
                  <Link to="/privacy" onClick={onClose} style={{ color: C.terra, textDecoration: 'underline' }}>Политикой конфиденциальности</Link>
                  {' '}и{' '}
                  <Link to="/offer" onClick={onClose} style={{ color: C.terra, textDecoration: 'underline' }}>Договором-офертой</Link>
                </span>
              </label>
              <Btn variant="terra" size="lg" style={{ width: '100%', marginTop: 12 }} disabled={loading || !consent}>
                {loading ? 'Отправляем...' : 'Получить код'}
              </Btn>
            </form>
          </>
        )}

        {step === 'code' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12, textAlign: 'center' }}>✉️</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: C.graphite, textAlign: 'center', marginBottom: 8 }}>Введите код</h2>
            <p style={{ fontSize: 14, color: C.gray500, textAlign: 'center', marginBottom: 24, lineHeight: 1.5 }}>
              Отправили 4-значный код на <strong>{email}</strong>
            </p>
            <form onSubmit={handleVerify}>
              <input
                ref={codeRef}
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="• • • •"
                style={{ width: '100%', padding: '16px', border: `1.5px solid ${C.gray200}`, borderRadius: 10, fontSize: 28, fontWeight: 700, textAlign: 'center', letterSpacing: 12, outline: 'none', transition: 'border 0.2s', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = C.terra}
                onBlur={e => e.target.style.borderColor = C.gray200}
              />
              {error && <div style={{ color: '#dc3545', fontSize: 13, marginTop: 8, textAlign: 'center' }}>{error}</div>}
              <Btn variant="terra" size="lg" style={{ width: '100%', marginTop: 16 }} disabled={loading}>
                {loading ? 'Проверяем...' : 'Войти'}
              </Btn>
            </form>
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              {countdown > 0 ? (
                <span style={{ fontSize: 13, color: C.gray400 }}>Повторно через {countdown} сек</span>
              ) : (
                <button onClick={handleResend} style={{ background: 'none', border: 'none', color: C.terra, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                  Отправить код ещё раз
                </button>
              )}
            </div>
            <button onClick={() => { setStep('email'); setCode(''); setError(''); }} style={{ display: 'block', margin: '12px auto 0', background: 'none', border: 'none', color: C.gray500, fontSize: 13, cursor: 'pointer' }}>
              ← Другой email
            </button>
          </>
        )}

        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: C.graphite, marginBottom: 8 }}>Добро пожаловать!</h2>
            <p style={{ fontSize: 14, color: C.gray500 }}>Вы успешно вошли в Клуб владельцев</p>
          </div>
        )}
      </div>
    </div>
  );
}
