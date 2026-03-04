const planningLogic = require('./planningLogic');
const activityLogic = require('./activityLogic');
const stravaService = require('../services/stravaService');
const { getWeekRange } = require('../utils/date');

// Get combined week view: planned workouts + actual activities
async function getWeekComparison(weekNumber) {
  // Get planned workouts for this week
  const plannedWorkouts = planningLogic.getWorkoutsByWeek(weekNumber);
  
  if (plannedWorkouts.length === 0) {
    return {
      week_nr: weekNumber,
      days: [],
      totals: {}
    };
  }

  // Get date range for this week (from first planned workout)
  const firstDate = new Date(plannedWorkouts[0].datum);
  const { start: weekStart, end: weekEnd } = getWeekRange(firstDate);
  
  // Fetch actual activities for this week (cache-first). If the token is missing or
  // expired and we have no cached items, this call may throw; in that case we simply
  // continue with an empty list so the evaluation can still render.
  let actualActivities = [];
  try {
    actualActivities = await stravaService.fetchActivities(weekStart, weekEnd);
  } catch (e) {
    console.error('Warning: unable to load activities for evaluation:', e.message);
    actualActivities = [];
  }
  
  // Fetch laps for each activity. Prefer cached activity details so we don't need a valid
  // Strava token when simply viewing previously cached data. If the full activity isn't
  // in the cache and a token is available we will fetch it from Strava and then cache it
  // for later.
  const activitiesWithLaps = await Promise.all(
    actualActivities.map(async (act) => {
      let laps = [];
      try {
        // try to grab full activity from the cache
        const cached = await stravaService.cacheService.getCachedActivityById(act.id);
        if (cached) {
          laps = activityLogic.makeLapsFromActivity(cached);
        } else {
          // cached copy does not exist; attempt Strava call if token present
          try {
            await stravaService.ensureToken();
            const fullActivity = await stravaService.getActivityById(act.id);
            // store detailed activity for future offline use
            await stravaService.cacheService.cacheActivity(fullActivity);
            laps = activityLogic.makeLapsFromActivity(fullActivity);
          } catch (e) {
            // either no token or fetch failed; ignore and continue without laps
            laps = [];
          }
        }
      } catch (e) {
        // cache lookup failed for some reason; fall back to no laps
        laps = [];
      }
      return {
        ...act,
        laps
      };
    })
  );
  
  // Group by date
  const dayMap = {};
  
  // Add planned workouts
  plannedWorkouts.forEach(wo => {
    if (!dayMap[wo.datum]) {
      dayMap[wo.datum] = {
        date: wo.datum,
        dag: wo.dag,
        planned: [],
        actual: [],
        summary: {}
      };
    }
    dayMap[wo.datum].planned.push(wo);
  });
  
  // Add actual activities with laps
  activitiesWithLaps.forEach(act => {
    const dt = new Date(act.start_date_local);
    const fmtLocal = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const actDate = fmtLocal(dt);
    
    if (!dayMap[actDate]) {
      dayMap[actDate] = {
        date: actDate,
        dag: getDayName(dt),
        planned: [],
        actual: [],
        summary: {}
      };
    }
    
    dayMap[actDate].actual.push({
      id: act.id,
      name: act.name,
      type: act.type,
      date: actDate,
      startTime: formatTime(dt),
      distance: (act.distance / 1000).toFixed(2),
      moving_time: formatDuration(act.moving_time),
      pace: formatPace(act.moving_time, act.distance),
      avg_heartrate: act.average_heartrate,      max_heartrate: act.max_heartrate, // new field      private: act.private,
      laps: act.laps || []
    });
  });
  
  // Calculate daily summaries
  Object.keys(dayMap).forEach(date => {
    const day = dayMap[date];
    const plannedKm = day.planned.reduce((sum, w) => {
      const km = parseFloat(w.geschat_totaal_km);
      return sum + (isNaN(km) ? 0 : km);
    }, 0);
    const actualKm = day.actual.reduce((sum, a) => {
      const km = parseFloat(a.distance);
      return sum + (isNaN(km) ? 0 : km);
    }, 0);
    
    day.summary = {
      planned_km: plannedKm.toFixed(1),
      actual_km: actualKm.toFixed(1),
      workouts_planned: day.planned.length,
      workouts_actual: day.actual.length,
      status: getStatus(plannedKm, actualKm)
    };
  });
  
  // Sort by date and return as array
  const days = Object.keys(dayMap)
    .sort()
    .map(date => dayMap[date]);
  
  // Calculate week totals
  const totals = {
    planned_km: days.reduce((sum, d) => sum + parseFloat(d.summary.planned_km), 0).toFixed(1),
    actual_km: days.reduce((sum, d) => sum + parseFloat(d.summary.actual_km), 0).toFixed(1),
    workouts_planned: days.reduce((sum, d) => sum + d.summary.workouts_planned, 0),
    workouts_actual: days.reduce((sum, d) => sum + d.summary.workouts_actual, 0)
  };
  
  return {
    week_nr: weekNumber,
    days,
    totals
  };
}

function getDayName(date) {
  const days = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
  return days[date.getDay()];
}

function formatTime(date) {
  return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

function formatPace(moving_time, distance) {
  if (!distance || distance === 0) return '-';
  const paceSecPerKm = moving_time / (distance / 1000);
  const minutes = Math.floor(paceSecPerKm / 60);
  const seconds = Math.round(paceSecPerKm % 60);
  return `${minutes}:${String(seconds).padStart(2,'0')}`;
}

function getStatus(plannedKm, actualKm) {
  if (actualKm === 0) return 'planned'; // No activities yet
  if (Math.abs(actualKm - plannedKm) < 0.5) return 'matched'; // Close match
  if (actualKm > plannedKm * 1.1) return 'exceeded'; // More than planned
  if (actualKm < plannedKm * 0.9) return 'under'; // Less than planned
  return 'partial'; // Partially done
}

module.exports = {
  getWeekComparison,
  getDayName,
  formatTime,
  formatDuration,
  formatPace,
  getStatus
};
