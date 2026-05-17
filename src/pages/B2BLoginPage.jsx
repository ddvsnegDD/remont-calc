import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import { C } from '../lib/theme';
import { useAuth } from '../lib/auth';
import Btn from '../components/Btn';

const ROLES = [
  { value: 'designer', label: 'Дизайнер интерьеров' },
  { value: 'architect', label: 'Архитектор' },
  { value: 'tech_customer', label: 'Технический заказчик' },
  { value: 'presale_engineer', label: 'Инженер пресейла' },
  { value: 'other', label: 'Другое' },
];

export default function B2BLoginPage() {
  const navigate = useNavigate();
  const { user, sendCode, verify } = useAuth();

  useEffect(() => {
    if (user?.role === 'b2b') navigate('/b2b-cabinet', { replace: true });
  }, [user, navigate]);

  const [step, setStep] = useState('login'); // login | register | code | success
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [organization, setOrganization] = useState('');
  const [position, setPosition] = useState('');
  const [code, setCode] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isRegistering, setIsRegistering] = useState(false);
  const codeRef = useRef(null);

  useEffect(() => {
    if (step === 'code' && codeRef.current) codeRef.current.focus();
  }, [step]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleSendCode = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) { setError('Введите корректный email'); return; }
    if (!consent) { setError('Необходимо согласие на обработку данных'); return; }

    if (step === 'register') {
      if (!name.trim()) { setError('Введите ФИО'); return; }
      if (!phone.trim()) { setError('Введите номер телефона'); return; }
      if (!organization.trim()) { setError('Введите организацию'); return; }
      if (!position) { setError('Выберите специализацию'); return; }
      setIsRegistering(true);
    } else {
      setIsRegistering(false);
    }

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
      if (isRegistering) {
        await verify(email, code, name, phone, { role: 'b2b', organization, position });
      } else {
        await verify(email, code, null, null, { role: 'b2b' });
      }
      setStep('success');
      setTimeout(() => navigate('/b2b-cabinet'), 1500);
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

  const inputStyle = { width: '100%', padding: '12px 14px', border: `1.5px solid ${C.gray200}`, borderRadius: 10, fontSize: 15, outline: 'none', boxSizing: 'border-box', transition: 'border 0.2s' };

  return (
    <PageLayout>
      <div className="quiz-page">
        <div className="quiz-wrap" style={{ maxWidth: 460 }}>
          <div className="quiz-card" style={{ padding: '36px 32px 32px' }}>

            {/* LOGIN step — just email */}
            {step === 'login' && (
              <>
                <div style={{ fontSize: 40, marginBottom: 12, textAlign: 'center' }}>👷</div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: C.graphite, textAlign: 'center', marginBottom: 6 }}>Вход для профессионалов</h2>
                <p style={{ fontSize: 14, color: C.gray500, textAlign: 'center', marginBottom: 24, lineHeight: 1.5 }}>
                  Дизайнеры, архитекторы, технические заказчики
                </p>

                <form onSubmit={handleSendCode} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, color: C.gray600, marginBottom: 4, display: 'block' }}>Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@company.com" autoFocus style={inputStyle}
                      onFocus={e => e.target.style.borderColor = C.terra}
                      onBlur={e => e.target.style.borderColor = C.gray200} />
                  </div>

                  {error && <div style={{ color: '#dc3545', fontSize: 13 }}>{error}</div>}

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox" checked={consent} onChange={e => { setConsent(e.target.checked); setError(''); }}
                      style={{ marginTop: 2, accentColor: C.terra, width: 16, height: 16, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: C.gray500, lineHeight: 1.5 }}>
                      Соглашаюсь с{' '}
                      <Link to="/privacy" style={{ color: C.terra, textDecoration: 'underline' }}>Политикой конфиденциальности</Link>
                      {' '}и{' '}
                      <Link to="/offer" style={{ color: C.terra, textDecoration: 'underline' }}>Договором-офертой</Link>
                    </span>
                  </label>

                  <Btn variant="dark" size="lg" style={{ width: '100%' }} disabled={loading || !consent}>
                    {loading ? 'Отправляем...' : 'Получить код'}
                  </Btn>
                </form>

                <div style={{ textAlign: 'center', marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.gray100}` }}>
                  <p style={{ fontSize: 13, color: C.gray400, marginBottom: 8 }}>Нет аккаунта?</p>
                  <button onClick={() => { setStep('register'); setError(''); }}
                    style={{ background: 'none', border: 'none', color: C.terra, fontSize: 15, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                    Зарегистрироваться
                  </button>
                </div>
              </>
            )}

            {/* REGISTER step — full form */}
            {step === 'register' && (
              <>
                <div style={{ fontSize: 40, marginBottom: 12, textAlign: 'center' }}>📋</div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: C.graphite, textAlign: 'center', marginBottom: 6 }}>Регистрация</h2>
                <p style={{ fontSize: 14, color: C.gray500, textAlign: 'center', marginBottom: 24, lineHeight: 1.5 }}>
                  Заполните данные для создания аккаунта профессионала
                </p>

                <form onSubmit={handleSendCode} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, color: C.gray600, marginBottom: 4, display: 'block' }}>ФИО *</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)}
                      placeholder="Иван Петров" style={inputStyle}
                      onFocus={e => e.target.style.borderColor = C.terra}
                      onBlur={e => e.target.style.borderColor = C.gray200} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, color: C.gray600, marginBottom: 4, display: 'block' }}>Email *</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@company.com" style={inputStyle}
                      onFocus={e => e.target.style.borderColor = C.terra}
                      onBlur={e => e.target.style.borderColor = C.gray200} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, color: C.gray600, marginBottom: 4, display: 'block' }}>Телефон *</label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                      placeholder="+7 (999) 123-45-67" style={inputStyle}
                      onFocus={e => e.target.style.borderColor = C.terra}
                      onBlur={e => e.target.style.borderColor = C.gray200} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, color: C.gray600, marginBottom: 4, display: 'block' }}>Организация *</label>
                    <input type="text" value={organization} onChange={e => setOrganization(e.target.value)}
                      placeholder="Студия / бюро / компания" style={inputStyle}
                      onFocus={e => e.target.style.borderColor = C.terra}
                      onBlur={e => e.target.style.borderColor = C.gray200} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, color: C.gray600, marginBottom: 4, display: 'block' }}>Специализация *</label>
                    <select value={position} onChange={e => setPosition(e.target.value)}
                      style={{ ...inputStyle, color: position ? C.graphite : C.gray400, background: '#fff' }}>
                      <option value="">— выберите —</option>
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>

                  {error && <div style={{ color: '#dc3545', fontSize: 13 }}>{error}</div>}

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox" checked={consent} onChange={e => { setConsent(e.target.checked); setError(''); }}
                      style={{ marginTop: 2, accentColor: C.terra, width: 16, height: 16, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: C.gray500, lineHeight: 1.5 }}>
                      Соглашаюсь с{' '}
                      <Link to="/privacy" style={{ color: C.terra, textDecoration: 'underline' }}>Политикой конфиденциальности</Link>
                      {' '}и{' '}
                      <Link to="/offer" style={{ color: C.terra, textDecoration: 'underline' }}>Договором-офертой</Link>.
                      {' '}Данные расчётов хранятся конфиденциально (NDA).
                    </span>
                  </label>

                  <Btn variant="dark" size="lg" style={{ width: '100%' }} disabled={loading || !consent}>
                    {loading ? 'Отправляем...' : 'Получить код'}
                  </Btn>
                </form>

                <div style={{ textAlign: 'center', marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.gray100}` }}>
                  <p style={{ fontSize: 13, color: C.gray400, marginBottom: 8 }}>Уже есть аккаунт?</p>
                  <button onClick={() => { setStep('login'); setError(''); }}
                    style={{ background: 'none', border: 'none', color: C.terra, fontSize: 15, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                    Войти
                  </button>
                </div>
              </>
            )}

            {/* CODE step */}
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
                    style={{ width: '100%', padding: '16px', border: `1.5px solid ${C.gray200}`, borderRadius: 10, fontSize: 28, fontWeight: 700, textAlign: 'center', letterSpacing: 12, outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = C.terra}
                    onBlur={e => e.target.style.borderColor = C.gray200}
                  />
                  {error && <div style={{ color: '#dc3545', fontSize: 13, marginTop: 8, textAlign: 'center' }}>{error}</div>}
                  <Btn variant="dark" size="lg" style={{ width: '100%', marginTop: 16 }} disabled={loading}>
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
                <button onClick={() => { setStep(isRegistering ? 'register' : 'login'); setCode(''); setError(''); }}
                  style={{ display: 'block', margin: '12px auto 0', background: 'none', border: 'none', color: C.gray500, fontSize: 13, cursor: 'pointer' }}>
                  ← Назад
                </button>
              </>
            )}

            {/* SUCCESS step */}
            {step === 'success' && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: C.graphite, marginBottom: 8 }}>Добро пожаловать!</h2>
                <p style={{ fontSize: 14, color: C.gray500 }}>Переходим в кабинет профессионала...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
