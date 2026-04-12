import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import Modal from './Modal';
import { api } from '../api';

function fmt(t) {
  if (!t) return '';
  const parts = t.slice(0, 5).split(':');
  const hr = parseInt(parts[0]);
  return `${hr % 12 || 12}:${parts[1]} ${hr < 12 ? 'AM' : 'PM'}`;
}

function dayLen(punchIn, punchOut) {
  if (!punchIn || !punchOut) return '';
  const [ah, am] = punchIn.slice(0, 5).split(':').map(Number);
  const [bh, bm] = punchOut.slice(0, 5).split(':').map(Number);
  const mins = (bh * 60 + bm) - (ah * 60 + am);
  if (mins <= 0) return '';
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function parseDate(val) {
  if (!val) return null;
  return new Date(String(val).slice(0, 10) + 'T00:00:00');
}

function fmtDateExcel(val) {
  const d = parseDate(val);
  if (!d) return String(val).slice(0, 10);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);
  return `${mm}/${dd}/${yy}`;
}

function fmtDateLabel(val) {
  const d = parseDate(val);
  if (!d) return val;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ExportModal({ onClose, currentDate }) {
  const today = new Date().toISOString().split('T')[0];

  const weekStart = (() => {
    const d = new Date(currentDate + 'T00:00:00');
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  })();

  const [from, setFrom] = useState(weekStart);
  const [to, setTo] = useState(currentDate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);

  async function fetchData() {
    if (!from || !to) { setError('Please select both dates.'); return null; }
    if (from > to) { setError('Start date must be before end date.'); return null; }
    setError('');
    return await api.routeLogs.list({ from, to });
  }

  async function loadPreview() {
    setLoading(true);
    try {
      const rows = await fetchData();
      if (rows) setPreview(rows);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function doExport() {
    setLoading(true);
    try {
      const rows = preview || await fetchData();
      if (!rows) return;

      // Determine max pack-out count across all rows
      const maxPackOuts = rows.reduce((m, r) => Math.max(m, (r.pack_outs || []).length), 0);

      // Build header row
      const headers = ['Date', 'Driver', 'Route #', 'Punch In', '1st Stop', 'Route Complete', 'Punch Out', 'Day Length', 'Notes'];
      for (let i = 1; i <= maxPackOuts; i++) {
        headers.push(`Pack Out ${i}`, `Back On Route ${i}`);
      }

      const wsData = [headers];

      rows.forEach(r => {
        const dataRow = [
          fmtDateExcel(r.log_date),
          r.employee_name || '',
          r.route_number || '',
          fmt(r.punch_in),
          fmt(r.first_stop_time),
          fmt(r.route_complete_time),
          fmt(r.punch_out),
          dayLen(r.punch_in, r.punch_out),
          r.notes || ''
        ];
        for (let i = 1; i <= maxPackOuts; i++) {
          const po = (r.pack_outs || [])[i - 1];
          dataRow.push(po ? fmt(po.pack_out_time) : '');
          dataRow.push(po ? fmt(po.back_on_route_time) : '');
        }
        wsData.push(dataRow);
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Column widths
      const colWidths = [
        { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 36 }
      ];
      for (let i = 0; i < maxPackOuts; i++) {
        colWidths.push({ wch: 14 }, { wch: 16 });
      }
      ws['!cols'] = colWidths;

      // Bold + green header
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
        if (cell) cell.s = { font: { bold: true }, fill: { fgColor: { rgb: 'D9EAD3' } } };
      }

      XLSX.utils.book_append_sheet(wb, ws, 'Route KPIs');

      const fromLabel = from.replace(/-/g, '');
      const toLabel = to.replace(/-/g, '');
      XLSX.writeFile(wb, `waste-kpi-${fromLabel}-${toLabel}.xlsx`);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { setPreview(null); }, [from, to]);

  const rangeLabel = from && to ? `${fmtDateLabel(from)} — ${fmtDateLabel(to)}` : '';

  return (
    <Modal title="Export to Excel" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)' }}>Date Range</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>From</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} max={today} />
            </div>
            <div className="form-group">
              <label>To</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} max={today} min={from} />
            </div>
          </div>
          {rangeLabel && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{rangeLabel}</div>}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label: 'Today', action: () => { setFrom(today); setTo(today); } },
            { label: 'This week', action: () => { setFrom(weekStart); setTo(today); } },
            { label: 'Last 7 days', action: () => { const d = new Date(today); d.setDate(d.getDate() - 6); setFrom(d.toISOString().split('T')[0]); setTo(today); } },
            { label: 'Last 30 days', action: () => { const d = new Date(today); d.setDate(d.getDate() - 29); setFrom(d.toISOString().split('T')[0]); setTo(today); } },
            { label: 'This month', action: () => { const d = new Date(today); setFrom(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`); setTo(today); } },
          ].map(btn => (
            <button key={btn.label} className="btn btn-ghost btn-sm" onClick={btn.action}>{btn.label}</button>
          ))}
        </div>

        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', minHeight: 80 }}>
          {preview === null ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--text3)' }}>Click Preview to check the data before exporting.</span>
              <button className="btn btn-ghost btn-sm" onClick={loadPreview} disabled={loading}>{loading ? 'Loading…' : 'Preview'}</button>
            </div>
          ) : preview.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '8px 0' }}>No records found for this date range.</div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>
                  <strong style={{ color: 'var(--accent)' }}>{preview.length}</strong> records across{' '}
                  <strong style={{ color: 'var(--text)' }}>{new Set(preview.map(r => String(r.log_date).slice(0, 10))).size}</strong> days
                  {preview.some(r => (r.pack_outs || []).length > 0) && (
                    <span style={{ color: 'var(--text3)', marginLeft: 8 }}>
                      · includes pack-out data
                    </span>
                  )}
                </span>
                <button className="btn btn-ghost btn-sm" onClick={loadPreview} disabled={loading}>Refresh</button>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 180, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['Date', 'Driver', 'Route', 'Punch In', 'Punch Out', 'Day Length', 'Pack Outs'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text3)', fontWeight: 500, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 20).map(r => (
                      <tr key={r.id}>
                        <td style={{ padding: '4px 8px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{fmtDateExcel(r.log_date)}</td>
                        <td style={{ padding: '4px 8px', fontWeight: 500, whiteSpace: 'nowrap' }}>{r.employee_name}</td>
                        <td style={{ padding: '4px 8px', color: 'var(--text2)' }}>{r.route_number || '—'}</td>
                        <td style={{ padding: '4px 8px', fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{fmt(r.punch_in)}</td>
                        <td style={{ padding: '4px 8px', fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{fmt(r.punch_out)}</td>
                        <td style={{ padding: '4px 8px', color: dayLen(r.punch_in, r.punch_out) ? 'var(--accent)' : 'var(--text3)', fontWeight: 500 }}>
                          {dayLen(r.punch_in, r.punch_out) || '—'}
                        </td>
                        <td style={{ padding: '4px 8px', color: (r.pack_outs || []).length ? 'var(--amber)' : 'var(--text3)' }}>
                          {(r.pack_outs || []).length || '—'}
                        </td>
                      </tr>
                    ))}
                    {preview.length > 20 && (
                      <tr><td colSpan={7} style={{ padding: '6px 8px', color: 'var(--text3)', textAlign: 'center' }}>… and {preview.length - 20} more rows</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 13, padding: '8px 12px', background: 'var(--danger-dim)', borderRadius: 'var(--radius)' }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          {preview === null ? (
            <button className="btn btn-primary" onClick={loadPreview} disabled={loading}>{loading ? 'Loading…' : 'Preview'}</button>
          ) : (
            <button className="btn btn-primary" onClick={doExport} disabled={loading || preview.length === 0}>
              {loading ? 'Exporting…' : `Export ${preview.length} rows`}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
