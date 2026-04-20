import React, { useState, useEffect, useCallback } from 'react';

const REFRESH_INTERVAL = 60000;

function fmt(t) {
  if (!t) return '—';
  const parts = t.slice(0, 5).split(':');
  const hr = parseInt(parts[0]);
  return `${hr % 12 || 12}:${parts[1]} ${hr < 12 ? 'AM' : 'PM'}`;
}

function dayLen(a, b) {
  if (!a || !b) return null;
  const [ah, am] = a.slice(0, 5).split(':').map(Number);
  const [bh, bm] = b.slice(0, 5).split(':').map(Number);
  const mins = (bh * 60 + bm) - (ah * 60 + am);
  if (mins <= 0) return null;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function fmtHours(h) {
  if (!h) return '—';
  const hrs = parseFloat(h);
  const hh = Math.floor(hrs);
  const mm = Math.round((hrs - hh) * 60);
  return mm > 0 ? `${hh}h ${mm}m` : `${hh}h`;
}

function fmtMins(m) {
  if (m === null || m === undefined) return '—';
  const mins = parseFloat(m);
  if (isNaN(mins)) return '—';
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const rem = Math.round(mins % 60);
    return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
  }
  return `${Math.round(mins)}m`;
}

function timeToDate(timeStr) {
  if (!timeStr) return null;
  const [h, m, s] = timeStr.slice(0, 8).split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, s || 0, 0);
  return d;
}

function minutesOnClock(punchInStr, now) {
  const t = timeToDate(punchInStr);
  if (!t) return null;
  const diff = (now - t) / 60000;
  return diff > 0 ? diff : null;
}

function fmtOnClock(mins) {
  if (mins === null) return '—';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function RouteBadge({ routeNumber, routeArea }) {
  if (!routeNumber) return <span style={{ color: 'var(--text3)' }}>—</span>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 4, color: 'var(--text)' }}>
        {routeNumber}
      </span>
      {routeArea && routeArea.trim() && (
        <span style={{ fontSize: 10, fontWeight: 600, background: 'rgba(79,195,247,0.12)', color: 'var(--blue)', border: '1px solid rgba(79,195,247,0.25)', padding: '1px 7px', borderRadius: 99, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
          {routeArea.trim()}
        </span>
      )}
    </span>
  );
}

// exclude_from_next_up filters the driver from the recommendation entirely
function computeNextUp(logs, now) {
  return logs
    .filter(r => !!r.punch_in && !r.exclude_from_next_up)
    .map(r => ({ ...r, mins_on_clock: minutesOnClock(r.punch_in, now) }))
    .sort((a, b) => {
      const ta = timeToDate(a.punch_in);
      const tb = timeToDate(b.punch_in);
      if (!ta && !tb) return 0;
      if (!ta) return 1;
      if (!tb) return -1;
      return tb - ta;
    });
}

