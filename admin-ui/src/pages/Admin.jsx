import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api';
import Toast from '../components/Toast';
import Modal from '../components/Modal';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function SectionHeader({ title, description }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
      <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0 }}>{description}</p>
    </div>
  );
}

const dangerBtnStyle = {
  padding: '8px 20px', borderRadius: 'var(--radius)', border: 'none',
  cursor: 'pointer', background: 'var(--danger)', color: '#fff',
  fontSize: 13, fontWeight: 600,
};

const rowStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13
};

// ─── Tab: Backup & Restore ────────────────────────────────────────────────────

function BackupTab({ setToast }) {
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreStep, setRestoreStep] = useState('idle');
  const [restoreResult, setRestoreResult] = useState(null);
  const [parsedBackup, setParsedBackup] = useState(null);
  const [backupMeta, setBackupMeta] = useState(null);

  // Erase state — two-step: first confirm, then type confirmation word
  const [eraseStep, setEraseStep] = useState('idle'); // idle | confirm1 | confirm2 | done
  const [eraseWord, setEraseWord] = useState('');
  const [erasing, setErasing] = useState(false);

  const fileRef = useRef(null);
  const labelStyle = { color: 'var(--text3)' };
  const valueStyle = { fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--mono)' };

  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // ── Download ───────────────────────────────────────────────────────────────

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await api.backup.download();
      if (!res || !res.ok) throw new Error('Backup request failed');
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `wastekpi-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      setToast({ msg: `Backup downloaded: ${filename}`, type: 'success' });
    } catch (e) { setToast({ msg: e.message, type: 'error' }); }
    finally { setDownloading(false); }
  }

  // ── Restore ────────────────────────────────────────────────────────────────

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target.result);
        if (!json.version || !json.tables) throw new Error('Not a valid WasteKPI backup file');
        setParsedBackup(json);
        setBackupMeta({
          filename: file.name,
          created_at: json.created_at,
          counts: {
            employees:     json.tables.employees?.length    || 0,
            routes:        json.tables.routes?.length       || 0,
            route_logs:    json.tables.route_logs?.length   || 0,
            pack_out_logs: json.tables.pack_out_logs?.length || 0,
            clock_logs:    json.tables.clock_logs?.length   || 0,
          }
        });
        setRestoreStep('confirm');
      } catch (err) { setToast({ msg: `Invalid backup file: ${err.message}`, type: 'error' }); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function handleRestore() {
    if (!parsedBackup) return;
    setRestoring(true);
    try {
      const result = await api.backup.restore(parsedBackup);
      setRestoreResult(result.restored);
      setRestoreStep('done');
      setToast({ msg: 'Restore completed successfully', type: 'success' });
    } catch (e) { setToast({ msg: `Restore failed: ${e.message}`, type: 'error' }); }
    finally { setRestoring(false); }
  }

  function resetRestore() { setRestoreStep('idle'); setParsedBackup(null); setBackupMeta(null); setRestoreResult(null); }

  // ── Erase ──────────────────────────────────────────────────────────────────

  async function handleErase() {
    if (eraseWord.trim().toUpperCase() !== 'ERASE') return;
    setErasing(true);
    try {
      await api.backup.erase();
      setEraseStep('done');
      setEraseWord('');
      setToast({ msg: 'All route log data has been erased', type: 'success' });
    } catch (e) { setToast({ msg: `Erase failed: ${e.message}`, type: 'error' }); }
    finally { setErasing(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Download */}
      <div className="card" style={{ padding: 24 }}>
        <SectionHeader title="⬇ Download Backup" description="Creates a .json snapshot of all employees, routes, route logs, pack-out events and clock logs. Save it somewhere safe — it can fully restore the database." />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>⚠ User accounts and passwords are not included.</p>
          <button className="btn btn-primary" onClick={handleDownload} disabled={downloading} style={{ flexShrink: 0, minWidth: 160 }}>
            {downloading ? 'Downloading…' : '⬇ Download Backup'}
          </button>
        </div>
      </div>

      {/* Restore */}
      <div className="card" style={{ padding: 24 }}>
        <SectionHeader title="⬆ Restore from Backup" description="Upload a previously downloaded backup file. This will replace all current operational data." />

        {restoreStep === 'idle' && (
          <>
            <div style={{ border: '2px dashed var(--border2)', borderRadius: 'var(--radius-lg)', padding: '28px 24px', textAlign: 'center', cursor: 'pointer', background: 'var(--bg3)' }} onClick={() => fileRef.current?.click()}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Click to select a backup file</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Select a .json file downloaded from this system</div>
              <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleFileSelect} style={{ display: 'none' }} />
            </div>
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--danger-dim)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--danger)' }}>
              ⚠ Restoring will <strong>permanently delete all existing data</strong> before importing.
            </div>
          </>
        )}

        {restoreStep === 'confirm' && backupMeta && (
          <>
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Backup Contents</div>
              {[['File', backupMeta.filename], ['Backup created', fmtDate(backupMeta.created_at)], ['Employees', backupMeta.counts.employees], ['Routes', backupMeta.counts.routes], ['Route Logs', backupMeta.counts.route_logs.toLocaleString()], ['Pack-Out Events', backupMeta.counts.pack_out_logs.toLocaleString()], ['Clock Logs', backupMeta.counts.clock_logs.toLocaleString()]].map(([label, value], i, arr) => (
                <div key={label} style={{ ...rowStyle, borderBottom: i === arr.length - 1 ? 'none' : undefined }}>
                  <span style={labelStyle}>{label}</span><span style={valueStyle}>{value}</span>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--danger-dim)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--danger)' }}>
              ⚠ This will <strong>delete all current data</strong> and replace it with this backup. This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" onClick={resetRestore} disabled={restoring}>Cancel</button>
              <button onClick={handleRestore} disabled={restoring} style={{ ...dangerBtnStyle, opacity: restoring ? 0.7 : 1, cursor: restoring ? 'not-allowed' : 'pointer' }}>
                {restoring ? 'Restoring…' : '⬆ Restore Now'}
              </button>
            </div>
          </>
        )}

        {restoreStep === 'done' && restoreResult && (
          <>
            <div style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>Restore Complete</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>All data has been restored successfully.</div>
            </div>
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 16 }}>
              {Object.entries(restoreResult).map(([key, count], i, arr) => (
                <div key={key} style={{ ...rowStyle, borderBottom: i === arr.length - 1 ? 'none' : undefined }}>
                  <span style={labelStyle}>{key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                  <span style={valueStyle}>{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-ghost" onClick={resetRestore}>Restore another file</button>
          </>
        )}
      </div>

      {/* Erase */}
      <div className="card" style={{ padding: 24, border: '1px solid var(--danger)', borderTop: '3px solid var(--danger)' }}>
        <SectionHeader title="🗑 Erase All Data" description="Permanently deletes all route logs, pack-out events, and clock logs. Employees, routes, and user accounts are kept. This cannot be undone." />

        {eraseStep === 'idle' && (
          <button onClick={() => setEraseStep('confirm1')} style={dangerBtnStyle}>
            🗑 Erase All Data…
          </button>
        )}

        {eraseStep === 'confirm1' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: '14px 18px', background: 'var(--danger-dim)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--danger)', lineHeight: 1.6 }}>
              <strong>Are you sure?</strong> This will permanently delete <strong>all route logs</strong>, pack-out events, and clock logs across all dates and all drivers. Employees, routes, and user accounts will not be affected.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setEraseStep('idle')}>Cancel</button>
              <button onClick={() => setEraseStep('confirm2')} style={dangerBtnStyle}>Yes, I want to erase all data</button>
            </div>
          </div>
        )}

        {eraseStep === 'confirm2' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: '14px 18px', background: 'var(--danger-dim)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--danger)', lineHeight: 1.6 }}>
              <strong>Final confirmation.</strong> Type <strong>ERASE</strong> in the box below and click the button to permanently delete all data. There is no undo.
            </div>
            <div className="form-group">
              <label style={{ color: 'var(--danger)', fontWeight: 600 }}>Type ERASE to confirm</label>
              <input
                type="text"
                value={eraseWord}
                onChange={e => setEraseWord(e.target.value)}
                placeholder="Type ERASE here…"
                autoFocus
                onKeyDown={e => { if (e.key === 'Escape') { setEraseStep('idle'); setEraseWord(''); } }}
                style={{ borderColor: eraseWord.trim().toUpperCase() === 'ERASE' ? 'var(--danger)' : undefined }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => { setEraseStep('idle'); setEraseWord(''); }}>Cancel</button>
              <button
                onClick={handleErase}
                disabled={eraseWord.trim().toUpperCase() !== 'ERASE' || erasing}
                style={{ ...dangerBtnStyle, opacity: (eraseWord.trim().toUpperCase() !== 'ERASE' || erasing) ? 0.4 : 1, cursor: (eraseWord.trim().toUpperCase() !== 'ERASE' || erasing) ? 'not-allowed' : 'pointer' }}
              >
                {erasing ? 'Erasing…' : '🗑 Permanently Erase All Data'}
              </button>
            </div>
          </div>
        )}

        {eraseStep === 'done' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🗑</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Data Erased</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>All route log data has been permanently deleted.</div>
            </div>
            <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setEraseStep('idle')}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: User Management ─────────────────────────────────────────────────────

function UsersTab({ setToast }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'add' | {user object} for edit
  const [form, setForm] = useState({ username: '', password: '', role: 'user' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const currentUserId = (() => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.id;
    } catch { return null; }
  })();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setUsers(await api.users.list()); }
    catch (e) { setToast({ msg: e.message, type: 'error' }); }
    finally { setLoading(false); }
  }

  function openAdd() {
    setForm({ username: '', password: '', role: 'user' });
    setModal('add');
  }

  function openEdit(user) {
    setForm({ username: user.username, password: '', role: user.role });
    setModal(user);
  }

  async function save() {
    if (!form.username.trim()) { setToast({ msg: 'Username is required', type: 'error' }); return; }
    if (modal === 'add' && !form.password) { setToast({ msg: 'Password is required for new users', type: 'error' }); return; }
    setSaving(true);
    try {
      const payload = { username: form.username.trim(), role: form.role };
      if (form.password) payload.password = form.password;
      if (modal === 'add') {
        await api.users.create(payload);
        setToast({ msg: `User "${form.username}" created`, type: 'success' });
      } else {
        await api.users.update(modal.id, payload);
        setToast({ msg: 'User updated', type: 'success' });
      }
      setModal(null);
      await load();
    } catch (e) { setToast({ msg: e.message, type: 'error' }); }
    finally { setSaving(false); }
  }

  async function del(user) {
    setDeleting(user.id);
    try {
      await api.users.delete(user.id);
      setToast({ msg: `User "${user.username}" deleted`, type: 'success' });
      await load();
    } catch (e) { setToast({ msg: e.message, type: 'error' }); }
    finally { setDeleting(null); }
  }

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <SectionHeader title="👤 User Accounts" description="Manage who can log into the admin portal. All users can enter route data. Only admins can access this settings page." />
          <button className="btn btn-primary" onClick={openAdd} style={{ flexShrink: 0 }}>+ Add User</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>Loading…</div>
        ) : (
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td style={{ fontWeight: 500 }}>
                    {user.username}
                    {String(user.id) === String(currentUserId) && (
                      <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, background: 'var(--accent-dim)', color: 'var(--accent)', padding: '1px 6px', borderRadius: 99 }}>You</span>
                    )}
                  </td>
                  <td>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                      background: user.role === 'admin' ? 'rgba(245,158,11,0.15)' : 'var(--bg3)',
                      color: user.role === 'admin' ? 'var(--amber)' : 'var(--text3)',
                      border: `1px solid ${user.role === 'admin' ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
                    }}>
                      {user.role === 'admin' ? '⚙ Admin' : '👤 User'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text3)', fontSize: 13 }}>{fmtDate(user.created_at)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-icon" title="Edit" onClick={() => openEdit(user)}>✏️</button>
                      <button
                        className="btn-icon"
                        title="Delete"
                        disabled={deleting === user.id || String(user.id) === String(currentUserId)}
                        onClick={() => del(user)}
                        style={{ opacity: String(user.id) === String(currentUserId) ? 0.3 : 1 }}
                      >
                        {deleting === user.id ? '…' : '🗑'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text3)' }}>
          <strong style={{ color: 'var(--text2)' }}>Roles:</strong> &nbsp;
          <span style={{ color: 'var(--amber)' }}>⚙ Admin</span> — full access including this settings page. &nbsp;
          <span>👤 User</span> — can enter and edit route log data, view dashboard.
        </div>
      </div>

      {modal && (
        <Modal
          title={modal === 'add' ? 'Add User' : `Edit — ${modal.username}`}
          onClose={() => setModal(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label>Username *</label>
              <input type="text" value={form.username} onChange={f('username')} placeholder="e.g. john.doe" autoFocus />
            </div>
            <div className="form-group">
              <label>{modal === 'add' ? 'Password *' : 'New Password'}</label>
              <input type="password" value={form.password} onChange={f('password')} placeholder={modal === 'add' ? 'Min 6 characters' : 'Leave blank to keep current'} />
              {modal !== 'add' && (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Leave blank to keep the existing password.</div>
              )}
            </div>
            <div className="form-group">
              <label>Role</label>
              <select value={form.role} onChange={f('role')}>
                <option value="user">👤 User — route data entry only</option>
                <option value="admin">⚙ Admin — full access</option>
              </select>
            </div>
            {modal !== 'add' && String(modal.id) === String(currentUserId) && form.role !== 'admin' && (
              <div style={{ padding: '8px 12px', background: 'var(--danger-dim)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--danger)' }}>
                ⚠ You cannot remove your own admin role.
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Main Admin page ──────────────────────────────────────────────────────────

export default function Admin() {
  const [tab, setTab] = useState('backup');
  const [toast, setToast] = useState(null);

  const tabs = [
    { id: 'backup', label: '💾 Backup & Restore' },
    { id: 'users',  label: '👤 Users' },
  ];

  return (
    <div style={{ maxWidth: 760 }}>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 2 }}>Admin Settings</h1>
        <p style={{ color: 'var(--text2)', fontSize: 13 }}>System administration — backup, restore, data management, and user accounts.</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 18px', fontSize: 13, fontWeight: 500,
              border: 'none', cursor: 'pointer', background: 'transparent',
              color: tab === t.id ? 'var(--accent)' : 'var(--text2)',
              borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1, transition: 'color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'backup' && <BackupTab setToast={setToast} />}
      {tab === 'users'  && <UsersTab  setToast={setToast} />}
    </div>
  );
}
