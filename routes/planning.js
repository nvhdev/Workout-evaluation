const express = require('express');
const router = express.Router();
const planningController = require('../controllers/planningController');

router.get('/', planningController.listWeeks);
router.get('/:weekNumber', planningController.getWeekDetail);
router.get('/:weekNumber/summary', planningController.getWeekSummary);

module.exports = router;
