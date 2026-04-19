import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import DateNav from '../components/DateNav';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import ExportModal from '../components/ExportModal';
import ImportModal from '../components/ImportModal';
import TimePicker from '../components/TimePicker';

const PACKOUT_LOCATIONS = ['Alva', 'Naughton', 'Casella'];

function fmt(t) {
  if (!t) return '—';
  const parts = t.slice(0, 5).split(':');
  const hr = parseInt(parts[0]);
  return `${hr % 12 || 12}:${parts[1]} ${hr < 12 ? 'AM' : 'PM'}`;
}

function dayLen(punchIn, punchOut) {
  if (!punchIn || !punchOut) return null;
  const [ah, am] = punchIn.slice(0, 5).split(':').map(Number);
  const [bh, bm] = punchOut.slice(0, 5).split(':').map(Number);
  const mins = (bh * 60 + bm) - (ah * 60 + am);
  if (mins <= 0) return null;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function RouteCell({ routeNumber, routeArea }) {
  if (!routeNumber) return <span style={{ color: 'var(--text3)' }}>—</span>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, background: 'var(--bg3)', padding: '2px 8px', borderRadius: 4, color: 'var(--text)' }}>
        {routeNumber}
      </span>
      {routeArea && routeArea.trim() && (
        <span style={{ fontSize: 10, fontWeight: 600, background: 'rgba(79,195,247,0.12)', color: 'var(--blue)', border: '1px solid rgba(79,195,247,0.25)', padding: '1px 7px', borderRadius: 99, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
          {routeArea.trim()}
        </span>
      )}
    </div>
  );
}

const emptyPackOut = () => ({ pack_out_time: '', back_on_route_time: '', location: '' });

const emptyForm = {
  employee_id: '',
  route_number: '',
  punch_in: '',
  first_stop_time: '',
  route_complete_time: '',
  to_yard_time: '',
  punch_out: '',
  notes: '',
  pack_outs: []
};

function rowToForm(log) {
  return {
    employee_id: log.employee_id,
    route_number: log.route_number || '',
    punch_in: log.punch_in ? log.punch_in.slice(0, 5) : '',
    first_stop_time: log.first_stop_time ? log.first_stop_time.slice(0, 5) : '',
    route_complete_time: log.route_complete_time ? log.route_complete_time.slice(0, 5) : '',
    to_yard_time: log.to_yard_time ? log.to_yard_time.slice(0, 5) : '',
    punch_out: log.punch_out ? log.punch_out.slice(0, 5) : '',
    notes: log.notes || '',
    pack_outs: (log.pack_outs || []).map(p => ({
      pack_out_time: p.pack_out_time ? p.pack_out_time.slice(0, 5) : '',
      back_on_route_time: p.back_on_route_time ? p.back_on_route_time.slice(0, 5) : '',
      location: p.location || '',
    }))
  };
}

const cellSelectStyle = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--accent)',
  borderRadius: 4, color: 'var(--text)', fontFamily: 'inherit', fontSize: 13,
  padding: '3px 6px', outline: 'none', minWidth: 110, cursor: 'pointer',
};

const cellInputStyle = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--accent)',
  borderRadius: 4, color: 'var(--text)', fontFamily: 'inherit', fontSize: 12,
  padding: '3px 6px', outline: 'none', minWidth: 90,
};

// ─── Pack-out popover ─────────────────────────────────────────────────────────

function PackOutPopover({ packOuts, onChange, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  const add = () => onChange([...packOuts, emptyPackOut()]);
  const remove = (i) => onChange(packOuts.filter((_, idx) => idx !== i));
  const update = (i, field, val) => {
    const next = [...packOuts];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  return (
    <div ref={ref} style={{
      position: 'absolute', zIndex: 300, top: '100%', left: 0,
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: 14, minWidth: 380,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pack Out Events</span>
        <button className="btn btn-ghost btn-sm" onClick={add}>+ Add</button>
      </div>
      {packOuts.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '8px 0' }}>No pack-out events</div>
      )}
      {packOuts.map((po, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 3 }}>Pack Out</div>
            <TimePicker value={po.pack_out_time} onChange={val => update(i, 'pack_out_time', val)} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 3 }}>Back On Route</div>
            <TimePicker value={po.back_on_route_time} onChange={val => update(i, 'back_on_route_time', val)} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 3 }}>Location</div>
            <select
              value={po.location || ''}
              onChange={e => update(i, 'location', e.target.value)}
              style={{ ...cellSelectStyle, minWidth: 0, fontSize: 12 }}
            >
              <option value="">—</option>
              {PACKOUT_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <button onClick={() => remove(i)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, paddingBottom: 2 }}>×</button>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

