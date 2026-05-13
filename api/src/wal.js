/**
 * wal.js — Write-Ahead Log for critical DB writes
 *
 * Flow:
 *   1. walAppend(operation, payload)  → writes a 'pending' entry, returns entryId
 *   2. DB write executes normally
 *   3. walCommit(entryId)             → marks entry 'committed'
 *   4. On startup: walRecover(pool)   → replays any 'pending' entries older than
 *                                       PENDING_AGE_MS and marks them 'replayed'
 *
 * The log file is one JSON object per line (NDJSON).
 * Compaction runs at startup and removes committed/replayed entries older than 7 days.
 */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const WAL_DIR  = process.env.WAL_DIR || '/app/data';
const WAL_FILE = path.join(WAL_DIR, 'wal.log');

const PENDING_AGE_MS = 60 * 1000;
const COMPACT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function ensureDir() {
  if (!fs.existsSync(WAL_DIR)) fs.mkdirSync(WAL_DIR, { recursive: true });
}

function newId() {
  return crypto.randomBytes(12).toString('hex');
}

function readLines() {
  if (!fs.existsSync(WAL_FILE)) return [];
  return fs.readFileSync(WAL_FILE, 'utf8')
    .split('\n')
    .filter(l => l.trim())
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

function rewriteLines(entries) {
  ensureDir();
  fs.writeFileSync(WAL_FILE, entries.map(e => JSON.stringify(e)).join('\n') + '\n', 'utf8');
}

function walAppend(operation, payload) {
  ensureDir();
  const entry = { id: newId(), ts: Date.now(), operation, payload, status: 'pending' };
  fs.appendFileSync(WAL_FILE, JSON.stringify(entry) + '\n', 'utf8');
  return entry.id;
}

function walCommit(id) {
  if (!fs.existsSync(WAL_FILE)) return;
  const entries = readLines().map(e =>
    e.id === id ? { ...e, status: 'committed', committed_at: Date.now() } : e
  );
  rewriteLines(entries);
}

async function walRecover(pool) {
  if (!fs.existsSync(WAL_FILE)) {
    console.log('[wal] No WAL file — nothing to recover.');
    return;
  }
  const entries = readLines();
  const now     = Date.now();
  const pending = entries.filter(e => e.status === 'pending' && (now - e.ts) > PENDING_AGE_MS);

  if (pending.length === 0) {
    console.log('[wal] Recovery: nothing to replay.');
    walCompact();
    return;
  }

  console.log(`[wal] Recovery: replaying ${pending.length} lost write(s).`);
  let replayed = 0, failed = 0;

  for (const entry of pending) {
    try {
      await replayEntry(pool, entry);
      const updated = readLines().map(e =>
        e.id === entry.id ? { ...e, status: 'replayed', replayed_at: Date.now() } : e
      );
      rewriteLines(updated);
      replayed++;
      console.log(`[wal] Replayed: ${entry.operation} id=${entry.id}`);
    } catch (err) {
      failed++;
      console.error(`[wal] Replay FAILED ${entry.operation} id=${entry.id}: ${err.message}`);
    }
  }

  console.log(`[wal] Recovery done: ${replayed} replayed, ${failed} failed.`);
  walCompact();
}

function walCompact() {
  if (!fs.existsSync(WAL_FILE)) return;
  const entries = readLines();
  const cutoff  = Date.now() - COMPACT_AGE_MS;
  const kept    = entries.filter(e => {
    if (e.status === 'pending') return true;
    const doneAt = e.committed_at || e.replayed_at || e.ts;
    return doneAt > cutoff;
  });
  if (kept.length < entries.length) {
    console.log(`[wal] Compacted: pruned ${entries.length - kept.length} old entries.`);
    rewriteLines(kept);
  }
}

async function replayEntry(pool, entry) {
  switch (entry.operation) {
    case 'route_log.upsert': return replayRouteLogUpsert(pool, entry.payload);
    case 'pack_out.upsert':  return replayPackOutUpsert(pool, entry.payload);
    default:
      console.warn(`[wal] Unknown operation '${entry.operation}' — skipping.`);
  }
}

async function replayRouteLogUpsert(pool, p) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO route_logs
         (employee_id, log_date, route_number, punch_in, first_stop_time,
          route_complete_time, to_yard_time, punch_out, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (employee_id, log_date) DO UPDATE SET
         route_number        = EXCLUDED.route_number,
         punch_in            = EXCLUDED.punch_in,
         first_stop_time     = EXCLUDED.first_stop_time,
         route_complete_time = EXCLUDED.route_complete_time,
         to_yard_time        = EXCLUDED.to_yard_time,
         punch_out           = EXCLUDED.punch_out,
         notes               = EXCLUDED.notes,
         updated_at          = NOW()
       RETURNING id`,
      [
        p.employee_id, p.log_date, p.route_number || null,
        p.punch_in || null, p.first_stop_time || null,
        p.route_complete_time || null, p.to_yard_time || null,
        p.punch_out || null, p.notes || null,
      ]
    );

    const routeLogId = result.rows[0].id;

    if (Array.isArray(p.pack_outs) && p.pack_outs.length > 0) {
      await client.query('DELETE FROM pack_out_logs WHERE route_log_id = $1', [routeLogId]);
      for (let i = 0; i < p.pack_outs.length; i++) {
        const po = p.pack_outs[i];
        await client.query(
          `INSERT INTO pack_out_logs (route_log_id, seq, pack_out_time, back_on_route_time, location)
           VALUES ($1,$2,$3,$4,$5)`,
          [routeLogId, i + 1, po.pack_out_time || null, po.back_on_route_time || null, po.location || null]
        );
      }
    }

    if (Array.isArray(p.additional_routes) && p.additional_routes.length > 0) {
      await client.query('DELETE FROM additional_route_logs WHERE route_log_id = $1', [routeLogId]);
      for (let i = 0; i < p.additional_routes.length; i++) {
        const ar = p.additional_routes[i];
        if (!ar.route_number) continue;
        await client.query(
          `INSERT INTO additional_route_logs
             (route_log_id, seq, route_number, first_stop_time, route_complete_time, notes)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [routeLogId, i + 1, ar.route_number, ar.first_stop_time || null, ar.route_complete_time || null, ar.notes || null]
        );
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function replayPackOutUpsert(pool, p) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM pack_out_logs WHERE route_log_id = $1', [p.route_log_id]);
    if (Array.isArray(p.pack_outs)) {
      for (let i = 0; i < p.pack_outs.length; i++) {
        const po = p.pack_outs[i];
        await client.query(
          `INSERT INTO pack_out_logs (route_log_id, seq, pack_out_time, back_on_route_time, location)
           VALUES ($1,$2,$3,$4,$5)`,
          [p.route_log_id, i + 1, po.pack_out_time || null, po.back_on_route_time || null, po.location || null]
        );
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { walAppend, walCommit, walRecover, walCompact };
