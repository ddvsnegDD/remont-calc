import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import { C } from '../lib/theme';
import { useAuth } from '../lib/auth';
import { CHECKLISTS } from '../data/checklists';
import { ArrowLeft, Camera, X, Check, ChevronDown, ChevronUp, Image as ImageIcon, Trash2, FileText, Printer } from 'lucide-react';
import Btn from '../components/Btn';
import { openReportWindow } from '../lib/checklistReport';

function getStorageKey(userId, checklistId) {
  return `rpkm_checklist_${userId}_${checklistId}`;
}

function loadState(userId, checklistId) {
  const raw = localStorage.getItem(getStorageKey(userId, checklistId));
  if (!raw) return { items: {}, meta: {} };
  try { return JSON.parse(raw); }
  catch { return { items: {}, meta: {} }; }
}

function saveState(userId, checklistId, state) {
  localStorage.setItem(getStorageKey(userId, checklistId), JSON.stringify(state));
}

// Compress image to max 800px width, JPEG 0.7 quality
function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 800;
        let w = img.width, h = img.height;
        if (w > maxW) { h = h * maxW / w; w = maxW; }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function PhotoViewer({ src, onClose }) {
  if (!src) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.9)', display: 'grid', placeItems: 'center', padding: 16 }}
      onClick={onClose}>
      <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
        <X size={20} color="#fff" />
      </button>
      <img src={src} alt="" style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 8 }} onClick={e => e.stopPropagation()} />
    </div>
  );
}