// ─── Inline editable row ──────────────────────────────────────────────────────

function InlineEditRow({ data, employees, routes, onSave, onCancel, isSaving }) {
  const [form, setForm] = useState(data);
  const [showPackOuts, setShowPackOuts] = useState(false);

  const dl = dayLen(form.punch_in, form.punch_out);
  const poCount = (form.pack_outs || []).filter(p => p.pack_out_time || p.back_on_route_time).length;

  function setField(field, value) { setForm(p => ({ ...p, [field]: value })); }

  function handleKeyDown(e) {
    if (e.key === 'Enter') onSave(form);
    if (e.key === 'Escape') onCancel();
  }

  return (
    <tr style={{ background: 'rgba(255,255,255,0.02)', outline: '1px solid var(--accent)', outlineOffset: -1 }}>
      <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
        <span style={{ fontWeight: 500, fontSize: 13 }}>
          {employees.find(e => String(e.id) === String(form.employee_id))?.name || '—'}
        </span>
      </td>
      <td style={{ padding: '6px 10px' }}>
        <select value={form.route_number} onChange={e => setField('route_number', e.target.value)} style={cellSelectStyle} onKeyDown={handleKeyDown}>
          <option value="">—</option>
          {routes.map(r => <option key={r.id} value={r.route_name}>{r.route_name}{r.area && r.area.trim() ? ` — ${r.area.trim()}` : ''}</option>)}
        </select>
      </td>
      <td style={{ padding: '6px 10px' }}><TimePicker value={form.punch_in} onChange={v => setField('punch_in', v)} onKeyDown={handleKeyDown} /></td>
      <td style={{ padding: '6px 10px' }}><TimePicker value={form.first_stop_time} onChange={v => setField('first_stop_time', v)} onKeyDown={handleKeyDown} /></td>
      <td style={{ padding: '6px 10px' }}><TimePicker value={form.route_complete_time} onChange={v => setField('route_complete_time', v)} onKeyDown={handleKeyDown} /></td>
      <td style={{ padding: '6px 10px' }}><TimePicker value={form.to_yard_time} onChange={v => setField('to_yard_time', v)} onKeyDown={handleKeyDown} /></td>
      <td style={{ padding: '6px 10px' }}><TimePicker value={form.punch_out} onChange={v => setField('punch_out', v)} onKeyDown={handleKeyDown} /></td>
      <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)', fontSize: 12 }}>
        {dl ? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{dl}</span> : <span style={{ color: 'var(--text3)' }}>—</span>}
      </td>
      <td style={{ padding: '6px 10px', position: 'relative' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowPackOuts(v => !v)} style={{ fontSize: 11, padding: '2px 8px' }}>
          {poCount > 0 ? <span style={{ color: 'var(--amber)' }}>{poCount}× dumps</span> : '+ Dumps'}
        </button>
        {showPackOuts && (
          <PackOutPopover packOuts={form.pack_outs || []} onChange={po => setField('pack_outs', po)} onClose={() => setShowPackOuts(false)} />
        )}
      </td>
      <td style={{ padding: '6px 10px' }}>
        <input type="text" value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Notes…" style={{ ...cellInputStyle, minWidth: 120 }} onKeyDown={handleKeyDown} />
      </td>
      <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-primary btn-sm" onClick={() => onSave(form)} disabled={isSaving} style={{ fontSize: 11, padding: '3px 10px' }}>{isSaving ? '…' : '✓'}</button>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={isSaving} style={{ fontSize: 11, padding: '3px 8px' }}>✕</button>
        </div>
      </td>
    </tr>
  );
}

// ─── Inline read row ──────────────────────────────────────────────────────────

