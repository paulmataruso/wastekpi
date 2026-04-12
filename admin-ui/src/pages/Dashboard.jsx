import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../api';
import DateNav from '../components/DateNav';

function fmt(t) {
  if (!t) return '—';
  const parts = t.slice(0, 5).split(':');
  const hr = parseInt(parts[0]);
  return `${hr % 12 || 12}:${parts[1]} ${hr < 12 ? 'AM' : 'PM'}`;
}

function dayLen(punchIn, punchOut) {
  if (!punchIn || !punchOut) return null;
  const [ah, am] = punchIn.slice(0, 5).split(':').map(Number);
  const [bh, bm] = punchOut.slice(0, 5).split(':').map(Number);
  const mins = (bh * 60 + bm) - (ah * 60 + am);
  if (mins <= 0) return null;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// Safely parse a date from the DB — handles both "2026-04-07" and "2026-04-07T00:00:00.000Z"
function parseDate(val) {
  if (!val) return null;
  const dateStr = String(val).slice(0, 10); // always "YYYY-MM-DD"
  return new Date(dateStr + 'T00:00:00');
}

export default function Dashboard() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.dashboard.summary(date)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [date]);

  const stats = data?.stats || {};
  const logs = data?.route_logs || [];

  const weekData = (data?.week_routes || []).map(r => {
    const d = parseDate(r.log_date);
    return {
      date: d ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }) : '',
      completed: parseInt(r.routes_completed || 0),
    };
  }).filter(r => r.date); // drop any that still failed

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 2 }}>Dashboard</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13 }}>Daily KPI overview</p>
        </div>
        <DateNav date={date} onChange={setDate} />
      </div>

      {loading ? (
        <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 48 }}>Loading…</div>
      ) : (
        <>
          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-label">Routes Complete</div>
              <div className="stat-value" style={{ color: 'var(--accent)' }}>{stats.routes_completed || 0}</div>
              <div className="stat-sub">of {stats.total_drivers || 0} logged</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Punched In</div>
              <div className="stat-value" style={{ color: 'var(--info)' }}>{stats.punched_in || 0}</div>
              <div className="stat-sub">{stats.punched_out || 0} punched out</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg Day Length</div>
              <div className="stat-value">{stats.avg_day_length_hours ? stats.avg_day_length_hours + 'h' : '—'}</div>
              <div className="stat-sub">punch in → punch out</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg Route Duration</div>
              <div className="stat-value">{stats.avg_route_duration_hours ? stats.avg_route_duration_hours + 'h' : '—'}</div>
              <div className="stat-sub">punch in → route complete</div>
            </div>
          </div>

          {/* Daily log table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 14, fontWeight: 500 }}>
                Driver KPIs — {parseDate(date)?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h3>
              <span className="tag tag-gray">{logs.length} entries</span>
            </div>
            {logs.length === 0 ? (
              <div className="empty-state"><div className="icon">🚛</div><p>No entries for this date</p></div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Driver</th><th>Route #</th><th>Punch In</th><th>1st Stop</th>
                      <th>Route Complete</th><th>Punch Out</th><th>Day Length</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(r => {
                      const dl = dayLen(r.punch_in, r.punch_out);
                      return (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 500 }}>{r.employee_name}</td>
                          <td>
                            {r.route_number
                              ? <span style={{ fontFamily: 'var(--mono)', fontSize: 12, background: 'var(--bg3)', padding: '2px 8px', borderRadius: 4 }}>{r.route_number}</span>
                              : <span style={{ color: 'var(--text3)' }}>—</span>}
                          </td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmt(r.punch_in)}</td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmt(r.first_stop_time)}</td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmt(r.route_complete_time)}</td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmt(r.punch_out)}</td>
                          <td style={{ fontWeight: 500, color: dl ? 'var(--accent)' : 'var(--text3)' }}>
                            {dl || '—'}
                          </td>
                          <td>
                            {r.punch_out ? <span className="tag tag-green">Complete</span>
                              : r.punch_in ? <span className="tag tag-blue">In Progress</span>
                              : <span className="tag tag-gray">Pending</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 7-day chart */}
          {weekData.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 20 }}>Routes Completed — Last 7 Days</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={weekData} barSize={28}>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#555f78' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#555f78' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: '#171b26', border: '1px solid #2a3044', borderRadius: 8, fontSize: 12 }} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="completed" radius={[4, 4, 0, 0]}>
                    {weekData.map((_, i) => (
                      <Cell key={i} fill={i === weekData.length - 1 ? '#4ade80' : '#2a3a30'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
