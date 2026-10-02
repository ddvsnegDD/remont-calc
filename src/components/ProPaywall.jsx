import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from './Layout';
import Btn from './Btn';
import { C } from '../lib/theme';
import { useAuth } from '../lib/auth';
import { PLANS, formatPrice } from '../data/tariffs';

/**
 * Пейволл для платных функций.
 * Показывается, когда доступа нет (PRO-функции — !hasPro, клубные — !hasClub).
 *
 * @param {string}  heading    — заголовок
 * @param {string}  sub        — короткое описание функции
 * @param {number}  positions  — сколько позиций в детализации (опционально)
 * @param {boolean} showLogin  — показать кнопку «Войти» (для неавторизованных)
 * @param {func}    onLogin    — клик по «Войти» (открыть LoginModal)
 * @param {boolean} inline     — встроить в существующую карточку (без PageLayout)
 * @param {string}  target     — 'pro' (по умолчанию) → /pro, 'club' → /club
 * @param {func}    onTrialStarted — после успешного PRO-триала (необязательный; страница сама
 *                  перерисуется, т.к. hasPro в контексте станет истинным)
 */
export default function ProPaywall({ heading, sub, positions, showLogin, onLogin, inline = false, target = 'pro', onTrialStarted }) {
  const navigate = useNavigate();
  const { startTrial, canTryProTrial } = useAuth();
  const [trialLoading, setTrialLoading] = useState(false);
  const [trialError, setTrialError] = useState('');

  const isPro = target !== 'club';
  const plan = isPro ? PLANS.pro_monthly : PLANS.club_monthly;
  const badgeText = `${isPro ? 'PRO' : 'Клуб'} — ${formatPrice(plan.price)} ₽/мес`;
  const ctaText = isPro ? 'Оформить PRO' : 'Оформить Клуб';
  const to = isPro ? '/pro' : '/club';
  const showTrial = isPro && canTryProTrial;

  const handleTrial = async () => {
    setTrialLoading(true);
    setTrialError('');
    const res = await startTrial();
    setTrialLoading(false);
    if (res.ok) { onTrialStarted?.(); return; }
    setTrialError(res.error || 'Ошибка активации триала');
  };

  const inner = (
    <>
      <div style={{ fontSize: inline ? 44 : 56, marginBottom: 12 }}>🔒</div>
      <h2 style={{ marginBottom: 0 }}>{heading}</h2>
      <p style={{ color: C.gray600, margin: '12px auto 8px', fontSize: 15, lineHeight: 1.6, maxWidth: 520 }}>
        {sub}
        {positions != null && <> Полная детализация — <strong>{positions}+ позиций</strong> по тендерным расценкам.</>}
      </p>
      <div style={{ display: 'inline-block', background: C.terraBg, color: C.terra, fontWeight: 600, fontSize: 14, padding: '6px 16px', borderRadius: 8, margin: showTrial ? '8px 0 8px' : '8px 0 24px' }}>
        {badgeText}
      </div>
      {showTrial && (
        <div style={{ fontSize: 12, color: C.gray500, marginBottom: 20 }}>Без карты. Пробный доступ даётся один раз на аккаунт</div>
      )}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        {showTrial ? (
          <>
            <Btn variant="terra" size="lg" onClick={handleTrial} disabled={trialLoading}>Попробовать PRO 7 дней бесплатно</Btn>
            <Btn variant="outline" size="lg" onClick={() => navigate(to)}>{ctaText}</Btn>
          </>
        ) : (
          <Btn variant="terra" size="lg" onClick={() => navigate(to)}>{ctaText}</Btn>
        )}
        {showLogin && <Btn variant="outline" size="lg" onClick={onLogin}>Войти</Btn>}
      </div>
      {trialError && (
        <div style={{ maxWidth: 420, margin: '14px auto 0', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: '#fff5f5', color: '#c53030', border: '1px solid #feb2b2' }}>
          ⚠ {trialError}
        </div>
      )}
    </>
  );

  if (inline) {
    return (
      <div style={{ marginTop: 28, paddingTop: 24, borderTop: `2px solid ${C.gray200}`, textAlign: 'center' }}>
        {inner}
      </div>
    );
  }

  return (
    <PageLayout>
      <div className="quiz-page b2b">
        <div className="quiz-wrap" style={{ maxWidth: 760 }}>
          <div className="quiz-card" style={{ textAlign: 'center' }}>
            {inner}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
