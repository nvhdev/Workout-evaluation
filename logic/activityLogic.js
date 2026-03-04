const fs = require('fs');
const path = require('path');
const stravaService = require('../services/stravaService');

function fmtLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatPace(moving_time, distance) {
  if (!distance || distance === 0) return '-';
  const paceSecPerKm = moving_time / (distance / 1000);
  const minutes = Math.floor(paceSecPerKm / 60);
  const seconds = Math.round(paceSecPerKm % 60);
  return `${minutes}:${String(seconds).padStart(2,'0')}`;
}

function formatActivity(act) {
  const dt = new Date(act.start_date_local);
  const date = fmtLocal(dt);
  const startTime = `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
  return {
    id: act.id,
    name: act.name,
    type: act.type,
    date,
    startTime,
    pace: formatPace(act.moving_time, act.distance),
    private: act.private
  };
}

function isoWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay()||7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1)/7);
  return weekNo;
}

function makeLapsFromActivity(act) {
  const makePace = (timeSec, distanceMeters) => {
    if (!timeSec || !distanceMeters) return '-';
    const secPerKm = timeSec / (distanceMeters / 1000);
    const m = Math.floor(secPerKm / 60);
    const s = String(Math.round(secPerKm % 60)).padStart(2, '0');
    return `${m}:${s}`;
  };

  let laps = [];
  if (Array.isArray(act.laps) && act.laps.length) {
    laps = act.laps.map(l => ({
      distance: l.distance ? (l.distance / 1000).toFixed(2) : '0.00',
      pace: makePace(l.moving_time || l.elapsed_time, l.distance),
      avg_hr: l.average_heartrate || null,
      max_hr: l.max_heartrate || null
    }));
  } else if (Array.isArray(act.splits_metric) && act.splits_metric.length) {
    laps = act.splits_metric.map(s => ({
      distance: s.distance ? (s.distance / 1000).toFixed(2) : '0.00',
      pace: makePace(s.moving_time || s.elapsed_time, s.distance),
      avg_hr: s.average_heartrate || null,
      max_hr: s.max_heartrate || null
    }));
  }
  return laps;
}

module.exports = {
  fmtLocal,
  formatPace,
  formatActivity,
  isoWeek,
  makeLapsFromActivity
};
