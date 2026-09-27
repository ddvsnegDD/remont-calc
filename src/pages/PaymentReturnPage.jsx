import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import LoginModal from '../components/LoginModal';
import Btn from '../components/Btn';
import { C } from '../lib/theme';
import { useAuth } from '../lib/auth';
import { labelOf, tierOf } from '../data/tariffs';

// Часть 3.2 TASK_yookassa.md: опрос раз в 2 с до 60 с — вебхук ЮKassa обычно
// приходит быстрее, но не гарантированно, поэтому страница сама подтверждает
// оплату тем же GET /api/payments/:id (у него есть свой путь применения на
// случай, если вебхук ещё не дошёл).
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 60000;

export default function PaymentReturnPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading, refreshSubscription } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [state, setState] = useState('pending'); // pending | succeeded | canceled | timeout | invalid
  const [payment, setPayment] = useState(null);
  const startedAtRef = useRef(Date.now());

  const paymentId = searchParams.get('p');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoginOpen(true); return; }
    setLoginOpen(false);
    if (!paymentId) { setState('invalid'); return; }

    let cancelled = false;
    let timer = null;
    startedAtRef.current = Date.now();
    setState('pending');

    const poll = async () => {
      let data;
      try {
        const res = await fetch(`/api/payments/${encodeURIComponent(paymentId)}`, { credentials: 'include' });
        data = await res.json();
      } catch {
        data = null;
      }
      if (cancelled) return;

      if (!data || !data.ok) { setState('invalid'); return; }
      if (data.status === 'succeeded') {
        setPayment(data);
        setState('succeeded');
        refreshSubscription();
        return;
      }
      if (data.status === 'canceled') {
        setPayment(data);
        setState('canceled');
        return;
      }
      if (Date.now() - startedAtRef.current >= POLL_TIMEOUT_MS) {
        setPayment(data);
        setState('timeout');
        return;
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };
    poll();

    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [user, authLoading, paymentId]);

  const isPro = payment?.plan ? tierOf(payment.plan) === 'pro' : false;
  const retryTo = isPro ? '/pro' : '/club';
  const cabinetTo = isPro ? '/b2b-cabinet' : '/club';
  const expiresLabel = payment?.subscription?.expiresAt
    ? new Date(payment.subscription.expiresAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <PageLayout>
      <div className="quiz-page">
        <div className="quiz-wrap">
          <div className="quiz-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            {!user ? (
              <>
                <h2>Нужен вход</h2>
                <p className="quiz-hint">Войдите, чтобы увидеть статус оплаты.</p>
              </>
            ) : state === 'pending' ? (
              <>
                <h2>Проверяем оплату…</h2>
                <p className="quiz-hint">Обычно это занимает несколько секунд.</p>
              </>
            ) : state === 'succeeded' ? (
              <>
                <h2>Оплата прошла</h2>
                <p className="quiz-hint">{labelOf(payment.plan)}{expiresLabel ? ` до ${expiresLabel}` : ''}</p>
                <Btn variant="terra" onClick={() => navigate(cabinetTo)}>{isPro ? 'В кабинет PRO' : 'В клуб'}</Btn>
              </>
            ) : state === 'canceled' ? (
              <>
                <h2>Оплата не прошла или отменена</h2>
                <p className="quiz-hint">Деньги не списаны.</p>
                <Btn variant="terra" onClick={() => navigate(retryTo)}>Попробовать ещё раз</Btn>
              </>
            ) : state === 'timeout' ? (
              <>
                <h2>Платёж обрабатывается</h2>
                <p className="quiz-hint">
                  Доступ откроется автоматически, обновите страницу через пару минут.
                  Если не откроется — напишите на{' '}
                  <a href="mailto:ddv1121@yandex.ru" style={{ color: C.terra }}>ddv1121@yandex.ru</a>.
                </p>
              </>
            ) : (
              <>
                <h2>Платёж не найден</h2>
                <p className="quiz-hint">Ссылка неверна или устарела.</p>
                <Btn variant="terra" onClick={() => navigate('/club')}>В клуб</Btn>
              </>
            )}
          </div>
        </div>
      </div>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={() => setLoginOpen(false)} />
    </PageLayout>
  );
}
