const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');

router.get('/', activityController.listWeeks);
router.get('/refresh-cache', activityController.refreshCache);
router.get('/:id/laps', activityController.getActivityLaps);
// (export/populate removed)

module.exports = router;
