import React, { useState, useEffect } from 'react';
import { api } from '../api';
import Modal from '../components/Modal';
import Toast from '../components/Toast';

const empty = { name: '', employee_number: '', position: '', active: true };

export default function EmployeesMgmt() {
  const [employees, setEmployees] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [toast, setToast] = useState(null);

  const load = () => api.employees.list().then(setEmployees);
  useEffect(() => { load(); }, []);

  function openAdd() { setForm(empty); setModal('add'); }
  function openEdit(e) { setForm({ name: e.name, employee_number: e.employee_number || '', position: e.position || '', active: e.active }); setModal(e); }

  async function save() {
    try {
      modal === 'add' ? await api.employees.create(form) : await api.employees.update(modal.id, form);
      setToast({ msg: 'Saved', type: 'success' }); setModal(null); load();
    } catch (e) { setToast({ msg: e.message, type: 'error' }); }
  }

  async function del(id) {
    if (!confirm('Delete this employee?')) return;
    try { await api.employees.delete(id); load(); setToast({ msg: 'Deleted', type: 'success' }); }
    catch (e) { setToast({ msg: e.message, type: 'error' }); }
  }

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const initials = name => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const palette = ['#4ade80', '#60a5fa', '#fbbf24', '#f87171', '#a78bfa', '#34d399', '#fb923c'];
  const color = name => palette[name.charCodeAt(0) % palette.length];

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 2 }}>Employees</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13 }}>Manage drivers and staff</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Employee</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {employees.length === 0 ? (
          <div className="empty-state"><div className="icon">👷</div><p>No employees yet.</p></div>
        ) : (
          <table>
            <thead><tr><th>Employee</th><th>ID</th><th>Position</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                        background: color(emp.name) + '22', border: `1px solid ${color(emp.name)}44`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 600, color: color(emp.name)
                      }}>{initials(emp.name)}</div>
                      <span style={{ fontWeight: 500 }}>{emp.name}</span>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)' }}>{emp.employee_number || '—'}</td>
                  <td style={{ color: 'var(--text2)' }}>{emp.position || '—'}</td>
                  <td>{emp.active ? <span className="tag tag-green">Active</span> : <span className="tag tag-gray">Inactive</span>}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-icon" onClick={() => openEdit(emp)}>✏️</button>
                      <button className="btn-icon" onClick={() => del(emp.id)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <Modal title={modal === 'add' ? 'Add Employee' : 'Edit Employee'} onClose={() => setModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label>Full Name *</label>
              <input value={form.name} onChange={f('name')} placeholder="John Smith" />
            </div>
            <div className="form-grid form-grid-2">
              <div className="form-group">
                <label>Employee Number</label>
                <input value={form.employee_number} onChange={f('employee_number')} placeholder="EMP-001" />
              </div>
              <div className="form-group">
                <label>Position</label>
                <input value={form.position} onChange={f('position')} placeholder="Driver, Loader…" />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="emp-active" checked={form.active} onChange={f('active')} style={{ width: 'auto' }} />
              <label htmlFor="emp-active" style={{ fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>Active</label>
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
