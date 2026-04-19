import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/',          label: 'Dashboard',  icon: '⬡', exact: true },
  { to: '/route-logs', label: 'Route Logs', icon: '🚛' },
  { to: '/routes',     label: 'Routes',     icon: '🗺' },
  { to: '/employees',  label: 'Employees',  icon: '👷' },
  { to: '/reports',    label: 'Reports',    icon: '📊' },
];

export default function Layout({ children, onLogout }) {
  const username = localStorage.getItem('username') || 'Admin';

  const linkStyle = (isActive) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 12px', borderRadius: 'var(--radius)',
    fontSize: 13, fontWeight: isActive ? 500 : 400,
    color: isActive ? 'var(--accent)' : 'var(--text2)',
    background: isActive ? 'var(--accent-dim)' : 'transparent',
    marginBottom: 2, transition: 'all 0.15s', textDecoration: 'none',
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{
        width: 220, background: 'var(--bg2)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100
      }}>
        <div style={{ padding: '24px 20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--accent-dim)', border: '1px solid var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
            }}>♻</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>WasteKPI</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Admin Portal</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '8px 12px' }}>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              style={({ isActive }) => linkStyle(isActive)}
            >
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

          <div style={{ height: 1, background: 'var(--border)', margin: '12px 4px' }} />

          <NavLink to="/admin" style={({ isActive }) => linkStyle(isActive)}>
            <span style={{ fontSize: 15 }}>⚙</span>
            Admin Settings
          </NavLink>
        </nav>

        <div style={{ padding: '16px 12px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--bg3)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: 'var(--text2)', flexShrink: 0
            }}>👤</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {username}
            </div>
          </div>
          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }} onClick={onLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <main style={{ marginLeft: 220, flex: 1, padding: '32px', minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  );
}