function ChecklistItem({ itemKey, text, checked, photos = [], comment, onToggle, onAddPhoto, onDeletePhoto, onComment, color }) {
  const [showPhotos, setShowPhotos] = useState(false);
  const [viewPhoto, setViewPhoto] = useState(null);
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const compressed = await compressImage(file);
      onAddPhoto(itemKey, compressed);
    }
    e.target.value = '';
  };

  return (
    <>
      <PhotoViewer src={viewPhoto} onClose={() => setViewPhoto(null)} />
      <div style={{
        background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 8,
        border: `1.5px solid ${checked ? '#bbf7d0' : C.gray100}`,
        transition: 'border-color 0.2s',
      }}>
        {/* Main row */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {/* Checkbox */}
          <button onClick={() => onToggle(itemKey)}
            style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 1,
              border: `2px solid ${checked ? '#16a34a' : C.gray300}`,
              background: checked ? '#16a34a' : '#fff',
              display: 'grid', placeItems: 'center', cursor: 'pointer',
              transition: 'all 0.15s',
            }}>
            {checked && <Check size={16} color="#fff" strokeWidth={3} />}
          </button>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14, lineHeight: 1.5, color: checked ? C.gray400 : C.graphite,
              textDecoration: checked ? 'line-through' : 'none',
              transition: 'color 0.2s',
            }}>
              {text}
            </div>

            {/* Photo thumbnails + camera */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: photos.length > 0 || showPhotos ? 10 : 0 }}>
              {photos.map((p, i) => (
                <div key={i} style={{ position: 'relative', width: 56, height: 56, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.gray200}` }}>
                  <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                    onClick={() => setViewPhoto(p)} />
                  <button onClick={() => onDeletePhoto(itemKey, i)}
                    style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}>
                    <X size={10} color="#fff" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Photo button */}
          <button onClick={() => fileRef.current?.click()}
            style={{
              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
              background: photos.length > 0 ? color + '15' : C.gray50,
              border: `1px solid ${photos.length > 0 ? color + '30' : C.gray200}`,
              display: 'grid', placeItems: 'center', cursor: 'pointer',
              position: 'relative',
            }}>
            <Camera size={16} color={photos.length > 0 ? color : C.gray400} />
            {photos.length > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                width: 16, height: 16, borderRadius: '50%',
                background: color, color: '#fff', fontSize: 9, fontWeight: 700,
                display: 'grid', placeItems: 'center',
              }}>{photos.length}</span>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple
            style={{ display: 'none' }} onChange={handleFile} />
        </div>

        {/* Comment */}
        {checked && (
          <div style={{ marginTop: 10, marginLeft: 40 }}>
            <input
              type="text"
              placeholder="Комментарий (необязательно)"
              value={comment || ''}
              onChange={e => onComment(itemKey, e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', border: `1px solid ${C.gray200}`,
                borderRadius: 8, fontSize: 13, color: C.graphite, outline: 'none',
                boxSizing: 'border-box', background: C.gray50,
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}

export default function ChecklistDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const checklist = CHECKLISTS.find(c => c.id === id);

  const [state, setState] = useState({ items: {}, meta: {} });
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [resultStatus, setResultStatus] = useState('');

  // Load state
  useEffect(() => {
    if (!user || !checklist) return;
    const s = loadState(user.id, id);
    setState(s);
    if (s.meta?.result) setResultStatus(s.meta.result);
  }, [user, id, checklist]);

  // Auto-save
  const save = useCallback((newState) => {
    if (!user) return;
    setState(newState);
    saveState(user.id, id, newState);
  }, [user, id]);

  if (!checklist) {
    return (
      <PageLayout>
        <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <h2>Чек-лист не найден</h2>
            <Btn variant="terra" onClick={() => navigate('/checklists')}>К списку</Btn>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!user) {
    return (
      <PageLayout>
        <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <h2>Авторизуйтесь для доступа</h2>
            <Btn variant="terra" onClick={() => navigate('/login')}>Войти</Btn>
          </div>
        </div>
      </PageLayout>
    );
  }

  const totalItems = checklist.groups.reduce((sum, g) => sum + g.items.length, 0);
  const checkedCount = Object.values(state.items).filter(v => v.checked).length;
  const pct = totalItems > 0 ? Math.round(checkedCount / totalItems * 100) : 0;
  const allDone = checkedCount === totalItems;

  const toggleItem = (key) => {
    const items = { ...state.items };
    if (!items[key]) items[key] = { checked: false, photos: [], comment: '' };
    items[key] = { ...items[key], checked: !items[key].checked };
    save({ ...state, items });
  };

  const addPhoto = (key, dataUrl) => {
    const items = { ...state.items };
    if (!items[key]) items[key] = { checked: false, photos: [], comment: '' };
    items[key] = { ...items[key], photos: [...(items[key].photos || []), dataUrl] };
    save({ ...state, items });
  };

  const deletePhoto = (key, index) => {
    const items = { ...state.items };
    if (!items[key]) return;
    const photos = [...(items[key].photos || [])];
    photos.splice(index, 1);
    items[key] = { ...items[key], photos };
    save({ ...state, items });
  };

  const setComment = (key, text) => {
    const items = { ...state.items };
    if (!items[key]) items[key] = { checked: false, photos: [], comment: '' };
    items[key] = { ...items[key], comment: text };
    save({ ...state, items });
  };

  const toggleGroup = (gIdx) => {
    setCollapsedGroups(prev => ({ ...prev, [gIdx]: !prev[gIdx] }));
  };

  const setResult = (value) => {
    setResultStatus(value);
    save({ ...state, meta: { ...state.meta, result: value } });
  };

  const saveMeta = (field, value) => {
    save({ ...state, meta: { ...state.meta, [field]: value } });
  };

  // Build flat item key from group index + item index
  const itemKey = (gIdx, iIdx) => `${gIdx}_${iIdx}`;

  return (
    <PageLayout>
      <div style={{ minHeight: '80vh', padding: '24px 0 80px', background: C.gray50 }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 16px' }}>

          {/* Back + title */}
          <div style={{ marginBottom: 20 }}>
            <button onClick={() => navigate('/checklists')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', color: C.gray500, fontSize: 14, marginBottom: 12 }}>
              <ArrowLeft size={18} /> Все чек-листы
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: checklist.color + '15', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>
                {checklist.icon}
              </div>
              <div>
                <h1 className="font-golos" style={{ fontSize: 22, fontWeight: 800, color: C.graphite, margin: 0 }}>{checklist.title}</h1>
                <p style={{ fontSize: 13, color: C.gray500, margin: '2px 0 0' }}>{totalItems} пунктов · {checklist.groups.length} разделов</p>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', marginBottom: 16, border: `1px solid ${C.gray100}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
              <span style={{ color: C.gray500 }}>Прогресс</span>
              <span style={{ fontWeight: 700, color: allDone ? '#16a34a' : checklist.color }}>{checkedCount} / {totalItems} ({pct}%)</span>
            </div>
            <div style={{ height: 8, background: C.gray100, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: allDone ? '#16a34a' : checklist.color, borderRadius: 4, transition: 'width 0.3s' }} />
            </div>
          </div>

          {/* Object info */}
          <div style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', marginBottom: 20, border: `1px solid ${C.gray100}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.gray500, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Объект</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input placeholder="Адрес объекта" value={state.meta?.address || ''}
                onChange={e => saveMeta('address', e.target.value)}
                style={{ gridColumn: '1 / -1', padding: '10px 12px', border: `1px solid ${C.gray200}`, borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              <input placeholder="Помещение" value={state.meta?.room || ''}
                onChange={e => saveMeta('room', e.target.value)}
                style={{ padding: '10px 12px', border: `1px solid ${C.gray200}`, borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              <input type="date" value={state.meta?.date || ''}
                onChange={e => saveMeta('date', e.target.value)}
                style={{ padding: '10px 12px', border: `1px solid ${C.gray200}`, borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: state.meta?.date ? C.graphite : C.gray400 }} />
            </div>
          </div>

          {/* Groups */}
          {checklist.groups.map((group, gIdx) => {
            const collapsed = collapsedGroups[gIdx];
            const groupTotal = group.items.length;
            const groupChecked = group.items.filter((_, iIdx) => state.items[itemKey(gIdx, iIdx)]?.checked).length;
            const groupDone = groupChecked === groupTotal;

            return (
              <div key={gIdx} style={{ marginBottom: 16 }}>
                {/* Group header */}
                <button onClick={() => toggleGroup(gIdx)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', background: groupDone ? '#f0fdf4' : '#fff',
                    border: `1px solid ${groupDone ? '#bbf7d0' : C.gray200}`, borderRadius: 10,
                    cursor: 'pointer', marginBottom: collapsed ? 0 : 8, transition: 'all 0.2s',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: checklist.color, background: checklist.color + '15', padding: '2px 8px', borderRadius: 6 }}>
                      {gIdx + 1}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.graphite, textAlign: 'left' }}>{group.title}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: groupDone ? '#16a34a' : C.gray400 }}>
                      {groupChecked}/{groupTotal}
                    </span>
                    {collapsed ? <ChevronDown size={18} color={C.gray400} /> : <ChevronUp size={18} color={C.gray400} />}
                  </div>
                </button>

                {/* Items */}
                {!collapsed && group.items.map((text, iIdx) => {
                  const key = itemKey(gIdx, iIdx);
                  const item = state.items[key] || { checked: false, photos: [], comment: '' };
                  return (
                    <ChecklistItem
                      key={key}
                      itemKey={key}
                      text={text}
                      checked={item.checked}
                      photos={item.photos || []}
                      comment={item.comment}
                      onToggle={toggleItem}
                      onAddPhoto={addPhoto}
                      onDeletePhoto={deletePhoto}
                      onComment={setComment}
                      color={checklist.color}
                    />
                  );
                })}
              </div>
            );
          })}

          {/* Result section */}
          <div style={{ background: '#fff', borderRadius: 12, padding: '18px', marginTop: 24, border: `1px solid ${C.gray100}` }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.graphite, marginBottom: 12 }}>Результат приёмки</div>

            {/* Comments textarea */}
            <textarea
              placeholder="Замечания и комментарии заказчика..."
              value={state.meta?.comments || ''}
              onChange={e => saveMeta('comments', e.target.value)}
              rows={3}
              style={{
                width: '100%', padding: '10px 12px', border: `1px solid ${C.gray200}`,
                borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical',
                boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 14,
              }}
            />

            {/* Status buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { value: 'accepted', label: 'Работы приняты без замечаний', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
                { value: 'with_remarks', label: 'Приняты с замечаниями', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
                { value: 'rejected', label: 'Работы не приняты, требуется устранение', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
              ].map(opt => (
                <button key={opt.value} onClick={() => setResult(opt.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                    borderRadius: 10, border: `2px solid ${resultStatus === opt.value ? opt.border : C.gray200}`,
                    background: resultStatus === opt.value ? opt.bg : '#fff',
                    cursor: 'pointer', transition: 'all 0.15s', width: '100%', textAlign: 'left',
                  }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    border: `2px solid ${resultStatus === opt.value ? opt.color : C.gray300}`,
                    background: resultStatus === opt.value ? opt.color : '#fff',
                    display: 'grid', placeItems: 'center', flexShrink: 0,
                  }}>
                    {resultStatus === opt.value && <Check size={12} color="#fff" strokeWidth={3} />}
                  </div>
                  <span style={{ fontSize: 14, color: resultStatus === opt.value ? opt.color : C.gray600, fontWeight: resultStatus === opt.value ? 600 : 400 }}>
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          {allDone && resultStatus && (
            <div style={{
              marginTop: 20, padding: '18px', borderRadius: 12,
              background: resultStatus === 'accepted' ? '#f0fdf4' : resultStatus === 'with_remarks' ? '#fffbeb' : '#fef2f2',
              border: `1px solid ${resultStatus === 'accepted' ? '#bbf7d0' : resultStatus === 'with_remarks' ? '#fde68a' : '#fecaca'}`,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>
                {resultStatus === 'accepted' ? '✅' : resultStatus === 'with_remarks' ? '⚠️' : '❌'}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.graphite, marginBottom: 4 }}>
                Чек-лист заполнен
              </div>
              <div style={{ fontSize: 13, color: C.gray500 }}>
                {checkedCount}/{totalItems} пунктов отмечено
                {Object.values(state.items).reduce((s, v) => s + (v.photos?.length || 0), 0) > 0 &&
                  ` · ${Object.values(state.items).reduce((s, v) => s + (v.photos?.length || 0), 0)} фото`}
              </div>
            </div>
          )}

          {/* Report / Print buttons */}
          <div style={{
            marginTop: 24, background: '#fff', borderRadius: 12, padding: '18px',
            border: `1px solid ${C.gray100}`,
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.graphite, marginBottom: 4 }}>Отчёт приёмки</div>
            <p style={{ fontSize: 13, color: C.gray500, marginBottom: 14 }}>
              Сформируйте отчёт для печати и подписания. Включает все отметки, комментарии, фото и поля для подписей.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => openReportWindow(id, state)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px',
                  background: C.terra, color: '#fff', border: 'none', borderRadius: 10,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.2s',
                  flex: '1 1 auto', justifyContent: 'center',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                <FileText size={18} />
                Сформировать отчёт в PDF
              </button>
            </div>
          </div>

        </div>
      </div>
    </PageLayout>
  );
}
