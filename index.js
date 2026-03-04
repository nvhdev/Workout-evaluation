require('dotenv').config();
const express = require('express');
const path = require('path');
const cacheService = require('./services/cacheService');

const authRoutes = require('./routes/auth');
const activityRoutes = require('./routes/activities');
const planningRoutes = require('./routes/planning');
const evaluationRoutes = require('./routes/evaluation');

const app = express();
const port = process.env.PORT || 3000;

// initialize cache schema
cacheService.initSchema().then(() => {
  console.log('Cache database initialized');
}).catch(err => {
  console.error('Failed to initialize cache:', err);
  process.exit(1);
});

// parse form bodies for export
app.use(express.urlencoded({ extended: true }));

// serve static assets (css, js, images)
app.use(express.static(path.join(__dirname, 'public')));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use('/', authRoutes);
app.use('/activities', activityRoutes);
app.use('/planning', planningRoutes);
app.use('/evaluation', evaluationRoutes);

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
  console.log('Hit /authorize to begin Strava OAuth flow');
});
