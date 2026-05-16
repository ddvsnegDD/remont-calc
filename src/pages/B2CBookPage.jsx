import { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import Btn from '../components/Btn';
import { C } from '../lib/theme';
import { SpecCalc } from '../lib/spec-calculator';

export default function B2CBookPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canResume = searchParams.get('return') === 'quiz';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [extra, setExtra] = useState('');
  const [address, setAddress] = useState('');
  const [agree, setAgree] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = useCallback(() => {
    if (!name || name.length < 2) { alert('Введите имя'); return; }
    if (!phone || phone.replace(/\D/g, '').length < 10) { alert('Введите корректный телефон'); return; }
    if (!agree) { alert('Нужно согласие на обработку данных'); return; }
    setSubmitted(true);
  }, [name, phone, agree]);

  if (submitted) {
    return (
      <PageLayout>
        <div className="quiz-page">
          <div className="quiz-wrap" style={{ maxWidth: 720 }}>
            <div className="quiz-card">
              <div className="success-screen">
                <div className="success-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <h2>Заявка принята!</h2>
                <p>Куратор свяжется с вами по телефону <strong>{phone}</strong> в течение рабочего дня
                  и согласует удобное время выезда дизайнера и инженера.</p>
                <p style={{ fontSize: 13, color: C.gray500 }}>Сохранено локально (это демо-проект)</p>
                {canResume ? (
                  <Btn variant="terra" style={{ marginTop: 16 }} onClick={() => {
                    try {
                      const saved = JSON.parse(sessionStorage.getItem('rpkm-b2c-quiz-answers') || '{}');
                      const a = parseFloat(saved.area) || 60;
                      const tMap = { cosmetic: 'capital', capital: 'capital', euro: 'euro', premium: 'premium' };
                      const t = tMap[saved.repair_type] || 'capital';
                      const m = (t === 'premium') ? 'full' : (saved.finish_type === 'whitebox' ? 'whitebox' : 'full');
                      const rp = saved.replan || 'no';
                      const rm = a < 35 ? 1 : a < 55 ? 2 : a < 80 ? 3 : a < 120 ? 4 : 5;
                      const sn = a < 60 ? 1 : a < 120 ? 2 : 3;
                      const wn = a < 35 ? 2 : a < 55 ? 3 : a < 80 ? 4 : a < 120 ? 6 : 8;
                      const specResult = SpecCalc.compute({ area: a, rooms: rm, sanitary: sn, windows: wn, mode: m, tier: t, replan: rp });
                      const lead = { id: 'b2c-detail-' + Date.now(), timestamp: new Date().toISOString(), kind: 'b2c-detail', result: specResult, contact: { name, phone, email: extra } };
                      sessionStorage.setItem('rpkm-last-b2c-detail', JSON.stringify(lead));
                      navigate('/b2c-result-detail');
                    } catch { navigate('/b2c'); }
                  }}>Получить расчёт</Btn>
                ) : (
                  <Btn variant="outline" style={{ marginTop: 16 }} onClick={() => navigate('/')}>На главную</Btn>
                )}
              </div>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="quiz-page">
        <div className="quiz-wrap" style={{ maxWidth: 720 }}>
          <div className="quiz-card">
            <div style={{ fontSize: 56, textAlign: 'center', marginBottom: 8 }}>📐</div>
            <h2 style={{ textAlign: 'center', marginBottom: 8 }}>Запись на бесплатный обмер с дизайнером</h2>
            <p style={{ textAlign: 'center', color: C.gray600, marginBottom: 24 }}>
              Дизайнер и инженер выезжают на ваш объект, обсуждают концепцию, делают точные обмеры
              и согласовывают спецификацию материалов. Бесплатно, выезд занимает 60–90 минут.
            </p>

            <div className="alert alert-info" style={{ marginBottom: 20 }}>
              <strong>Что вы получите после обмера:</strong>
              <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                <li>Эскиз планировки с рекомендациями дизайнера</li>
                <li>Точную смету с фиксированной ценой</li>
                <li>Понимание сроков и графика работ</li>
                <li>Договор с гарантией 3 года (5 лет для премиум)</li>
              </ul>
            </div>

            <div className="form-field"><label>Как вас зовут</label><input type="text" className="text-input" value={name} onChange={e => setName(e.target.value)} placeholder="Имя" /></div>
            <div className="form-field"><label>Телефон</label><input type="tel" className="text-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 (___) ___-__-__" /></div>
            <div className="form-field"><label>Email или Telegram (опционально)</label><input type="text" className="text-input" value={extra} onChange={e => setExtra(e.target.value)} placeholder="@username или email" /></div>
            <div className="form-field"><label>Адрес объекта</label><input type="text" className="text-input" value={address} onChange={e => setAddress(e.target.value)} placeholder="Москва, район или ЖК" /></div>
            <label className="checkbox-row">
              <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
              <span>Согласен на обработку персональных данных. Это демо — данные сохраняются только в браузере.</span>
            </label>

            <Btn variant="terra" size="lg" style={{ width: '100%', marginTop: 16 }} onClick={submit}>Записаться на бесплатный обмер</Btn>

            {canResume && (
              <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px dashed ' + C.gray200 }}>
                <div style={{ textAlign: 'center', color: C.gray600, marginBottom: 12 }}>
                  Хотите сначала понять примерный бюджет?
                </div>
                <Btn variant="outline" style={{ width: '100%' }} onClick={() => {
                  try {
                    const saved = JSON.parse(sessionStorage.getItem('rpkm-b2c-quiz-answers') || '{}');
                    const a = parseFloat(saved.area) || 60;
                    const tMap = { cosmetic: 'capital', capital: 'capital', euro: 'euro', premium: 'premium' };
                    const t = tMap[saved.repair_type] || 'capital';
                    const m = (t === 'premium') ? 'full' : (saved.finish_type === 'whitebox' ? 'whitebox' : 'full');
                    const rp = saved.replan || 'no';
                    const rm = a < 35 ? 1 : a < 55 ? 2 : a < 80 ? 3 : a < 120 ? 4 : 5;
                    const sn = a < 60 ? 1 : a < 120 ? 2 : 3;
                    const wn = a < 35 ? 2 : a < 55 ? 3 : a < 80 ? 4 : a < 120 ? 6 : 8;
                    const specResult = SpecCalc.compute({ area: a, rooms: rm, sanitary: sn, windows: wn, mode: m, tier: t, replan: rp });
                    const lead = { id: 'b2c-detail-' + Date.now(), timestamp: new Date().toISOString(), kind: 'b2c-detail', result: specResult, contact: {} };
                    sessionStorage.setItem('rpkm-last-b2c-detail', JSON.stringify(lead));
                    navigate('/b2c-result-detail');
                  } catch { navigate('/b2c'); }
                }}>
                  Получить расчёт →
                </Btn>
              </div>
            )}

            <p style={{ fontSize: 13, color: C.gray500, textAlign: 'center', marginTop: 20 }}>
              Расчёт носит предварительный характер. Точная стоимость определяется после обмера.
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
