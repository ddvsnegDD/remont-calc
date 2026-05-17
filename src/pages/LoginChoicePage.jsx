import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import { C } from '../lib/theme';
import { useAuth } from '../lib/auth';
import { Users, Briefcase, ArrowLeft } from 'lucide-react';
import Btn from '../components/Btn';

export default function LoginChoicePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, sendCode, verify } = useAuth();
  const [mode, setMode] = useState('choice'); // choice | b2c-email | b2c-code | b2c-success
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const codeRef = useRef(null);

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      if (user.role === 'b2b') navigate('/b2b-cabinet', { replace: true });
      else navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (mode === 'b2c-code' && codeRef.current) codeRef.current.focus();
  }, [mode]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleSendCode = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) { setError('Введите корректный email'); return; }
    if (!consent) { setError('Необходимо согласие на обработку данных'); return; }
    setError('');
    setLoading(true);
    try {
      await sendCode(email);
      setMode('b2c-code');
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
      setMode('b2c-success');
      setTimeout(() => navigate('/'), 1500);
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

  const inputStyle = { width: '100%', padding: '14px 16px', border: `1.5px solid ${C.gray200}`, borderRadius: 10, fontSize: 16, outline: 'none', transition: 'border 0.2s', boxSizing: 'border-box' };

  if (authLoading) return null;

  return (
    <PageLayout>
      <div className="quiz-page">
        <div className="quiz-wrap" style={{ maxWidth: mode === 'choice' ? 560 : 420 }}>

          {/* Choice */}
          {mode === 'choice' && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🔑</div>
                <h1 className="font-golos" style={{ fontSize: 26, fontWeight: 800, color: C.graphite, marginBottom: 8 }}>Вход в систему</h1>
                <p style={{ fontSize: 15, color: C.gray500 }}>Выберите тип аккаунта</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div onClick={() => { setMode('b2c-email'); setError(''); }}
                  style={{ background: '#fff', border: `2px solid ${C.gray200}`, borderRadius: 20, padding: '32px 24px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.terra; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.gray200; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: '#eff6ff', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
                    <Users size={28} color="#2563eb" />
                  </div>
                  <h3 className="font-golos" style={{ fontSize: 18, fontWeight: 700, color: C.graphite, marginBottom: 6 }}>Физические лица</h3>
                  <p style={{ fontSize: 13, color: C.gray500, lineHeight: 1.5 }}>Собственники квартир и домов</p>
                </div>

                <div onClick={() => navigate('/b2b-login')}
                  style={{ background: '#fff', border: `2px solid ${C.gray200}`, borderRadius: 20, padding: '32px 24px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.terra; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.gray200; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: '#f5f3ff', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
                    <Briefcase size={28} color="#8b5cf6" />
                  </div>
                  <h3 className="font-golos" style={{ fontSize: 18, fontWeight: 700, color: C.graphite, marginBottom: 6 }}>Профессионал / Бизнес</h3>
                  <p style={{ fontSize: 13, color: C.gray500, lineHeight: 1.5 }}>Дизайнеры, архитекторы, техзаказчики</p>
                </div>
              </div>
            </>
          )}

          {/* B2C Email step */}
          {mode === 'b2c-email' && (
            <div className="quiz-card" style={{ padding: '36px 32px 32px' }}>
              <div style={{ fontSize: 40, marginBottom: 12, textAlign: 'center' }}>🔑</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: C.graphite, textAlign: 'center', marginBottom: 8 }}>Вход</h2>
              <p style={{ fontSize: 14, color: C.gray500, textAlign: 'center', marginBottom: 24, lineHeight: 1.5 }}>
                Укажите email — мы отправим код для входа
              </p>
              <form onSubmit={handleSendCode}>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = C.terra}
                  onBlur={e => e.target.style.borderColor = C.gray200}
                />
                {error && <div style={{ color: '#dc3545', fontSize: 13, marginTop: 8 }}>{error}</div>}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 16, cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={consent} onChange={e => { setConsent(e.target.checked); setError(''); }}
                    style={{ marginTop: 2, accentColor: C.terra, width: 16, height: 16, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: C.gray500, lineHeight: 1.5 }}>
                    Соглашаюсь с{' '}
                    <Link to="/privacy" style={{ color: C.terra, textDecoration: 'underline' }}>Политикой конфиденциальности</Link>
                    {' '}и{' '}
                    <Link to="/offer" style={{ color: C.terra, textDecoration: 'underline' }}>Договором-офертой</Link>
                  </span>
                </label>
                <Btn variant="terra" size="lg" style={{ width: '100%', marginTop: 12 }} disabled={loading || !consent}>
                  {loading ? 'Отправляем...' : 'Получить код'}
                </Btn>
              </form>
              <button onClick={() => { setMode('choice'); setError(''); setEmail(''); setConsent(false); }}
                style={{ display: 'block', margin: '16px auto 0', background: 'none', border: 'none', color: C.gray500, fontSize: 13, cursor: 'pointer' }}>
                ← Назад к выбору
              </button>
            </div>
          )}

          {/* B2C Code step */}
          {mode === 'b2c-code' && (
            <div className="quiz-card" style={{ padding: '36px 32px 32px' }}>
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
                  style={{ ...inputStyle, padding: '16px', fontSize: 28, fontWeight: 700, textAlign: 'center', letterSpacing: 12 }}
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
              <button onClick={() => { setMode('b2c-email'); setCode(''); setError(''); }}
                style={{ display: 'block', margin: '12px auto 0', background: 'none', border: 'none', color: C.gray500, fontSize: 13, cursor: 'pointer' }}>
                ← Другой email
              </button>
            </div>
          )}

          {/* B2C Success */}
          {mode === 'b2c-success' && (
            <div className="quiz-card" style={{ padding: '36px 32px 32px', textAlign: 'center' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: C.graphite, marginBottom: 8 }}>Добро пожаловать!</h2>
              <p style={{ fontSize: 14, color: C.gray500 }}>Вы успешно вошли</p>
            </div>
          )}

        </div>
      </div>
    </PageLayout>
  );
}
