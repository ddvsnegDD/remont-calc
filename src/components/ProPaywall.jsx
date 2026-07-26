import { useNavigate } from 'react-router-dom';
import { PageLayout } from './Layout';
import Btn from './Btn';
import { C } from '../lib/theme';

/**
 * PRO-пейволл для B2B-функций (детальная спецификация, офисный калькулятор).
 * Показывается, когда hasAccess === false.
 *
 * @param {string}  heading    — заголовок
 * @param {string}  sub        — короткое описание функции
 * @param {number}  positions  — сколько позиций в детализации (опционально)
 * @param {boolean} showLogin  — показать кнопку «Войти» (для неавторизованных)
 * @param {func}    onLogin    — клик по «Войти» (открыть LoginModal)
 * @param {boolean} inline     — встроить в существующую карточку (без PageLayout)
 */
export default function ProPaywall({ heading, sub, positions, showLogin, onLogin, inline = false }) {
  const navigate = useNavigate();

  const inner = (
    <>
      <div style={{ fontSize: inline ? 44 : 56, marginBottom: 12 }}>🔒</div>
      <h2 style={{ marginBottom: 0 }}>{heading}</h2>
      <p style={{ color: C.gray600, margin: '12px auto 8px', fontSize: 15, lineHeight: 1.6, maxWidth: 520 }}>
        {sub}
        {positions != null && <> Полная детализация — <strong>{positions}+ позиций</strong> по тендерным расценкам.</>}
      </p>
      <div style={{ display: 'inline-block', background: C.terraBg, color: C.terra, fontWeight: 600, fontSize: 14, padding: '6px 16px', borderRadius: 8, margin: '8px 0 24px' }}>
        PRO — 2 900 ₽/мес
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Btn variant="terra" size="lg" onClick={() => navigate('/pro')}>Оформить PRO</Btn>
        {showLogin && <Btn variant="outline" size="lg" onClick={onLogin}>Войти</Btn>}
      </div>
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
