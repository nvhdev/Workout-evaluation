const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/', authController.home);
router.get('/authorize', authController.authorize);
router.get('/callback', authController.callback);

module.exports = router;
