import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';

/**
 * LocationSelect
 *
 * A drop-down for pack-out dump locations that includes an
 * "+ Add New Location" option at the bottom.  When selected it
 * expands an inline card where the user types a new name and saves.
 * The new location is persisted to the DB and immediately selected.
 *
 * Props:
 *   value      – current location string (or '')
 *   onChange   – (newValue: string) => void
 *   style      – optional extra style for the <select>
 *   inputStyle – optional extra style used for the inline input variant
 */
export default function LocationSelect({ value, onChange, style = {}, inputStyle = {} }) {
  const [locations, setLocations]   = useState([]);
  const [adding, setAdding]         = useState(false);
  const [newName, setNewName]       = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const inputRef                    = useRef(null);

  // Load locations on mount — also exposed as a reload function
  async function loadLocations() {
    try {
      const data = await api.packOutLocations.list();
      setLocations(data);
    } catch { /* silent — use whatever is already in state */ }
  }

  useEffect(() => { loadLocations(); }, []);

  // Focus the text input when the add card opens
  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus();
  }, [adding]);

  function handleSelectChange(e) {
    if (e.target.value === '__add_new__') {
      setAdding(true);
      setNewName('');
      setError('');
    } else {
      onChange(e.target.value);
    }
  }

  async function handleSave() {
    const trimmed = newName.trim();
    if (!trimmed) { setError('Please enter a location name.'); return; }
    setSaving(true);
    setError('');
    try {
      const created = await api.packOutLocations.create(trimmed);
      await loadLocations();       // refresh list
      onChange(created.name);      // auto-select the new location
      setAdding(false);
      setNewName('');
    } catch (e) {
      setError(e.message || 'Failed to save location.');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setAdding(false);
    setNewName('');
    setError('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') handleCancel();
  }

  const selectStyle = {
    width: '100%',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text)',
    fontFamily: 'inherit',
    fontSize: 13,
    padding: '5px 8px',
    outline: 'none',
    cursor: 'pointer',
    ...style,
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Main select */}
      <select
        value={adding ? '__add_new__' : (value || '')}
        onChange={handleSelectChange}
        style={selectStyle}
      >
        <option value="">— Select location —</option>
        {locations.map(loc => (
          <option key={loc.id} value={loc.name}>{loc.name}</option>
        ))}
        <option disabled style={{ color: 'var(--border)' }}>──────────</option>
        <option value="__add_new__">＋ Add New Location</option>
      </select>

      {/* Inline add card — slides in below the select */}
      {adding && (
        <div style={{
          marginTop: 8,
          padding: '12px 14px',
          background: 'var(--bg2)',
          border: '1px solid var(--accent)',
          borderRadius: 6,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            New Dump Location
          </div>
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={e => { setNewName(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Springfield Transfer"
            style={{
              background: 'var(--bg)',
              border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
              borderRadius: 4,
              color: 'var(--text)',
              fontFamily: 'inherit',
              fontSize: 13,
              padding: '5px 8px',
              outline: 'none',
              width: '100%',
              ...inputStyle,
            }}
          />
          {error && (
            <div style={{ fontSize: 11, color: 'var(--danger)' }}>{error}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                flex: 1,
                padding: '5px 0',
                background: 'var(--accent)',
                color: '#000',
                border: 'none',
                borderRadius: 4,
                fontWeight: 600,
                fontSize: 12,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              style={{
                flex: 1,
                padding: '5px 0',
                background: 'transparent',
                color: 'var(--text2)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
