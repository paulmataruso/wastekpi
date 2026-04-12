import React from 'react';

export default function DateNav({ date, onChange }) {
  const prev = () => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    onChange(d.toISOString().split('T')[0]);
  };
  const next = () => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    onChange(d.toISOString().split('T')[0]);
  };
  const goToday = () => onChange(new Date().toISOString().split('T')[0]);
  const isToday = date === new Date().toISOString().split('T')[0];

  const label = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button className="btn btn-ghost btn-sm" onClick={prev}>‹ Prev</button>
      <input
        type="date"
        value={date}
        onChange={e => onChange(e.target.value)}
        style={{ width: 150 }}
      />
      <button className="btn btn-ghost btn-sm" onClick={next}>Next ›</button>
      {!isToday && (
        <button className="btn btn-ghost btn-sm" onClick={goToday}>Today</button>
      )}
      <span style={{ color: 'var(--text2)', fontSize: 13 }}>{label}</span>
    </div>
  );
}