function StatTile({ label, value, sub, color = 'var(--text)', accent }) {
  return (
    <div style={{ background: 'var(--bg2)', border: `1px solid ${accent || 'var(--border)'}`, borderTop: accent ? `3px solid ${accent}` : `1px solid var(--border)`, borderRadius: 12, padding: '18px 22px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 40, fontWeight: 700, fontFamily: 'var(--font-cond)', color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function LongestRouteTile({ topRoutes }) {
  const r7  = topRoutes?.route_7d  || '—';
  const h7  = fmtHours(topRoutes?.avg_hours_7d);
  const r30 = topRoutes?.route_30d || '—';
  const h30 = fmtHours(topRoutes?.avg_hours_30d);
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderTop: '3px solid var(--amber)', borderRadius: 12, padding: '18px 22px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Longest Avg Route</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>7d</span>
            <span style={{ fontFamily: 'var(--font-cond)', fontSize: 22, fontWeight: 700, color: 'var(--amber)', lineHeight: 1 }}>{r7}</span>
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>{h7}</span>
        </div>
        <div style={{ height: 1, background: 'var(--border)' }} />
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>30d</span>
            <span style={{ fontFamily: 'var(--font-cond)', fontSize: 22, fontWeight: 700, color: 'var(--blue)', lineHeight: 1 }}>{r30}</span>
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>{h30}</span>
        </div>
      </div>
    </div>
  );
}

function NextUpCard({ logs, now }) {
  const ranked = computeNextUp(logs, now);
  const top = ranked[0] || null;
  const rest = ranked.slice(1);

  const statusLabel = (r) => {
    if (r.punch_out) return { text: 'DONE', color: 'var(--green)' };
    if (r.route_complete_time) return { text: 'WRAPPING UP', color: 'var(--amber)' };
    return { text: 'ON ROUTE', color: 'var(--blue)' };
  };

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderTop: '3px solid #f59e0b', borderRadius: 12, padding: '14px 18px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#f59e0b' }}>Next Up</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>Route Assignment Recommendation</div>
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>LIVE</span>
      </div>

      {ranked.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, color: 'var(--text3)', fontSize: 13 }}>No drivers available</div>
      ) : (
        <>
          <div style={{ paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 10, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', flexShrink: 0, animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontFamily: 'var(--font-cond)', fontSize: 24, fontWeight: 700, color: '#f59e0b', letterSpacing: 1, lineHeight: 1 }}>{top.employee_name}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: statusLabel(top).color, letterSpacing: '0.08em' }}>{statusLabel(top).text}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Clocked In</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{fmt(top.punch_in)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>On Clock</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{fmtOnClock(top.mins_on_clock)}</span>
              </div>
              {top.route_number && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Route</span>
                  <RouteBadge routeNumber={top.route_number} routeArea={top.route_area} />
                </div>
              )}
            </div>
          </div>

          {rest.length > 0 && (
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Also Available</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {rest.map((r, idx) => {
                  const sl = statusLabel(r);
                  return (
                    <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 7, borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', width: 20, flexShrink: 0 }}>#{idx + 2}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{r.employee_name}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, color: sl.color, letterSpacing: '0.06em', marginLeft: 'auto' }}>{sl.text}</span>
                      </div>
                      <div style={{ paddingLeft: 26, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text2)' }}>in {fmt(r.punch_in)} · {fmtOnClock(r.mins_on_clock)} on clock</span>
                        {r.route_number && <RouteBadge routeNumber={r.route_number} routeArea={r.route_area} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 28, fontWeight: 400, letterSpacing: 2, color: 'var(--green)', lineHeight: 1 }}>
        {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
        {time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
      </div>
    </div>
  );
}

function ClockAvgCard({ clockAvgs }) {
  const ci7  = clockAvgs?.avg_clock_in_7d   || '—';
  const co7  = clockAvgs?.avg_clock_out_7d  || '—';
  const ci30 = clockAvgs?.avg_clock_in_30d  || '—';
  const co30 = clockAvgs?.avg_clock_out_30d || '—';
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderTop: '3px solid var(--green)', borderRadius: 12, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Avg Clock Times</div>
      <div style={{ display: 'flex', gap: 0, flex: 1 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>CLOCK IN</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 10, color: 'var(--text3)', width: 28 }}>7d</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 600, color: 'var(--green)' }}>{ci7}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 10, color: 'var(--text3)', width: 28 }}>30d</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 600, color: 'var(--text2)' }}>{ci30}</span>
            </div>
          </div>
        </div>
        <div style={{ width: 1, background: 'var(--border)', margin: '0 12px' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>CLOCK OUT</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 10, color: 'var(--text3)', width: 28 }}>7d</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 600, color: 'var(--amber)' }}>{co7}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 10, color: 'var(--text3)', width: 28 }}>30d</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 600, color: 'var(--text2)' }}>{co30}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FirstStopCard({ firstStopAvgs }) {
  const m7  = firstStopAvgs?.avg_to_first_stop_mins_7d;
  const m30 = firstStopAvgs?.avg_to_first_stop_mins_30d;
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderTop: '3px solid var(--blue)', borderRadius: 12, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Avg Punch In → 1st Stop</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, justifyContent: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>7-DAY AVG</span>
          <span style={{ fontFamily: 'var(--font-cond)', fontSize: 26, fontWeight: 700, color: 'var(--blue)', lineHeight: 1 }}>{fmtMins(m7)}</span>
        </div>
        <div style={{ height: 1, background: 'var(--border)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>30-DAY AVG</span>
          <span style={{ fontFamily: 'var(--font-cond)', fontSize: 26, fontWeight: 700, color: 'var(--text2)', lineHeight: 1 }}>{fmtMins(m30)}</span>
        </div>
      </div>
    </div>
  );
}

function sortedByRoutePace(logs) {
  return [...logs].sort((a, b) => {
    const aAvg = a.avg_route_mins_7d != null ? parseFloat(a.avg_route_mins_7d) : null;
    const bAvg = b.avg_route_mins_7d != null ? parseFloat(b.avg_route_mins_7d) : null;
    if (aAvg === null && bAvg === null) return (a.employee_name || '').localeCompare(b.employee_name || '');
    if (aAvg === null) return 1;
    if (bAvg === null) return -1;
    return aAvg - bAvg;
  });
}

const COL_COUNT = 10;

function DriverTable({ logs }) {
  const sorted = sortedByRoutePace(logs);
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text2)' }}>Driver Route KPIs</span>
          <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 10 }}>sorted fastest → slowest (7d avg)</span>
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>TODAY</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sorted.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No entries logged today</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['#', 'Driver', 'Route', 'Punch In', '1st Stop', 'Route Done', 'Punch Out', 'Day Length', 'Avg Route (7d)', 'Status'].map(h => (
                  <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => {
                const dl = dayLen(r.punch_in, r.punch_out);
                const status = r.punch_out ? 'done' : r.punch_in ? 'active' : 'pending';
                const statusColor = { done: 'var(--green)', active: 'var(--blue)', pending: 'var(--text3)' };
                const statusLabel = { done: 'COMPLETE', active: 'IN PROGRESS', pending: 'PENDING' };
                const avgMins = r.avg_route_mins_7d != null ? parseFloat(r.avg_route_mins_7d) : null;
                const hasNotes = !!(r.notes && r.notes.trim());
                const rowStyle = { background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' };
                return (
                  <React.Fragment key={r.id}>
                    <tr style={rowStyle}>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{avgMins !== null ? `#${i + 1}` : '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 14, fontWeight: 600 }}>{r.employee_name}</td>
                      <td style={{ padding: '10px 14px' }}><RouteBadge routeNumber={r.route_number} routeArea={r.route_area} /></td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)' }}>{fmt(r.punch_in)}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)' }}>{fmt(r.first_stop_time)}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)' }}>{fmt(r.route_complete_time)}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)' }}>{fmt(r.punch_out)}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: dl ? 'var(--green)' : 'var(--text3)' }}>{dl || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: avgMins !== null ? 'var(--blue)' : 'var(--text3)', fontFamily: 'var(--mono)' }}>{avgMins !== null ? fmtMins(avgMins) : '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: statusColor[status] }}>
                          {status === 'active' && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--blue)', marginRight: 5, verticalAlign: 'middle', animation: 'pulse 1.5s infinite' }} />}
                          {statusLabel[status]}
                        </span>
                      </td>
                    </tr>
                    {hasNotes && (
                      <tr style={{ background: rowStyle.background }}>
                        <td colSpan={COL_COUNT} style={{ padding: '0 14px 8px 14px', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 12px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: 6 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap', marginTop: 2, flexShrink: 0 }}>📋 Note</span>
                            <span style={{ width: 1, alignSelf: 'stretch', background: 'rgba(245,158,11,0.25)', flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{r.notes}</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [now, setNow] = useState(new Date());
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/summary?date=${today}`);
      if (res.ok) { setData(await res.json()); setLastUpdate(new Date()); setNow(new Date()); }
    } catch (e) { console.error(e); }
  }, [today]);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_INTERVAL);
    return () => clearInterval(t);
  }, [load]);

  const stats       = data?.stats || {};
  const logs        = data?.route_logs || [];
  const topRoutes   = data?.top_routes || null;
  const clockAvgs   = data?.clock_avgs || null;
  const firstStopAvgs = data?.first_stop_avgs || null;

  return (
    <div style={{ height: '100vh', width: '100vw', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--bg)', backgroundImage: 'radial-gradient(ellipse at 20% 0%, rgba(0,230,118,0.04) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(79,195,247,0.03) 0%, transparent 50%)' }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>

      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--green-dim)', border: '1px solid var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>♻</div>
          <div>
            <div style={{ fontFamily: 'var(--font-cond)', fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>WASTE MANAGEMENT KPI</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: '0.05em' }}>DAILY OPERATIONS DASHBOARD</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {lastUpdate && <div style={{ fontSize: 11, color: 'var(--text3)' }}>Updated {lastUpdate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>}
          <Clock />
        </div>
      </header>

      <div style={{ flex: 1, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, flexShrink: 0 }}>
          <StatTile label="Routes Complete" value={stats.routes_completed || 0} sub={`of ${stats.total_drivers || 0} logged`} color="var(--green)" accent="var(--green)" />
          <StatTile label="In Progress" value={logs.filter(r => r.punch_in && !r.punch_out).length} color="var(--blue)" accent="var(--blue)" />
          <StatTile label="Punched In" value={stats.punched_in || 0} sub={`${stats.punched_out || 0} punched out`} color="var(--amber)" accent="var(--amber)" />
          <LongestRouteTile topRoutes={topRoutes} />
          <StatTile label="Avg Day Length" value={stats.avg_day_length_hours ? stats.avg_day_length_hours + 'h' : '—'} sub="punch in → out" />
          <StatTile label="Avg Route Time" value={stats.avg_route_duration_hours ? stats.avg_route_duration_hours + 'h' : '—'} sub="punch in → complete" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flexShrink: 0 }}>
          <ClockAvgCard clockAvgs={clockAvgs} />
          <FirstStopCard firstStopAvgs={firstStopAvgs} />
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 3fr', gap: 10 }}>
          <NextUpCard logs={logs} now={now} />
          <DriverTable logs={logs} />
        </div>
      </div>
    </div>
  );
}
