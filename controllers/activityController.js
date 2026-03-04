const stravaService = require('../services/stravaService');
const { getWeekRange } = require('../utils/date');
const activityLogic = require('../logic/activityLogic');


// business logic (formatting, iso-week, populate) moved to logic/activityLogic

const fs = require('fs');
const path = require('path');

exports.listWeeks = async (req, res) => {
  try {
    const now = new Date();
    const { start: thisWeekStart, end: thisWeekEnd } = getWeekRange(now);

    const previous = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const { start: lastWeekStart, end: lastWeekEnd } = getWeekRange(previous);

    // debug: log week ranges (format as local date to avoid UTC shift)
    const fmtLocal = activityLogic.fmtLocal;
    const currentWeekNumber = activityLogic.isoWeek(thisWeekStart);
    const lastWeekNumber = activityLogic.isoWeek(lastWeekStart);
    console.log('=== Week Boundaries ===');
    console.log(`Current: ${fmtLocal(thisWeekStart)} to ${fmtLocal(thisWeekEnd)} (W${currentWeekNumber})`);
    console.log(`Last:    ${fmtLocal(lastWeekStart)} to ${fmtLocal(lastWeekEnd)} (W${lastWeekNumber})`);

    const [currentWeekActs, lastWeekActs] = await Promise.all([
      stravaService.fetchActivities(thisWeekStart, thisWeekEnd),
      stravaService.fetchActivities(lastWeekStart, lastWeekEnd)
    ]);

    const formattedCurrent = currentWeekActs.map(activityLogic.formatActivity);
    const formattedLast = lastWeekActs.map(activityLogic.formatActivity);

    // sort by date+time ascending
    const cmp = (a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.startTime < b.startTime ? -1 : 1;
    };
    formattedCurrent.sort(cmp);
    formattedLast.sort(cmp);

    console.log(`DEBUG: fetched ${currentWeekActs.length} current-week, ${lastWeekActs.length} last-week`);

    // read existing markdown file if present
    let markdown = '';
    const mdPath = path.join(__dirname, '..', 'data', 'activities.md');
    if (fs.existsSync(mdPath)) {
      markdown = fs.readFileSync(mdPath, 'utf8');
    }

    // get cache stats
    const cacheStats = await stravaService.cacheService.getCacheStats();

    const isAuth = !!stravaService.tokenObj.access_token;

    // render view
    res.render('activities', {
      currentWeek: formattedCurrent,
      lastWeek: formattedLast,
      isAuthenticated: isAuth,
      returnTo: req.originalUrl,
      markdown,
      cacheStats,
      weekInfo: {
        currentStart: fmtLocal(thisWeekStart),
        currentEnd: fmtLocal(thisWeekEnd),
        lastStart: fmtLocal(lastWeekStart),
        lastEnd: fmtLocal(lastWeekEnd),
        currentWeekNumber,
        lastWeekNumber
      },
      activePage: 'activities'
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
};

// refresh cache from Strava
exports.refreshCache = async (req, res) => {
  try {
    console.log('Starting cache refresh from Strava...');
    await stravaService.ensureToken();
    const now = new Date();
    const { start: thisWeekStart, end: thisWeekEnd } = getWeekRange(now);
    const previous = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const { start: lastWeekStart, end: lastWeekEnd } = getWeekRange(previous);

    console.log('Refreshing cache from Strava...');
    const [currentWeekActs, lastWeekActs] = await Promise.all([
      stravaService.fetchActivities(thisWeekStart, thisWeekEnd, true), // force refresh
      stravaService.fetchActivities(lastWeekStart, lastWeekEnd, true)   // force refresh
    ]);

    const total = currentWeekActs.length + lastWeekActs.length;
    console.log(`Refreshed cache with ${total} activities`);
    res.redirect('/activities?refresh=1');
  } catch (err) {
    console.error('Cache refresh failed:', err.message);
    res.status(500).json({ error: err.message });
  }
};
// export/populate features removed

// business logic moved to logic/activityLogic.js

// populateTemplate removed

// return lap/split details for an activity
exports.getActivityLaps = async (req, res) => {
  try {
    const id = req.params.id;
    await stravaService.ensureToken();
    const act = await stravaService.getActivityById(id);
    const laps = activityLogic.makeLapsFromActivity(act);
    return res.json({ laps });
  } catch (e) {
    console.error('getActivityLaps failed:', e.message);
    return res.status(500).json({ error: e.message });
  }
};