function InlineReadRow({ log, onEdit, onDelete }) {
  const dl = dayLen(log.punch_in, log.punch_out);
  const complete = !!log.punch_out;
  const started = !!log.punch_in;
  const poCount = (log.pack_outs || []).length;

  return (
    <tr onClick={() => onEdit(log)} style={{ cursor: 'pointer' }} title="Click row to edit inline">
      <td style={{ fontWeight: 500, whiteSpace: 'nowrap', padding: '8px 10px' }}>{log.employee_name}</td>
      <td style={{ padding: '8px 10px' }}><RouteCell routeNumber={log.route_number} routeArea={log.route_area} /></td>
      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, padding: '8px 10px' }}>{fmt(log.punch_in)}</td>
      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, padding: '8px 10px' }}>{fmt(log.first_stop_time)}</td>
      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, padding: '8px 10px' }}>{fmt(log.route_complete_time)}</td>
      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, padding: '8px 10px' }}>{fmt(log.to_yard_time)}</td>
      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, padding: '8px 10px' }}>{fmt(log.punch_out)}</td>
      <td style={{ padding: '8px 10px' }}>
        {dl ? <span style={{ fontWeight: 500, color: 'var(--accent)' }}>{dl}</span> : <span style={{ color: 'var(--text3)' }}>—</span>}
      </td>
      <td style={{ padding: '8px 10px' }}>
        {poCount > 0
          ? <span style={{ fontFamily: 'var(--mono)', fontSize: 12, background: 'var(--bg3)', padding: '2px 8px', borderRadius: 4, color: 'var(--amber)' }}>{poCount}×</span>
          : <span style={{ color: 'var(--text3)' }}>—</span>}
      </td>
      <td style={{ padding: '8px 10px' }}>
        {complete ? <span className="tag tag-green">Complete</span>
          : started ? <span className="tag tag-blue">In Progress</span>
          : <span className="tag tag-gray">Pending</span>}
      </td>
      <td style={{ color: 'var(--text3)', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '8px 10px' }}>
        {log.notes || '—'}
      </td>
      <td style={{ padding: '8px 10px' }} onClick={e => e.stopPropagation()}>
        <button className="btn-icon" title="Delete" onClick={() => onDelete(log.id)}>🗑</button>
      </td>
    </tr>
  );
}

// ─── Inline new row ───────────────────────────────────────────────────────────

