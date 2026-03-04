const stravaService = require('../services/stravaService');

const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:' + (process.env.PORT || 3000) + '/callback';

exports.home = (req, res) => {
  const isAuth = !!stravaService.tokenObj.access_token;
  res.render('index', { activePage: 'home', isAuthenticated: isAuth, returnTo: req.originalUrl });
};

exports.authorize = (req, res) => {
  // allow client to specify a return path after auth via `returnTo`
  const returnTo = req.query.returnTo || '/activities';
  const params = new URLSearchParams({
    client_id: process.env.CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    approval_prompt: 'auto',
    // request read_all so private activities are returned
    scope: 'activity:read_all',
    state: encodeURIComponent(returnTo)
  });
  res.redirect('https://www.strava.com/oauth/authorize?' + params.toString());
};

exports.callback = async (req, res) => {
  const code = req.query.code;
  const state = req.query.state ? decodeURIComponent(req.query.state) : '/activities';
  if (!code) {
    return res.status(400).send('Missing code');
  }
  try {
    await stravaService.exchangeCode(code);
    // redirect back to original page
    res.redirect(state);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send('Error fetching token');
  }
};
