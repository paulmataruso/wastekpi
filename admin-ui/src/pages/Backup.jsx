import React, { useState, useRef } from 'react';
import { api } from '../api';
import Toast from '../components/Toast';

export default function Backup() {
  const [toast, setToast] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreStep, setRestoreStep] = useState('idle'); // idle | confirm | done
  const [restoreResult, setRestoreResult] = useState(null);
  const [parsedBackup, setParsedBackup] = useState(null);
  const [backupMeta, setBackupMeta] = useState(null);
  const fileRef = useRef(null);

  // ── Download ──────────────────────────────────────────────────────────────

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await api.backup.download();
      if (!res || !res.ok) throw new Error('Backup request failed');

      // Get filename from Content-Disposition header
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `wastekpi-backup-${new Date().toISOString().slice(0, 10)}.json`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setToast({ msg: `Backup downloaded: ${filename}`, type: 'success' });
    } catch (e) {
      setToast({ msg: e.message, type: 'error' });
    } finally {
      setDownloading(false);
    }
  }

  // ── Restore file select ───────────────────────────────────────────────────

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
            employees:    json.tables.employees?.length    || 0,
            routes:       json.tables.routes?.length       || 0,
            route_logs:   json.tables.route_logs?.length   || 0,
            pack_out_logs: json.tables.pack_out_logs?.length || 0,
            clock_logs:   json.tables.clock_logs?.length   || 0,
          }
        });
        setRestoreStep('confirm');
      } catch (err) {
        setToast({ msg: `Invalid backup file: ${err.message}`, type: 'error' });
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }

  // ── Confirm restore ───────────────────────────────────────────────────────

  async function handleRestore() {
    if (!parsedBackup) return;
    setRestoring(true);
    try {
      const result = await api.backup.restore(parsedBackup);
      setRestoreResult(result.restored);
      setRestoreStep('done');
      setToast({ msg: 'Restore completed successfully', type: 'success' });
    } catch (e) {
      setToast({ msg: `Restore failed: ${e.message}`, type: 'error' });
    } finally {
      setRestoring(false);
    }
  }

  function resetRestore() {
    setRestoreStep('idle');
    setParsedBackup(null);
    setBackupMeta(null);
    setRestoreResult(null);
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  const rowStyle = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13
  };
  const labelStyle = { color: 'var(--text3)' };
  const valueStyle = { fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--mono)' };

  return (
    <div style={{ maxWidth: 720 }}>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 2 }}>Backup & Restore</h1>
        <p style={{ color: 'var(--text2)', fontSize: 13 }}>Download a full JSON snapshot of your database, or restore from a previous backup.</p>
      </div>

      {/* ── Backup section ── */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>⬇</span> Download Backup
            </div>
            <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0, maxWidth: 440 }}>
              Creates a <code style={{ background: 'var(--bg3)', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>.json</code> file containing all employees, routes, route logs, pack-out events, and clock logs. Save this file somewhere safe — it can be used to fully restore the database.
            </p>
            <p style={{ fontSize: 12, color: 'var(--text3)', margin: '8px 0 0' }}>
              ⚠ Admin user accounts and passwords are not included in the backup.
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleDownload}
            disabled={downloading}
            style={{ flexShrink: 0, minWidth: 140 }}
          >
            {downloading ? 'Downloading…' : '⬇ Download Backup'}
          </button>
        </div>
      </div>

      {/* ── Restore section ── */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>⬆</span> Restore from Backup
        </div>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
          Upload a previously downloaded backup file to restore all data. This will <strong>replace all current data</strong> in the database.
        </p>

        {/* Step: idle — file picker */}
        {restoreStep === 'idle' && (
          <>
            <div
              style={{
                border: '2px dashed var(--border2)', borderRadius: 'var(--radius-lg)',
                padding: '28px 24px', textAlign: 'center', cursor: 'pointer',
                background: 'var(--bg3)',
              }}
              onClick={() => fileRef.current?.click()}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>Click to select a backup file</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Select a <code>.json</code> file downloaded from this system</div>
              <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleFileSelect} style={{ display: 'none' }} />
            </div>
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--danger-dim)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--danger)' }}>
              ⚠ Restoring will <strong>permanently delete all existing data</strong> before importing the backup. Make sure to download a fresh backup first if you want to preserve current data.
            </div>
          </>
        )}

        {/* Step: confirm — show backup contents */}
        {restoreStep === 'confirm' && backupMeta && (
          <>
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Backup Contents</div>
              <div style={{ ...rowStyle }}><span style={labelStyle}>File</span><span style={valueStyle}>{backupMeta.filename}</span></div>
              <div style={{ ...rowStyle }}><span style={labelStyle}>Backup created</span><span style={valueStyle}>{fmtDate(backupMeta.created_at)}</span></div>
              <div style={{ ...rowStyle }}><span style={labelStyle}>Employees</span><span style={valueStyle}>{backupMeta.counts.employees}</span></div>
              <div style={{ ...rowStyle }}><span style={labelStyle}>Routes</span><span style={valueStyle}>{backupMeta.counts.routes}</span></div>
              <div style={{ ...rowStyle }}><span style={labelStyle}>Route Logs</span><span style={valueStyle}>{backupMeta.counts.route_logs.toLocaleString()}</span></div>
              <div style={{ ...rowStyle }}><span style={labelStyle}>Pack-Out Events</span><span style={valueStyle}>{backupMeta.counts.pack_out_logs.toLocaleString()}</span></div>
              <div style={{ ...rowStyle, borderBottom: 'none' }}><span style={labelStyle}>Clock Logs</span><span style={valueStyle}>{backupMeta.counts.clock_logs.toLocaleString()}</span></div>
            </div>

            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--danger-dim)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--danger)' }}>
              ⚠ This will <strong>delete all current data</strong> and replace it with the contents of this backup. This action cannot be undone.
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" onClick={resetRestore} disabled={restoring}>Cancel</button>
              <button
                onClick={handleRestore}
                disabled={restoring}
                style={{
                  padding: '8px 20px', borderRadius: 'var(--radius)', border: 'none',
                  cursor: restoring ? 'not-allowed' : 'pointer',
                  background: 'var(--danger)', color: '#fff',
                  fontSize: 13, fontWeight: 600, opacity: restoring ? 0.7 : 1,
                }}
              >
                {restoring ? 'Restoring…' : '⬆ Restore Now'}
              </button>
            </div>
          </>
        )}

        {/* Step: done — result summary */}
        {restoreStep === 'done' && restoreResult && (
          <>
            <div style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>Restore Complete</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>All data has been restored successfully.</div>
            </div>
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Records Restored</div>
              {Object.entries(restoreResult).map(([key, count]) => (
                <div key={key} style={{ ...rowStyle }}>
                  <span style={labelStyle}>{key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                  <span style={valueStyle}>{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-ghost" onClick={resetRestore}>Restore another file</button>
          </>
        )}
      </div>
    </div>
  );
}
