import React, { useState, useRef, useEffect, useCallback } from 'react';

// ─── TimePicker ───────────────────────────────────────────────────────────────
// Props:
//   value      — "HH:MM" 24-hour string or ""
//   onChange   — called with "HH:MM" string
//   onKeyDown  — forwarded keydown (for Enter/Escape in parent)
//   placeholder
//   style      — extra styles on the trigger input

export default function TimePicker({ value, onChange, onKeyDown, placeholder = '—', style = {} }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const hourRef = useRef(null);
  const minuteRef = useRef(null);

  // Parse value into parts
  const parsed = parseTime(value);
  const [hour12, setHour12] = useState(parsed.hour12);
  const [minute, setMinute] = useState(parsed.minute);
  const [ampm, setAmpm] = useState(parsed.ampm);

  // Sync internal state when value prop changes externally
  useEffect(() => {
    const p = parseTime(value);
    setHour12(p.hour12);
    setMinute(p.minute);
    setAmpm(p.ampm);
  }, [value]);

  // Emit change whenever internal state changes (only when open, to avoid loop)
  const emit = useCallback((h12, min, ap) => {
    let h = h12 === 12 ? (ap === 'AM' ? 0 : 12) : (ap === 'PM' ? h12 + 12 : h12);
    const val = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    onChange(val);
  }, [onChange]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  // Scroll selected items into view when opening
  useEffect(() => {
    if (!open) return;
    setTimeout(() => {
      scrollToSelected(hourRef.current);
      scrollToSelected(minuteRef.current);
    }, 10);
  }, [open]);

  function scrollToSelected(el) {
    if (!el) return;
    const selected = el.querySelector('[data-selected="true"]');
    if (selected) selected.scrollIntoView({ block: 'center' });
  }

  function selectHour(h) {
    setHour12(h);
    emit(h, minute, ampm);
  }
  function selectMinute(m) {
    setMinute(m);
    emit(hour12, m, ampm);
  }
  function selectAmPm(ap) {
    setAmpm(ap);
    emit(hour12, minute, ap);
  }

  const displayValue = value
    ? (() => {
        const p = parseTime(value);
        return `${p.hour12}:${String(p.minute).padStart(2, '0')} ${p.ampm}`;
      })()
    : '';

  const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,10,...55

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      {/* Trigger */}
      <input
        type="text"
        readOnly
        value={displayValue}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        style={{
          width: '100%',
          background: 'var(--bg)',
          border: '1px solid var(--accent)',
          borderRadius: 4,
          color: displayValue ? 'var(--text)' : 'var(--text3)',
          fontFamily: 'var(--mono)',
          fontSize: 12,
          padding: '3px 6px',
          outline: 'none',
          cursor: 'pointer',
          minWidth: 90,
          ...style,
        }}
      />

      {/* Clear button — shown only when a value is set */}
      {value && (
        <button
          onMouseDown={(e) => { e.preventDefault(); onChange(''); setOpen(false); }}
          style={{
            position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text3)', fontSize: 14, lineHeight: 1, padding: '0 2px',
          }}
          tabIndex={-1}
          title="Clear"
        >×</button>
      )}

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', zIndex: 500, top: 'calc(100% + 4px)', left: 0,
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          display: 'flex', gap: 0, overflow: 'hidden', userSelect: 'none',
          minWidth: 180,
        }}>

          {/* Hours column */}
          <div style={colStyle}>
            <div style={colHeaderStyle}>HR</div>
            <div ref={hourRef} style={colScrollStyle}>
              {hours.map(h => (
                <div
                  key={h}
                  data-selected={h === hour12}
                  onClick={() => { selectHour(h); }}
                  style={itemStyle(h === hour12)}
                >
                  {h}
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />

          {/* Minutes column */}
          <div style={colStyle}>
            <div style={colHeaderStyle}>MIN</div>
            <div ref={minuteRef} style={colScrollStyle}>
              {minutes.map(m => (
                <div
                  key={m}
                  data-selected={m === minute || (minute > m && minute < m + 5 && m === minutes[minutes.length - 1] ? false : Math.round(minute / 5) * 5 === m)}
                  onClick={() => { selectMinute(m); }}
                  style={itemStyle(Math.round(minute / 5) * 5 % 60 === m || (m === 55 && minute >= 55))}
                >
                  {String(m).padStart(2, '0')}
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />

          {/* AM/PM column */}
          <div style={{ ...colStyle, minWidth: 52 }}>
            <div style={colHeaderStyle}>  </div>
            <div style={{ ...colScrollStyle, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, padding: '8px 6px' }}>
              {['AM', 'PM'].map(ap => (
                <div
                  key={ap}
                  onClick={() => { selectAmPm(ap); }}
                  style={{
                    ...itemStyle(ap === ampm),
                    borderRadius: 6,
                    padding: '8px 10px',
                    textAlign: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                  }}
                >
                  {ap}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const colStyle = {
  display: 'flex', flexDirection: 'column', minWidth: 48,
};

const colHeaderStyle = {
  fontSize: 9, fontWeight: 700, color: 'var(--text3)',
  textTransform: 'uppercase', letterSpacing: '0.1em',
  padding: '6px 0 4px', textAlign: 'center',
  borderBottom: '1px solid var(--border)', flexShrink: 0,
};

const colScrollStyle = {
  overflowY: 'auto', maxHeight: 180,
  scrollbarWidth: 'thin',
};

const itemStyle = (selected) => ({
  padding: '7px 0',
  textAlign: 'center',
  fontSize: 13,
  fontFamily: 'var(--mono)',
  cursor: 'pointer',
  borderRadius: 4,
  margin: '1px 4px',
  background: selected ? 'var(--accent)' : 'transparent',
  color: selected ? '#000' : 'var(--text2)',
  fontWeight: selected ? 700 : 400,
  transition: 'background 0.1s',
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTime(val) {
  if (!val) return { hour12: 12, minute: 0, ampm: 'AM' };
  const [hStr, mStr] = val.slice(0, 5).split(':');
  const h24 = parseInt(hStr) || 0;
  const minute = parseInt(mStr) || 0;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  let hour12 = h24 % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, minute, ampm };
}
