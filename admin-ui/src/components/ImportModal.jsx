import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import Modal from './Modal';
import { api } from '../api';

const COL_MAP = {
  date:           ['date'],
  driver:         ['driver', 'driver name', 'employee', 'name'],
  route_number:   ['route #', 'route#', 'route number', 'route'],
  punch_in:       ['punch in', 'punchin', 'clock in', 'clockin'],
  first_stop:     ['1st stop', 'first stop', '1st stop time', 'first stop time'],
  route_complete: ['route complete', 'route complete time', 'route done', 'complete time'],
  punch_out:      ['punch out', 'punchout', 'clock out', 'clockout'],
  notes:          ['notes', 'note', 'comments'],
};

function findCol(headers, key) {
  const aliases = COL_MAP[key];
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || '').toLowerCase().trim();
    if (aliases.some(a => a === h)) return i;
  }
  return -1;
}

// Find "Pack Out N" and "Back On Route N" column pairs
function findPackOutCols(headers) {
  const pairs = []; // [{packOutIdx, backOnRouteIdx}]
  let n = 1;
  while (true) {
    const poLabel  = `pack out ${n}`;
    const borLabel = `back on route ${n}`;
    const poIdx  = headers.findIndex(h => String(h || '').toLowerCase().trim() === poLabel);
    const borIdx = headers.findIndex(h => String(h || '').toLowerCase().trim() === borLabel);
    if (poIdx === -1 && borIdx === -1) break;
    pairs.push({ packOutIdx: poIdx, backOnRouteIdx: borIdx });
    n++;
    if (n > 20) break;
  }
  return pairs;
}

