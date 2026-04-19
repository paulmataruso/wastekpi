import React, { useState, useEffect } from 'react';
import { api } from '../api';
import Modal from '../components/Modal';
import Toast from '../components/Toast';

const empty = { route_name: '', description: '', area: '', active: true, excluded: false };

export default function RoutesMgmt() {
  const [routes, setRoutes] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [toast, setToast] = useState(null);

  // Management page uses listAll so excluded routes are visible and can be toggled
  const load = () => api.routes.listAll().then(setRoutes);
  useEffect(() => { load(); }, []);

  function openAdd() { setForm(empty); setModal('add'); }
  function openEdit(r) {
    setForm({
      route_name: r.route_name,
      description: r.description || '',
      area: r.area || '',
      active: r.active,
      excluded: r.excluded || false,
    });
    setModal(r);
  }

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

  // Quick-toggle excluded directly from the table row without opening the modal
  async function toggleExcluded(r) {
    try {
      await api.routes.update(r.id, {
        route_name: r.route_name,
        description: r.description || '',
        area: r.area || '',
        active: r.active,
        excluded: !r.excluded,
      });
      load();
    } catch (e) { setToast({ msg: e.message, type: 'error' }); }
  }

  const f = k => e => setForm(p => ({
    ...p,
    [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value
  }));

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

      {/* Legend */}
      <div style={{ marginBottom: 12, padding: '8px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text3)', display: 'flex', gap: 20, alignItems: 'center' }}>
        <span>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', marginRight: 5, verticalAlign: 'middle' }} />
          <strong style={{ color: 'var(--text2)' }}>Active</strong> — route is available for data entry
        </span>
        <span>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', marginRight: 5, verticalAlign: 'middle' }} />
          <strong style={{ color: 'var(--text2)' }}>Excluded</strong> — route is hidden from all reports, display board, and KPI calculations
        </span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {routes.length === 0 ? (
          <div className="empty-state"><div className="icon">🗺</div><p>No routes yet.</p></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Route Name</th>
                <th>Area</th>
                <th>Description</th>
                <th>Status</th>
                <th>Reports</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {routes.map(r => (
                <tr key={r.id} style={{ opacity: r.excluded ? 0.65 : 1 }}>
                  <td style={{ fontWeight: 500 }}>{r.route_name}</td>
                  <td style={{ color: 'var(--text2)' }}>{r.area || '—'}</td>
                  <td style={{ color: 'var(--text3)', fontSize: 12 }}>{r.description || '—'}</td>
                  <td>
                    {r.active
                      ? <span className="tag tag-green">Active</span>
                      : <span className="tag tag-gray">Inactive</span>}
                  </td>
                  <td>
                    {/* Excluded toggle — click to flip */}
                    <button
                      onClick={() => toggleExcluded(r)}
                      title={r.excluded ? 'Click to include in reports' : 'Click to exclude from reports'}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '3px 10px', borderRadius: 99, cursor: 'pointer',
                        fontSize: 11, fontWeight: 600, border: 'none',
                        background: r.excluded ? 'rgba(239,68,68,0.15)' : 'rgba(74,222,128,0.12)',
                        color: r.excluded ? 'var(--danger)' : 'var(--accent)',
                        transition: 'background 0.15s',
                      }}
                    >
                      <span style={{
                        display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                        background: r.excluded ? 'var(--danger)' : 'var(--accent)',
                        flexShrink: 0,
                      }} />
                      {r.excluded ? 'Excluded' : 'Included'}
                    </button>
                  </td>
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
              <input value={form.route_name} onChange={f('route_name')} placeholder="e.g. Route 1" />
            </div>
            <div className="form-group">
              <label>Area / Zone</label>
              <input value={form.area} onChange={f('area')} placeholder="e.g. North District" />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={form.description} onChange={f('description')} rows={2} placeholder="Brief description…" style={{ resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Visibility</div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="route-active" checked={form.active} onChange={f('active')} style={{ width: 'auto' }} />
                <label htmlFor="route-active" style={{ fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                  Active — available in data entry dropdowns
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <input
                  type="checkbox"
                  id="route-excluded"
                  checked={form.excluded}
                  onChange={f('excluded')}
                  style={{ width: 'auto', marginTop: 2 }}
                />
                <label htmlFor="route-excluded" style={{ fontSize: 13, cursor: 'pointer' }}>
                  <span style={{ color: form.excluded ? 'var(--danger)' : 'var(--text)' }}>
                    Exclude from reports
                  </span>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                    When checked, this route's data will not appear in the display board, KPI calculations, or averages.
                    Historical data is preserved — only reporting is affected.
                  </div>
                </label>
              </div>
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
