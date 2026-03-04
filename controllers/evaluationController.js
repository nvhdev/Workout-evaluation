const evaluationLogic = require('../logic/evaluationLogic');
const planningLogic = require('../logic/planningLogic');
const stravaService = require('../services/stravaService');
const { getWeekRange } = require('../utils/date');

exports.listWeeks = async (req, res) => {
  try {
    const allWeeks = planningLogic.getAllWeeks();
    const isAuth = !!stravaService.tokenObj.access_token;
    res.render('evaluation', {
      weeks: allWeeks,
      isAuthenticated: isAuth,
      returnTo: req.originalUrl,
      activePage: 'evaluation'
    });
  } catch (err) {
    console.error('Evaluation listWeeks error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.getWeekComparison = async (req, res) => {
  try {
    const weekNumber = parseInt(req.params.weekNumber);
    
    if (isNaN(weekNumber)) {
      return res.status(400).json({ error: 'Invalid week number' });
    }
    
    const allWeeks = planningLogic.getAllWeeks();
    const selectedWeek = allWeeks.find(w => w.week_nr === weekNumber);
    
    if (!selectedWeek) {
      return res.status(404).json({ error: 'Week not found' });
    }
    
    const comparison = await evaluationLogic.getWeekComparison(weekNumber);
    
    const isAuth = !!stravaService.tokenObj.access_token;
    res.render('evaluation-detail', {
      week: selectedWeek,
      comparison,
      isAuthenticated: isAuth,
      returnTo: req.originalUrl,
      activePage: 'evaluation'
    });
  } catch (err) {
    console.error('Evaluation getWeekComparison error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// refresh cached activities for a specific week and redirect back
exports.refreshCache = async (req, res) => {
  try {
    const weekNumber = parseInt(req.params.weekNumber);
    if (isNaN(weekNumber)) {
      return res.status(400).json({ error: 'Invalid week number' });
    }

    const allWeeks = planningLogic.getAllWeeks();
    const selectedWeek = allWeeks.find(w => w.week_nr === weekNumber);
    if (!selectedWeek) {
      return res.status(404).json({ error: 'Week not found' });
    }

    // ensure we have a valid token before refreshing
    await stravaService.ensureToken();
    const weekStart = new Date(selectedWeek.start_date);
    const { start, end } = getWeekRange(weekStart);

    console.log(`Refreshing cache for evaluation week ${weekNumber}`);
    await stravaService.fetchActivities(start, end, true);

    res.redirect(`/evaluation/${weekNumber}?refresh=1`);
  } catch (err) {
    console.error('Evaluation refreshCache error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
