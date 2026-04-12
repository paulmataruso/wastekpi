import React, { useState, useEffect } from 'react';
import { api } from '../api';
import DateNav from '../components/DateNav';
import Modal from '../components/Modal';
import Toast from '../components/Toast';

function fmt(t) { if (!t) return '—'; const [h, m] = t.split(':'); const hr = parseInt(h); return `${hr % 12 || 12}:${m} ${hr < 12 ? 'AM' : 'PM'}`; }
function hrs(a, b) { if (!a || !b) return '—'; const [ah, am] = a.split(':').map(Number), [bh, bm] = b.split(':').map(Number); const m = (bh * 60 + bm) - (ah * 60 + am); if (m <= 0) return '—'; return `${Math.floor(m / 60)}h ${m % 60}m`; }

const empty = { employee_id: '', clock_in: '', clock_out: '', notes: '' };

export default function ClockLogs() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [logs, setLogs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [toast, setToast] = useState(null);

  useEffect(() => { api.employees.list().then(setEmployees); }, []);
  useEffect(() => { load(); }, [date]);

  async function load() {
    setLoading(true);
    try { setLogs(await api.clockLogs.list({ date })); }
    catch (e) { setToast({ msg: e.message, type: 'error' }); }
    finally { setLoading(false); }
  }

  function openAdd() { setForm(empty); setModal('add'); }
  function openEdit(log) {
    setForm({
      employee_id: log.employee_id,
      clock_in: log.clock_in?.slice(0, 5) || '',
      clock_out: log.clock_out?.slice(0, 5) || '',
      notes: log.notes || ''
    });
    setModal(log);
  }

  async function save() {
    try {
      modal === 'add'
        ? await api.clockLogs.create({ ...form, log_date: date })
        : await api.clockLogs.update(modal.id, form);
      setToast({ msg: 'Saved', type: 'success' });
      setModal(null);
      load();
    } catch (e) { setToast({ msg: e.message, type: 'error' }); }
  }

  async function del(id) {
    if (!confirm('Delete this entry?')) return;
    try { await api.clockLogs.delete(id); load(); setToast({ msg: 'Deleted', type: 'success' }); }
    catch (e) { setToast({ msg: e.message, type: 'error' }); }
  }

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 2 }}>Clock Logs</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13 }}>Employee clock in and out times</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <DateNav date={date} onChange={setDate} />
          <button className="btn btn-primary" onClick={openAdd}>+ Add Entry</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)' }}>Loading…</div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🕐</div>
            <p>No clock logs for this date.</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openAdd}>Add First Entry</button>
          </div>
        ) : (
          <table>
            <thead>
              <tr><th>Employee</th><th>Position</th><th>Clock In</th><th>Clock Out</th><th>Hours</th><th>Notes</th><th></th></tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td><div style={{ fontWeight: 500 }}>{log.employee_name}</div><div style={{ fontSize: 11, color: 'var(--text3)' }}>{log.employee_number}</div></td>
                  <td style={{ color: 'var(--text2)' }}>{log.position || '—'}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmt(log.clock_in)}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmt(log.clock_out)}</td>
                  <td style={{ fontSize: 12 }}>{hrs(log.clock_in, log.clock_out)}</td>
                  <td style={{ color: 'var(--text3)', fontSize: 12 }}>{log.notes || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-icon" onClick={() => openEdit(log)}>✏️</button>
                      <button className="btn-icon" onClick={() => del(log.id)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <Modal title={modal === 'add' ? 'Add Clock Log' : 'Edit Clock Log'} onClose={() => setModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label>Employee *</label>
              <select value={form.employee_id} onChange={f('employee_id')}>
                <option value="">Select employee…</option>
                {employees.filter(e => e.active).map(e => (
                  <option key={e.id} value={e.id}>{e.name} — {e.position || e.employee_number}</option>
                ))}
              </select>
            </div>
            <div className="form-grid form-grid-2">
              <div className="form-group">
                <label>Clock In</label>
                <input type="time" value={form.clock_in} onChange={f('clock_in')} />
              </div>
              <div className="form-group">
                <label>Clock Out</label>
                <input type="time" value={form.clock_out} onChange={f('clock_out')} />
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={form.notes} onChange={f('notes')} rows={2} placeholder="Optional notes…" style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Save</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
