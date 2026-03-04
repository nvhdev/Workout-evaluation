const express = require('express');
const router = express.Router();
const evaluationController = require('../controllers/evaluationController');

router.get('/', evaluationController.listWeeks);
router.get('/:weekNumber', evaluationController.getWeekComparison);
router.get('/:weekNumber/refresh-cache', evaluationController.refreshCache);

module.exports = router;
