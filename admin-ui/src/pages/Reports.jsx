import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import Toast from '../components/Toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMondayOfWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function today() { return new Date().toISOString().split('T')[0]; }
function startOfWeek() { return getMondayOfWeek(today()); }
function endOfWeek() { return addDays(startOfWeek(), 6); }
function startOfLastWeek() { return addDays(startOfWeek(), -7); }
function endOfLastWeek() { return addDays(startOfWeek(), -1); }
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

async function triggerCsvDownload(responsePromise) {
  const res = await responsePromise;
  if (!res || !res.ok) throw new Error('CSV download failed');
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : 'report.csv';
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Shared UI pieces ─────────────────────────────────────────────────────────

function SectionCard({ title, description, children }) {
  return (
    <div className="card" style={{ padding: 24, marginBottom: 20 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{title}</div>
        {description && <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0 }}>{description}</p>}
      </div>
      {children}
    </div>
  );
}

function RunButton({ onClick, loading, label = 'Run Report' }) {
  return (
    <button className="btn btn-primary" onClick={onClick} disabled={loading} style={{ minWidth: 120 }}>
      {loading ? 'Running…' : label}
    </button>
  );
}

function ExportCsvButton({ onClick, disabled }) {
  return (
    <button className="btn btn-ghost" onClick={onClick} disabled={disabled}>
      ↓ Export CSV
    </button>
  );
}

function EmptyResult() {
  return (
    <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
      No data found for the selected criteria.
    </div>
  );
}

// ─── Tab 1: Friday Hours Report ───────────────────────────────────────────────

function FridayHoursReport({ setToast }) {
  const defaultWeek = getMondayOfWeek(today());
  const [weekOf, setWeekOf] = useState(defaultWeek);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Auto-compute day labels from the selected week
  const mon = weekOf;
  const tue = addDays(weekOf, 1);
  const wed = addDays(weekOf, 2);
  const thu = addDays(weekOf, 3);

  async function run() {
    setLoading(true);
    try {
      const data = await api.reports.fridayHours(weekOf);
      setResult(data);
    } catch (e) { setToast({ msg: e.message, type: 'error' }); }
    finally { setLoading(false); }
  }

  async function exportCsv() {
    try { await triggerCsvDownload(api.reports.fridayHoursCsv(weekOf)); }
    catch (e) { setToast({ msg: e.message, type: 'error' }); }
  }

  const thStyle = {
    padding: '8px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600,
    color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em',
    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
  };

  const tdStyle = (highlight) => ({
    padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: 12,
    color: highlight ? 'var(--text)' : 'var(--text2)',
  });

  return (
    <SectionCard
      title="📅 Friday Hours Summary"
      description="Total hours per driver for Monday–Thursday of the selected week. Sorted most hours first — use this on Fridays to decide who gets sent out first."
    >
      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 12 }}>Any date within the target week</label>
          <input
            type="date"
            value={weekOf}
            onChange={e => {
              setWeekOf(getMondayOfWeek(e.target.value));
              setResult(null);
            }}
            style={{ width: 160 }}
          />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', paddingBottom: 8 }}>
          Week: <strong style={{ color: 'var(--text2)' }}>{fmtDate(mon)} – {fmtDate(thu)}</strong>
        </div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          {result && <ExportCsvButton onClick={exportCsv} />}
          <RunButton onClick={run} loading={loading} />
        </div>
      </div>

      {/* Results */}
      {result && (
        result.rows.length === 0 ? <EmptyResult /> : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
              {result.rows.length} driver{result.rows.length !== 1 ? 's' : ''} &nbsp;·&nbsp;
              Week of {fmtDate(result.monday)}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Driver</th>
                  <th style={thStyle}>Mon {fmtDate(mon)}</th>
                  <th style={thStyle}>Tue {fmtDate(tue)}</th>
                  <th style={thStyle}>Wed {fmtDate(wed)}</th>
                  <th style={thStyle}>Thu {fmtDate(thu)}</th>
                  <th style={{ ...thStyle, color: 'var(--accent)' }}>Total</th>
                  <th style={thStyle}>Days</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r, i) => {
                  const noData = r.days_worked === 0;
                  return (
                    <tr key={r.employee_name} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)', opacity: noData ? 0.45 : 1 }}>
                      <td style={{ padding: '10px 14px', fontWeight: 500, fontSize: 14 }}>
                        {i < 3 && !noData && (
                          <span style={{ marginRight: 6, fontSize: 12 }}>
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                          </span>
                        )}
                        {r.employee_name}
                      </td>
                      <td style={tdStyle(!!r.monday)}>{r.monday || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                      <td style={tdStyle(!!r.tuesday)}>{r.tuesday || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                      <td style={tdStyle(!!r.wednesday)}>{r.wednesday || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                      <td style={tdStyle(!!r.thursday)}>{r.thursday || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 14, color: noData ? 'var(--text3)' : 'var(--accent)' }}>
                        {r.total_hours}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text3)' }}>
                        {r.days_worked} / 4
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </SectionCard>
  );
}

// ─── Tab 2: Custom Report Builder ─────────────────────────────────────────────

const ALL_COLUMNS = [
  { key: 'employee_name',       label: 'Driver Name' },
  { key: 'log_date',            label: 'Date' },
  { key: 'route_number',        label: 'Route' },
  { key: 'route_area',          label: 'Area' },
  { key: 'punch_in',            label: 'Punch In' },
  { key: 'first_stop_time',     label: '1st Stop' },
  { key: 'route_complete_time', label: 'Route Complete' },
  { key: 'to_yard_time',        label: 'To Yard' },
  { key: 'punch_out',           label: 'Punch Out' },
  { key: 'day_length',          label: 'Day Length' },
  { key: 'pack_out_count',      label: 'Pack Out Count' },
  { key: 'notes',               label: 'Notes' },
];

const DATE_PRESETS = [
  { label: 'Today',       from: today,            to: today },
  { label: 'This Week',   from: startOfWeek,      to: endOfWeek },
  { label: 'Last Week',   from: startOfLastWeek,  to: endOfLastWeek },
  { label: 'Last 30 Days', from: () => daysAgo(30), to: today },
  { label: 'Last 90 Days', from: () => daysAgo(90), to: today },
];

function CustomReportBuilder({ setToast }) {
  const [employees, setEmployees] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Form state
  const [selectedCols, setSelectedCols] = useState(
    ALL_COLUMNS.filter(c => !['route_area','to_yard_time','pack_out_count','notes'].includes(c.key)).map(c => c.key)
  );
  const [dateFrom, setDateFrom] = useState(daysAgo(30));
  const [dateTo, setDateTo] = useState(today());
  const [activePreset, setActivePreset] = useState(null);
  const [selectedDrivers, setSelectedDrivers] = useState([]); // empty = all
  const [selectedRoutes, setSelectedRoutes] = useState([]);   // empty = all
  const [status, setStatus] = useState('all');

  useEffect(() => {
    api.employees.list().then(setEmployees).catch(() => {});
    api.routes.listAll().then(setRoutes).catch(() => {});
  }, []);

  function applyPreset(preset) {
    setDateFrom(preset.from());
    setDateTo(preset.to());
    setActivePreset(preset.label);
    setResult(null);
  }

  function toggleCol(key) {
    setSelectedCols(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }

  function toggleDriver(id) {
    setSelectedDrivers(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }

  function toggleRoute(name) {
    setSelectedRoutes(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  }

  async function run() {
    if (selectedCols.length === 0) {
      setToast({ msg: 'Select at least one column', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      const data = await api.reports.custom({
        columns: selectedCols,
        date_from: dateFrom,
        date_to: dateTo,
        driver_ids: selectedDrivers,
        route_numbers: selectedRoutes,
        status,
      });
      setResult(data);
    } catch (e) { setToast({ msg: e.message, type: 'error' }); }
    finally { setLoading(false); }
  }

  async function exportCsv() {
    try {
      await triggerCsvDownload(api.reports.customCsv({
        columns: selectedCols,
        date_from: dateFrom,
        date_to: dateTo,
        driver_ids: selectedDrivers,
        route_numbers: selectedRoutes,
        status,
      }));
    } catch (e) { setToast({ msg: e.message, type: 'error' }); }
  }

  const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 };
  const sectionStyle = { marginBottom: 20 };

  return (
    <SectionCard
      title="🔧 Report Builder"
      description="Build a custom report by selecting columns, a date range, and optional filters. Run to preview results inline, then export to CSV."
    >
      {/* ── Step 1: Columns ── */}
      <div style={sectionStyle}>
        <div style={labelStyle}>1 — Columns to include</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ALL_COLUMNS.map(col => {
            const on = selectedCols.includes(col.key);
            return (
              <button
                key={col.key}
                onClick={() => toggleCol(col.key)}
                style={{
                  padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 500,
                  cursor: 'pointer', border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                  background: on ? 'var(--accent-dim)' : 'transparent',
                  color: on ? 'var(--accent)' : 'var(--text2)',
                  transition: 'all 0.12s',
                }}
              >
                {col.label}
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelectedCols(ALL_COLUMNS.map(c => c.key))}>Select All</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelectedCols([])}>Clear</button>
        </div>
      </div>

      {/* ── Step 2: Date range ── */}
      <div style={sectionStyle}>
        <div style={labelStyle}>2 — Date range</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {DATE_PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              style={{
                padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 500,
                cursor: 'pointer', border: `1px solid ${activePreset === p.label ? 'var(--accent)' : 'var(--border)'}`,
                background: activePreset === p.label ? 'var(--accent-dim)' : 'transparent',
                color: activePreset === p.label ? 'var(--accent)' : 'var(--text2)',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 11, color: 'var(--text3)' }}>From</label>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setActivePreset(null); setResult(null); }} style={{ width: 150 }} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 11, color: 'var(--text3)' }}>To</label>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setActivePreset(null); setResult(null); }} style={{ width: 150 }} />
          </div>
        </div>
      </div>

      {/* ── Step 3: Filters ── */}
      <div style={sectionStyle}>
        <div style={labelStyle}>3 — Filters <span style={{ fontWeight: 400, fontSize: 10, textTransform: 'none', letterSpacing: 0 }}>(all optional)</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

          {/* Driver filter */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6, fontWeight: 500 }}>
              Drivers <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{selectedDrivers.length > 0 ? `(${selectedDrivers.length} selected)` : '(all)'}</span>
            </div>
            <div style={{ maxHeight: 140, overflowY: 'auto', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '6px 0' }}>
              {employees.map(e => {
                const on = selectedDrivers.includes(e.id);
                return (
                  <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 12, color: on ? 'var(--text)' : 'var(--text2)', background: on ? 'var(--accent-dim)' : 'transparent' }}>
                    <input type="checkbox" checked={on} onChange={() => toggleDriver(e.id)} style={{ width: 'auto' }} />
                    {e.name}
                  </label>
                );
              })}
            </div>
            {selectedDrivers.length > 0 && (
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 4 }} onClick={() => setSelectedDrivers([])}>Clear</button>
            )}
          </div>

          {/* Route filter */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6, fontWeight: 500 }}>
              Routes <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{selectedRoutes.length > 0 ? `(${selectedRoutes.length} selected)` : '(all)'}</span>
            </div>
            <div style={{ maxHeight: 140, overflowY: 'auto', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '6px 0' }}>
              {routes.map(r => {
                const on = selectedRoutes.includes(r.route_name);
                return (
                  <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 12, color: on ? 'var(--text)' : 'var(--text2)', background: on ? 'var(--accent-dim)' : 'transparent' }}>
                    <input type="checkbox" checked={on} onChange={() => toggleRoute(r.route_name)} style={{ width: 'auto' }} />
                    {r.route_name}{r.area ? ` — ${r.area}` : ''}
                  </label>
                );
              })}
            </div>
            {selectedRoutes.length > 0 && (
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 4 }} onClick={() => setSelectedRoutes([])}>Clear</button>
            )}
          </div>

          {/* Status filter */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6, fontWeight: 500 }}>Completion Status</div>
            {[['all', 'All entries'], ['complete', 'Complete only (punched out)'], ['incomplete', 'Incomplete only (still active)']].map(([val, lbl]) => (
              <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer', fontSize: 12, color: status === val ? 'var(--text)' : 'var(--text2)' }}>
                <input type="radio" name="status" value={val} checked={status === val} onChange={() => setStatus(val)} style={{ width: 'auto' }} />
                {lbl}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* ── Step 4: Run / Export ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 4, borderTop: '1px solid var(--border)' }}>
        <RunButton onClick={run} loading={loading} />
        {result && (
          <>
            <ExportCsvButton onClick={exportCsv} />
            <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 4 }}>
              {result.row_count.toLocaleString()} row{result.row_count !== 1 ? 's' : ''}
            </span>
          </>
        )}
      </div>

      {/* Results table */}
      {result && (
        result.rows.length === 0 ? (
          <div style={{ marginTop: 20 }}><EmptyResult /></div>
        ) : (
          <div style={{ marginTop: 20, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {result.columns.map(col => {
                    const label = ALL_COLUMNS.find(c => c.key === col)?.label || col;
                    return (
                      <th key={col} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                        {label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    {result.columns.map(col => {
                      const val = row[col];
                      const isTime = ['punch_in','first_stop_time','route_complete_time','to_yard_time','punch_out'].includes(col);
                      const isHighlight = col === 'day_length';
                      return (
                        <td key={col} style={{
                          padding: '9px 14px',
                          fontSize: isTime ? 12 : 13,
                          fontFamily: isTime ? 'var(--mono)' : 'inherit',
                          color: isHighlight ? 'var(--accent)' : val === null ? 'var(--text3)' : 'var(--text2)',
                          fontWeight: isHighlight ? 600 : (col === 'employee_name' ? 500 : 400),
                          whiteSpace: col === 'notes' ? 'pre-wrap' : 'nowrap',
                          maxWidth: col === 'notes' ? 300 : undefined,
                          wordBreak: col === 'notes' ? 'break-word' : undefined,
                        }}>
                          {val !== null && val !== undefined ? String(val) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </SectionCard>
  );
}

// ─── Main Reports page ────────────────────────────────────────────────────────

export default function Reports() {
  const [tab, setTab] = useState('friday');
  const [toast, setToast] = useState(null);

  const tabs = [
    { id: 'friday', label: '📅 Friday Hours' },
    { id: 'builder', label: '🔧 Report Builder' },
  ];

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 2 }}>Reports</h1>
        <p style={{ color: 'var(--text2)', fontSize: 13 }}>Canned reports and a flexible report builder for analyzing route log data.</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
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

      {tab === 'friday'  && <FridayHoursReport  setToast={setToast} />}
      {tab === 'builder' && <CustomReportBuilder setToast={setToast} />}
    </div>
  );
}