export default function ImportModal({ onClose, onImported }) {
  const fileRef = useRef(null);
  const [step, setStep] = useState('upload');
  const [parsed, setParsed] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [fileName, setFileName] = useState('');
  const [maxPackOuts, setMaxPackOuts] = useState(0);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (raw.length < 2) { setError('File appears to be empty or has no data rows.'); return; }

        const headers = raw[0];
        const detected = {};
        const missing = [];

        ['date', 'driver', 'route_number', 'punch_in', 'first_stop', 'route_complete', 'punch_out', 'notes'].forEach(key => {
          const idx = findCol(headers, key);
          if (idx >= 0) detected[key] = idx;
          else if (['date', 'driver'].includes(key)) missing.push(key);
        });

        if (missing.length > 0) {
          setError(`Could not find required columns: ${missing.join(', ')}. Make sure your file uses the standard export format.`);
          return;
        }

        const packOutPairs = findPackOutCols(headers);
        setMaxPackOuts(packOutPairs.length);

        const rows = [];
        for (let i = 1; i < raw.length; i++) {
          const r = raw[i];
          if (r.every(c => c === '' || c === null || c === undefined)) continue;

          const row = {
            date:           r[detected.date]           ?? '',
            driver:         r[detected.driver]         ?? '',
            route_number:   detected.route_number   >= 0 ? (r[detected.route_number]   ?? '') : '',
            punch_in:       detected.punch_in        >= 0 ? (r[detected.punch_in]        ?? '') : '',
            first_stop:     detected.first_stop      >= 0 ? (r[detected.first_stop]      ?? '') : '',
            route_complete: detected.route_complete  >= 0 ? (r[detected.route_complete]  ?? '') : '',
            punch_out:      detected.punch_out       >= 0 ? (r[detected.punch_out]       ?? '') : '',
            notes:          detected.notes           >= 0 ? (r[detected.notes]           ?? '') : '',
          };

          // Add pack-out pairs as pack_out_N / back_on_route_N keys
          packOutPairs.forEach(({ packOutIdx, backOnRouteIdx }, idx) => {
            row[`pack_out_${idx + 1}`]      = packOutIdx >= 0      ? (r[packOutIdx]      ?? '') : '';
            row[`back_on_route_${idx + 1}`] = backOnRouteIdx >= 0  ? (r[backOnRouteIdx]  ?? '') : '';
          });

          rows.push(row);
        }

        if (rows.length === 0) { setError('No data rows found in the file.'); return; }

        setParsed(rows);
        setStep('preview');
      } catch (err) {
        setError(`Failed to parse file: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function doImport() {
    setLoading(true);
    setError('');
    try {
      const res = await api.import.upload(parsed);
      setResult(res);
      setStep('result');
      if (res.imported > 0 && onImported) onImported();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep('upload');
    setParsed([]);
    setError('');
    setResult(null);
    setFileName('');
    setMaxPackOuts(0);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <Modal title="Import from Excel" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {step === 'upload' && (
          <>
            <div style={{
              background: 'var(--bg3)', border: '2px dashed var(--border2)',
              borderRadius: 'var(--radius-lg)', padding: '32px 24px',
              textAlign: 'center', cursor: 'pointer'
            }} onClick={() => fileRef.current?.click()}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>📂</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>Click to select an Excel file</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Use a file exported from this system (.xlsx)</div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} />
            </div>

            <div style={{ background: 'var(--info-dim)', border: '1px solid var(--info)', borderRadius: 'var(--radius)', padding: '12px 14px', fontSize: 12, color: 'var(--info)' }}>
              <strong>Expected columns:</strong> Date (MM/DD/YY), Driver, Route #, Punch In, 1st Stop, Route Complete, Punch Out, Notes
              <br />Optional: Pack Out 1, Back On Route 1, Pack Out 2, Back On Route 2, …
              <br />Dates and times can be left blank — only Date and Driver are required per row.
            </div>

            {error && <div style={{ color: 'var(--danger)', fontSize: 13, padding: '8px 12px', background: 'var(--danger-dim)', borderRadius: 'var(--radius)' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}

        {step === 'preview' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{fileName}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                  <strong style={{ color: 'var(--accent)' }}>{parsed.length}</strong> rows ready to import
                  {maxPackOuts > 0 && <span style={{ color: 'var(--text3)', marginLeft: 8 }}>· up to {maxPackOuts} pack-out event{maxPackOuts !== 1 ? 's' : ''} per row</span>}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={reset}>Choose different file</button>
            </div>

            <div style={{ overflowX: 'auto', maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg2)' }}>
                  <tr>
                    {['Date', 'Driver', 'Route #', 'Punch In', '1st Stop', 'Route Done', 'Punch Out', 'Pack Outs', 'Notes'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text3)', fontWeight: 500, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 30).map((r, i) => {
                    const poCount = Array.from({ length: maxPackOuts }, (_, idx) =>
                      r[`pack_out_${idx + 1}`] || r[`back_on_route_${idx + 1}`]
                    ).filter(Boolean).length;
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td style={{ padding: '5px 10px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{String(r.date)}</td>
                        <td style={{ padding: '5px 10px', fontWeight: 500, whiteSpace: 'nowrap' }}>{r.driver}</td>
                        <td style={{ padding: '5px 10px', color: 'var(--text2)' }}>{r.route_number || '—'}</td>
                        <td style={{ padding: '5px 10px', fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{r.punch_in || '—'}</td>
                        <td style={{ padding: '5px 10px', fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{r.first_stop || '—'}</td>
                        <td style={{ padding: '5px 10px', fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{r.route_complete || '—'}</td>
                        <td style={{ padding: '5px 10px', fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{r.punch_out || '—'}</td>
                        <td style={{ padding: '5px 10px', color: poCount ? 'var(--amber)' : 'var(--text3)' }}>{poCount || '—'}</td>
                        <td style={{ padding: '5px 10px', color: 'var(--text3)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.notes || '—'}</td>
                      </tr>
                    );
                  })}
                  {parsed.length > 30 && (
                    <tr><td colSpan={9} style={{ padding: '6px 10px', color: 'var(--text3)', textAlign: 'center' }}>… and {parsed.length - 30} more rows</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ background: 'var(--warn)' + '18', border: '1px solid var(--warn)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 12, color: 'var(--warn)' }}>
              ⚠ Existing records for the same driver + date will be <strong>overwritten</strong>, including their pack-out events.
            </div>

            {error && <div style={{ color: 'var(--danger)', fontSize: 13, padding: '8px 12px', background: 'var(--danger-dim)', borderRadius: 'var(--radius)' }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={reset}>Back</button>
              <button className="btn btn-primary" onClick={doImport} disabled={loading}>
                {loading ? 'Importing…' : `Import ${parsed.length} rows`}
              </button>
            </div>
          </>
        )}

        {step === 'result' && result && (
          <>
            <div style={{
              background: result.imported > 0 ? 'var(--accent-dim)' : 'var(--bg3)',
              border: `1px solid ${result.imported > 0 ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-lg)', padding: '20px 24px', textAlign: 'center'
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{result.imported > 0 ? '✅' : '⚠️'}</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: result.imported > 0 ? 'var(--accent)' : 'var(--text)', marginBottom: 4 }}>
                {result.imported} row{result.imported !== 1 ? 's' : ''} imported
              </div>
              {result.skipped > 0 && <div style={{ fontSize: 13, color: 'var(--text2)' }}>{result.skipped} row{result.skipped !== 1 ? 's' : ''} skipped</div>}
            </div>

            {result.errors && result.errors.length > 0 && (
              <div style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', marginBottom: 6 }}>Skipped rows:</div>
                <div style={{ maxHeight: 140, overflowY: 'auto' }}>
                  {result.errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 2 }}>• {e}</div>)}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={reset}>Import another file</button>
              <button className="btn btn-primary" onClick={onClose}>Done</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