function InlineNewRow({ employees, routes, loggedEmployeeIds, onSave, isSaving }) {
  const blank = { ...emptyForm, pack_outs: [] };
  const [form, setForm] = useState(blank);
  const [showPackOuts, setShowPackOuts] = useState(false);

  const dl = dayLen(form.punch_in, form.punch_out);
  const poCount = (form.pack_outs || []).filter(p => p.pack_out_time || p.back_on_route_time).length;
  const availableEmployees = employees.filter(e => !loggedEmployeeIds.has(e.id));

  function setField(field, value) { setForm(p => ({ ...p, [field]: value })); }

  function handleSave() {
    if (!form.employee_id) return;
    onSave(form, () => setForm(blank));
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') setForm(blank);
  }

  return (
    <tr style={{ background: 'rgba(74,222,128,0.06)', borderBottom: '2px solid var(--accent)' }}>
      <td style={{ padding: '6px 10px' }}>
        <select value={form.employee_id} onChange={e => setField('employee_id', e.target.value)} style={cellSelectStyle} onKeyDown={handleKeyDown}>
          <option value="">+ Driver…</option>
          {availableEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </td>
      <td style={{ padding: '6px 10px' }}>
        <select value={form.route_number} onChange={e => setField('route_number', e.target.value)} style={cellSelectStyle} onKeyDown={handleKeyDown}>
          <option value="">Route…</option>
          {routes.map(r => <option key={r.id} value={r.route_name}>{r.route_name}{r.area && r.area.trim() ? ` — ${r.area.trim()}` : ''}</option>)}
        </select>
      </td>
      <td style={{ padding: '6px 10px' }}><TimePicker value={form.punch_in} onChange={v => setField('punch_in', v)} onKeyDown={handleKeyDown} placeholder="Punch In" /></td>
      <td style={{ padding: '6px 10px' }}><TimePicker value={form.first_stop_time} onChange={v => setField('first_stop_time', v)} onKeyDown={handleKeyDown} placeholder="1st Stop" /></td>
      <td style={{ padding: '6px 10px' }}><TimePicker value={form.route_complete_time} onChange={v => setField('route_complete_time', v)} onKeyDown={handleKeyDown} placeholder="Complete" /></td>
      <td style={{ padding: '6px 10px' }}><TimePicker value={form.to_yard_time} onChange={v => setField('to_yard_time', v)} onKeyDown={handleKeyDown} placeholder="To Yard" /></td>
      <td style={{ padding: '6px 10px' }}><TimePicker value={form.punch_out} onChange={v => setField('punch_out', v)} onKeyDown={handleKeyDown} placeholder="Punch Out" /></td>
      <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)', fontSize: 12 }}>
        {dl ? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{dl}</span> : <span style={{ color: 'var(--text3)' }}>—</span>}
      </td>
      <td style={{ padding: '6px 10px', position: 'relative' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowPackOuts(v => !v)} style={{ fontSize: 11, padding: '2px 8px' }}>
          {poCount > 0 ? <span style={{ color: 'var(--amber)' }}>{poCount}× dumps</span> : '+ Dumps'}
        </button>
        {showPackOuts && (
          <PackOutPopover packOuts={form.pack_outs || []} onChange={po => setField('pack_outs', po)} onClose={() => setShowPackOuts(false)} />
        )}
      </td>
      <td style={{ padding: '6px 10px' }}>
        <input type="text" value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Notes…" style={{ ...cellInputStyle, minWidth: 120 }} onKeyDown={handleKeyDown} />
      </td>
      <td style={{ padding: '6px 10px' }}>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!form.employee_id || isSaving} style={{ fontSize: 11, padding: '3px 10px' }} title="Save (Enter)">
          {isSaving ? '…' : '✓ Add'}
        </button>
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RouteLogs() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [logs, setLogs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entryMode, setEntryMode] = useState('form');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [savingNew, setSavingNew] = useState(false);
  const [toast, setToast] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    api.employees.list().then(r => setEmployees(r.filter(e => e.active)));
    // data entry uses active non-excluded routes only
    api.routes.list().then(r => setRoutes(r.filter(r => r.active && !r.excluded)));
  }, []);

  useEffect(() => { setEditingId(null); load(); }, [date]);

  async function load() {
    setLoading(true);
    try { setLogs(await api.routeLogs.list({ date })); }
    catch (e) { setToast({ msg: e.message, type: 'error' }); }
    finally { setLoading(false); }
  }

  function openAdd() { setForm({ ...emptyForm, pack_outs: [] }); setModal('add'); }
  function openEdit(log) { setForm(rowToForm(log)); setModal(log); }
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  function addPackOut() { setForm(p => ({ ...p, pack_outs: [...(p.pack_outs || []), emptyPackOut()] })); }
  function removePackOut(idx) { setForm(p => ({ ...p, pack_outs: p.pack_outs.filter((_, i) => i !== idx) })); }
  function updatePackOut(idx, field, value) {
    setForm(p => { const u = [...(p.pack_outs || [])]; u[idx] = { ...u[idx], [field]: value }; return { ...p, pack_outs: u }; });
  }

  async function saveModal() {
    if (!form.employee_id) { setToast({ msg: 'Please select a driver', type: 'error' }); return; }
    const cleanPackOuts = (form.pack_outs || []).filter(p => p.pack_out_time || p.back_on_route_time);
    try {
      if (modal === 'add') await api.routeLogs.create({ ...form, log_date: date, pack_outs: cleanPackOuts });
      else await api.routeLogs.update(modal.id, { ...form, pack_outs: cleanPackOuts });
      setToast({ msg: 'Saved successfully', type: 'success' });
      setModal(null);
      await load();
    } catch (e) { setToast({ msg: e.message, type: 'error' }); }
  }

  async function saveInlineNew(formData, resetFn) {
    if (!formData.employee_id) return;
    setSavingNew(true);
    const cleanPackOuts = (formData.pack_outs || []).filter(p => p.pack_out_time || p.back_on_route_time);
    try {
      await api.routeLogs.create({ ...formData, log_date: date, pack_outs: cleanPackOuts });
      setToast({ msg: `${employees.find(e => String(e.id) === String(formData.employee_id))?.name || 'Driver'} added`, type: 'success' });
      resetFn();
      await load();
    } catch (e) { setToast({ msg: e.message, type: 'error' }); }
    finally { setSavingNew(false); }
  }

  async function saveInlineEdit(logId, formData) {
    setSavingId(logId);
    const cleanPackOuts = (formData.pack_outs || []).filter(p => p.pack_out_time || p.back_on_route_time);
    try {
      await api.routeLogs.update(logId, { ...formData, pack_outs: cleanPackOuts });
      setEditingId(null);
      setToast({ msg: 'Saved', type: 'success' });
      await load();
    } catch (e) { setToast({ msg: e.message, type: 'error' }); }
    finally { setSavingId(null); }
  }

  async function del(id) {
    if (!confirm('Delete this log entry?')) return;
    try { await api.routeLogs.delete(id); await load(); setToast({ msg: 'Deleted', type: 'success' }); }
    catch (e) { setToast({ msg: e.message, type: 'error' }); }
  }

  function switchMode(mode) { setEditingId(null); setEntryMode(mode); }

  const loggedIds = new Set(logs.map(l => l.employee_id));
  const unloggedEmployees = employees.filter(e => !loggedIds.has(e.id));

  // Column count depends on mode (status col hidden in inline)
  const COL_COUNT = entryMode === 'form' ? 12 : 11;

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {showExport && <ExportModal currentDate={date} onClose={() => setShowExport(false)} />}
      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onImported={() => { load(); setToast({ msg: 'Import complete', type: 'success' }); }} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 2 }}>Daily Route KPIs</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13 }}>Per-driver route tracking — punch in/out, first stop, route complete, to yard</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <DateNav date={date} onChange={setDate} />
          <button className="btn btn-ghost" onClick={() => setShowImport(true)}>↑ Import</button>
          <button className="btn btn-ghost" onClick={() => setShowExport(true)}>↓ Export</button>
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <button onClick={() => switchMode('form')} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer', background: entryMode === 'form' ? 'var(--accent)' : 'transparent', color: entryMode === 'form' ? '#000' : 'var(--text2)', transition: 'background 0.15s' }}>📋 Form</button>
            <button onClick={() => switchMode('inline')} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer', background: entryMode === 'inline' ? 'var(--accent)' : 'transparent', color: entryMode === 'inline' ? '#000' : 'var(--text2)', transition: 'background 0.15s', borderLeft: '1px solid var(--border)' }}>⊞ Inline</button>
          </div>
          {entryMode === 'form' && <button className="btn btn-primary" onClick={openAdd}>+ Add Entry</button>}
        </div>
      </div>

      {employees.length > 0 && (
        <div className="card" style={{ padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, color: 'var(--text2)' }}>
              <span>Drivers logged today</span>
              <span style={{ color: logs.length === employees.length ? 'var(--accent)' : 'var(--text)' }}>
                <strong>{logs.length}</strong> / {employees.length}
              </span>
            </div>
            <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 99, background: logs.length === employees.length ? 'var(--accent)' : 'var(--info)', width: employees.length > 0 ? `${(logs.length / employees.length) * 100}%` : '0%', transition: 'width 0.3s ease' }} />
            </div>
          </div>
          {unloggedEmployees.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text3)', maxWidth: 400 }}>Missing: {unloggedEmployees.map(e => e.name).join(', ')}</div>
          )}
        </div>
      )}

      {entryMode === 'inline' && (
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10, padding: '8px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', gap: 16 }}>
          <span>⊞ <strong style={{ color: 'var(--text2)' }}>Inline mode</strong> — use the top row to add entries. Click any existing row to edit it.</span>
          <span>↵ Enter to save · Esc to cancel</span>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)' }}>Loading…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Driver</th><th>Route #</th><th>Punch In</th><th>1st Stop</th>
                  <th>Route Complete</th><th>To Yard</th><th>Punch Out</th><th>Day Length</th>
                  <th>Pack Outs</th>
                  {entryMode === 'form' && <th>Status</th>}
                  <th>Notes</th><th></th>
                </tr>
              </thead>
              <tbody>
                {entryMode === 'inline' && (
                  <InlineNewRow employees={employees} routes={routes} loggedEmployeeIds={loggedIds} onSave={saveInlineNew} isSaving={savingNew} />
                )}

                {logs.length === 0 && entryMode === 'form' && (
                  <tr><td colSpan={COL_COUNT} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text3)' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🚛</div>
                    <div>No entries for this date.</div>
                    <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openAdd}>Add First Entry</button>
                  </td></tr>
                )}
                {logs.length === 0 && entryMode === 'inline' && (
                  <tr><td colSpan={COL_COUNT} style={{ textAlign: 'center', padding: '24px 20px', color: 'var(--text3)', fontSize: 13 }}>
                    No entries yet — use the row above to add the first one.
                  </td></tr>
                )}

                {logs.map(log => {
                  if (entryMode === 'form') {
                    const dl = dayLen(log.punch_in, log.punch_out);
                    const complete = !!log.punch_out;
                    const started = !!log.punch_in;
                    const poCount = (log.pack_outs || []).length;
                    return (
                      <tr key={log.id}>
                        <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{log.employee_name}</td>
                        <td><RouteCell routeNumber={log.route_number} routeArea={log.route_area} /></td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmt(log.punch_in)}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmt(log.first_stop_time)}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmt(log.route_complete_time)}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmt(log.to_yard_time)}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmt(log.punch_out)}</td>
                        <td>{dl ? <span style={{ fontWeight: 500, color: 'var(--accent)' }}>{dl}</span> : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                        <td>{poCount > 0 ? <span style={{ fontFamily: 'var(--mono)', fontSize: 12, background: 'var(--bg3)', padding: '2px 8px', borderRadius: 4, color: 'var(--amber)' }}>{poCount}×</span> : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                        <td>{complete ? <span className="tag tag-green">Complete</span> : started ? <span className="tag tag-blue">In Progress</span> : <span className="tag tag-gray">Pending</span>}</td>
                        <td style={{ color: 'var(--text3)', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.notes || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn-icon" title="Edit" onClick={() => openEdit(log)}>✏️</button>
                            <button className="btn-icon" title="Delete" onClick={() => del(log.id)}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  if (editingId === log.id) {
                    return (
                      <InlineEditRow key={log.id} data={rowToForm(log)} employees={employees} routes={routes} loggedEmployeeIds={loggedIds}
                        isSaving={savingId === log.id} onSave={fd => saveInlineEdit(log.id, fd)} onCancel={() => setEditingId(null)} />
                    );
                  }
                  return <InlineReadRow key={log.id} log={log} onEdit={l => setEditingId(l.id)} onDelete={del} />;
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form mode modal */}
      {modal && (
        <Modal title={modal === 'add' ? 'Add Route Log Entry' : `Edit — ${modal.employee_name || 'Entry'}`} onClose={() => setModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label>Driver *</label>
              <select value={form.employee_id} onChange={f('employee_id')} disabled={modal !== 'add'}>
                <option value="">Select driver…</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Route #</label>
              <select value={form.route_number} onChange={f('route_number')}>
                <option value="">Select route…</option>
                {routes.map(r => <option key={r.id} value={r.route_name}>{r.route_name}{r.area && r.area.trim() ? ` — ${r.area.trim()}` : ''}</option>)}
              </select>
            </div>

            {/* Times card */}
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Times</div>
              <div className="form-grid form-grid-2">
                <div className="form-group"><label>Punch In</label><input type="time" value={form.punch_in} onChange={f('punch_in')} /></div>
                <div className="form-group"><label>1st Stop Time</label><input type="time" value={form.first_stop_time} onChange={f('first_stop_time')} /></div>
                <div className="form-group"><label>Route Complete Time</label><input type="time" value={form.route_complete_time} onChange={f('route_complete_time')} /></div>
                <div className="form-group"><label>To Yard</label><input type="time" value={form.to_yard_time} onChange={f('to_yard_time')} /></div>
                <div className="form-group"><label>Punch Out</label><input type="time" value={form.punch_out} onChange={f('punch_out')} /></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <span style={{ color: 'var(--text3)' }}>Day length:</span>
                <span style={{ fontWeight: 600, color: dayLen(form.punch_in, form.punch_out) ? 'var(--accent)' : 'var(--text3)' }}>
                  {dayLen(form.punch_in, form.punch_out) || '—'}
                </span>
              </div>
            </div>

            {/* Pack-outs card */}
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pack Out Events</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Optional — add one entry per dump run</div>
                </div>
                <button className="btn btn-ghost btn-sm" type="button" onClick={addPackOut}>+ Add Pack Out</button>
              </div>
              {(!form.pack_outs || form.pack_outs.length === 0) && (
                <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '8px 0' }}>No pack-out events recorded</div>
              )}
              {(form.pack_outs || []).map((po, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', background: 'var(--bg2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)' }}>Dump Run #{idx + 1}</span>
                    <button className="btn-icon" type="button" onClick={() => removePackOut(idx)} style={{ fontSize: 14, color: 'var(--danger)', opacity: 0.7 }}>×</button>
                  </div>
                  {/* 3-column grid: Pack Out | Back On Route | Location */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div className="form-group">
                      <label>Pack Out Time</label>
                      <input type="time" value={po.pack_out_time} onChange={e => updatePackOut(idx, 'pack_out_time', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Back On Route</label>
                      <input type="time" value={po.back_on_route_time} onChange={e => updatePackOut(idx, 'back_on_route_time', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Location</label>
                      <select value={po.location || ''} onChange={e => updatePackOut(idx, 'location', e.target.value)}>
                        <option value="">— Select —</option>
                        {PACKOUT_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="form-group">
              <label>Route Notes</label>
              <textarea value={form.notes} onChange={f('notes')} rows={3} placeholder="Any notes about the route, incidents, delays…" style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveModal}>Save</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
