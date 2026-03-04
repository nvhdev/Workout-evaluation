const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// initialize database
const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'cache.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Error opening database:', err);
});

// set to use serialized mode for thread safety
db.configure('busyTimeout', 5000);

// initialize schema on startup
function initSchema() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(
        `CREATE TABLE IF NOT EXISTS activities (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT,
          distance REAL,
          moving_time INTEGER,
          start_date_local TEXT,
          private INTEGER,
          data TEXT NOT NULL,
          cached_at INTEGER NOT NULL
        )`,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  });
}

// cache an activity or update if exists
function cacheActivity(activity) {
  return new Promise((resolve, reject) => {
    const cachedAt = Math.floor(Date.now() / 1000);
    db.run(
      `INSERT OR REPLACE INTO activities (id, name, type, distance, moving_time, start_date_local, private, data, cached_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        activity.id,
        activity.name,
        activity.type,
        activity.distance,
        activity.moving_time,
        activity.start_date_local,
        activity.private ? 1 : 0,
        JSON.stringify(activity),
        cachedAt
      ],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

// batch cache activities
async function cacheActivities(activities) {
  for (const act of activities) {
    await cacheActivity(act);
  }
}

// get cached activities for a date range
function getFromCache(startDate, endDate) {
  return new Promise((resolve, reject) => {
    // use local YYYY-MM-DD formatting to match local-week boundaries
    const fmtLocal = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const start = fmtLocal(startDate);
    const end = fmtLocal(endDate);
    // compare only the date prefix of start_date_local to avoid timezone/ISO issues
    db.all(
      `SELECT data FROM activities 
       WHERE substr(start_date_local,1,10) >= ? AND substr(start_date_local,1,10) <= ?
       ORDER BY start_date_local ASC`,
      [start, end],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const activities = (rows || []).map(row => JSON.parse(row.data));
          resolve(activities);
        }
      }
    );
  });
}




// get single cached activity by ID
function getCachedActivityById(id) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT data FROM activities WHERE id = ?`,
      [id],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? JSON.parse(row.data) : null);
        }
      }
    );
  });
}

// clear all cache
function clearCache() {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM activities', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// get cache statistics
function getCacheStats() {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT COUNT(*) as count, MAX(cached_at) as latest FROM activities`,
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            count: row.count || 0,
            latest: row.latest || null
          });
        }
      }
    );
  });
}

module.exports = {
  initSchema,
  cacheActivity,
  cacheActivities,
  getFromCache,
  getCachedActivityById,
  clearCache,
  getCacheStats
};
