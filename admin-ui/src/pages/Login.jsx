import React, { useState } from 'react';
import { api } from '../api';

export default function Login({ onLogin }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login(form);
      localStorage.setItem('username', res.username);
      onLogin(res.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
      backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(74,222,128,0.05) 0%, transparent 60%)'
    }}>
      {/* Login box */}
      <div style={{ width: '100%', maxWidth: 380, padding: '0 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, margin: '0 auto 16px',
            background: 'var(--accent-dim)', border: '1px solid var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28
          }}>♻</div>
          <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>WasteKPI</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13 }}>Sign in to the admin portal</p>
        </div>

        <div className="card" style={{ padding: 28 }}>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                autoFocus
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="admin"
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div style={{ color: 'var(--danger)', fontSize: 13, padding: '8px 12px', background: 'var(--danger-dim)', borderRadius: 'var(--radius)' }}>
                {error}
              </div>
            )}
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>

      {/* Company logo — centered below the card, see-through */}
      <div style={{
        marginTop: 48,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
      }}>
        <img
          src="/admin/logo.png"
          alt="DHI Technical Services LLC"
          style={{
            width: 320,
            maxWidth: '80vw',
            opacity: 0.55,
            mixBlendMode: 'lighten',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
}
