const axios = require('axios');
const cacheService = require('./cacheService');

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('CLIENT_ID and CLIENT_SECRET must be set');
  process.exit(1);
}

// token storage; initially seeded from environment if available
let tokenObj = {
  access_token: process.env.STRAVA_ACCESS_TOKEN || null,
  refresh_token: process.env.STRAVA_REFRESH_TOKEN || null,
  expires_at: process.env.STRAVA_EXPIRES_AT ? Number(process.env.STRAVA_EXPIRES_AT) : 0
};

async function exchangeCode(code) {
  const r = await axios.post('https://www.strava.com/oauth/token', null, {
    params: {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: 'authorization_code'
    }
  });
  tokenObj = {
    access_token: r.data.access_token,
    refresh_token: r.data.refresh_token,
    expires_at: r.data.expires_at
  };
  return tokenObj;
}

async function refreshAccessToken() {
  console.log('Refreshing access token');
  const r = await axios.post('https://www.strava.com/oauth/token', null, {
    params: {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: tokenObj.refresh_token
    }
  });
  tokenObj = {
    access_token: r.data.access_token,
    refresh_token: r.data.refresh_token,
    expires_at: r.data.expires_at
  };
  return tokenObj;
}

async function ensureToken() {
  const now = Math.floor(Date.now() / 1000);
  if (!tokenObj.access_token) {
    throw new Error('No access token, authorize first');
  }
  if (tokenObj.expires_at && tokenObj.expires_at <= now + 60) {
    await refreshAccessToken();
  }
}


// fetch activities between two Date objects (inclusive) using local
// boundaries. Check cache first; if no cache hits, fetch from Strava
// and cache for future use. Strava expects UTC timestamps for `after`/`before`,
// which can drop items around midnight if the athlete is in a non‑UTC zone,
// so we request a one‑day margin on each side and then reject any
// activities that fall outside the exact local range. We also support
// automatic pagination in case there are more than `per_page` results.
async function fetchActivities(start, end, forceRefresh = false) {
  console.log(`Fetching activities from ${start.toISOString()} to ${end.toISOString()}, forceRefresh=${forceRefresh}`);
  // check cache first unless forcing refresh
  if (!forceRefresh) {
    try {
      const cached = await cacheService.getFromCache(start, end);
      if (cached.length > 0) {
        console.log(`Cache hit: found ${cached.length} activities`);
        return cached;
      }
    } catch (e) {
      console.error('Cache lookup failed:', e.message);
      // continue to fetch from Strava
    }
    return [];
  } else {
    console.log('Force refresh: bypassing cache');
  }

  await ensureToken();
  const after = Math.floor((start.getTime() - 24 * 60 * 60 * 1000) / 1000);
  const before = Math.floor((end.getTime() + 24 * 60 * 60 * 1000) / 1000);
  const per_page = 200;
  let page = 1;
  let all = [];

  while (true) {
    console.log(`Fetching activities from Strava: page ${page}, after ${after}, before ${before}`);
    const r = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      params: { after, before, per_page, page },
      headers: { Authorization: `Bearer ${tokenObj.access_token}` }
    });
    const data = r.data;
    if (!Array.isArray(data) || data.length === 0) break;
    all = all.concat(data);
    if (data.length < per_page) break;
    page += 1;
    console.log(`DEBUG: fetched page ${page} with ${data.length} activities, total so far ${all.length}`);
  }

  // filter by local start_date_local boundaries
  const filtered = all.filter(act => {
    const dt = new Date(act.start_date_local);
    return dt >= start && dt <= end;
  });

  // cache the results
  try {
    await cacheService.cacheActivities(filtered);
    console.log(`Cached ${filtered.length} activities`);
  } catch (e) {
    console.error('Failed to cache activities:', e.message);
  }

  return filtered;
}

async function getActivityById(id) {
  console.log(`Fetching activity ${id} from Strava`);
  await ensureToken();
  const r = await axios.get(`https://www.strava.com/api/v3/activities/${id}`, {
    headers: { Authorization: `Bearer ${tokenObj.access_token}` }
  });
  return r.data;
}

module.exports = {
  exchangeCode,
  ensureToken,
  fetchActivities,
  refreshAccessToken,
  getActivityById,
  tokenObj,
  cacheService
};
