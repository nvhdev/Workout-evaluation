const planningLogic = require('../logic/planningLogic');
const stravaService = require('../services/stravaService');

exports.listWeeks = async (req, res) => {
  try {
    const allWeeks = planningLogic.getAllWeeks();
    const isAuth = !!stravaService.tokenObj.access_token;
    res.render('planning', {
      weeks: allWeeks,
      isAuthenticated: isAuth,
      returnTo: req.originalUrl,
      activePage: 'planning'
    });
  } catch (err) {
    console.error('Planning listWeeks error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.getWeekDetail = async (req, res) => {
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
    
    const workouts = planningLogic.getWorkoutsByWeek(weekNumber);
    
    const isAuth = !!stravaService.tokenObj.access_token;
    res.render('planning-detail', {
      week: selectedWeek,
      workouts,
      isAuthenticated: isAuth,
      returnTo: req.originalUrl,
      activePage: 'planning'
    });
  } catch (err) {
    console.error('Planning getWeekDetail error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.getWeekSummary = async (req, res) => {
  try {
    const weekNumber = parseInt(req.params.weekNumber);
    
    if (isNaN(weekNumber)) {
      return res.status(400).json({ error: 'Invalid week number' });
    }
    
    const workouts = planningLogic.getWorkoutsByWeek(weekNumber);
    
    if (workouts.length === 0) {
      return res.status(404).json({ error: 'Week not found' });
    }
    
    // Calculate totals for the week
    const totals = {
      workouts_count: workouts.length,
      total_km: workouts.reduce((sum, w) => {
        const km = parseFloat(w.geschat_totaal_km);
        return sum + (isNaN(km) ? 0 : km);
      }, 0),
      is_recovery: workouts[0].herstelweek,
      workouts: workouts
    };
    
    res.json(totals);
  } catch (err) {
    console.error('Planning getWeekSummary error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
