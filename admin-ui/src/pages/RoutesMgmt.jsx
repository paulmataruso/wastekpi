import React, { useState, useEffect } from 'react';
import { api } from '../api';
import Modal from '../components/Modal';
import Toast from '../components/Toast';

const empty = { route_name: '', description: '', area: '', active: true };

export default function RoutesMgmt() {
  const [routes, setRoutes] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [toast, setToast] = useState(null);

  const load = () => api.routes.list().then(setRoutes);
  useEffect(() => { load(); }, []);

  function openAdd() { setForm(empty); setModal('add'); }
  function openEdit(r) { setForm({ route_name: r.route_name, description: r.description || '', area: r.area || '', active: r.active }); setModal(r); }

  async function save() {
    try {
      modal === 'add' ? await api.routes.create(form) : await api.routes.update(modal.id, form);
      setToast({ msg: 'Saved', type: 'success' }); setModal(null); load();
    } catch (e) { setToast({ msg: e.message, type: 'error' }); }
  }

  async function del(id) {
    if (!confirm('Delete this route? All associated logs will also be deleted.')) return;
    try { await api.routes.delete(id); load(); setToast({ msg: 'Deleted', type: 'success' }); }
    catch (e) { setToast({ msg: e.message, type: 'error' }); }
  }

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 2 }}>Routes</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13 }}>Manage trash collection routes</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Route</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {routes.length === 0 ? (
          <div className="empty-state"><div className="icon">🗺</div><p>No routes yet.</p></div>
        ) : (
          <table>
            <thead><tr><th>Route Name</th><th>Area</th><th>Description</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {routes.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.route_name}</td>
                  <td style={{ color: 'var(--text2)' }}>{r.area || '—'}</td>
                  <td style={{ color: 'var(--text3)', fontSize: 12 }}>{r.description || '—'}</td>
                  <td>{r.active ? <span className="tag tag-green">Active</span> : <span className="tag tag-gray">Inactive</span>}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-icon" onClick={() => openEdit(r)}>✏️</button>
                      <button className="btn-icon" onClick={() => del(r.id)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <Modal title={modal === 'add' ? 'Add Route' : 'Edit Route'} onClose={() => setModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label>Route Name *</label>
              <input value={form.route_name} onChange={f('route_name')} placeholder="e.g. Route A - North" />
            </div>
            <div className="form-group">
              <label>Area / Zone</label>
              <input value={form.area} onChange={f('area')} placeholder="e.g. North District" />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={form.description} onChange={f('description')} rows={2} placeholder="Brief description…" style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="route-active" checked={form.active} onChange={f('active')} style={{ width: 'auto' }} />
              <label htmlFor="route-active" style={{ fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>Active</label>
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
