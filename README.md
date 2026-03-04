# Strava Eval

A minimal Node.js/Express application that returns your Strava
activities for the current and previous week.

## Setup

1. Clone or download this repository.
2. Install dependencies:
   ```sh
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in either a pre-existing
   token *or* supply your OAuth client credentials:
   ```text
   # if you already have a token
   STRAVA_ACCESS_TOKEN=your_long_lived_token
   STRAVA_REFRESH_TOKEN=...
   STRAVA_EXPIRES_AT=...

   # or for automated flow
   CLIENT_ID=your_app_id
   CLIENT_SECRET=your_app_secret
   # optional redirect (defaults to http://localhost:3000/callback)
   #REDIRECT_URI=

   PORT=3000      # optional
   ```

   (See the Strava API docs for registering an app,
   https://www.strava.com/settings/api.)

4. Start the server:
   ```sh
   npm start
   ```
   or in development with hot reload:
   ```sh
   npm run dev
   ```

The project follows a simple **MVC** layout: `services/` encapsulates
Strava API logic, `controllers/` translate requests, and `routes/`
wire endpoints. The top‑level `index.js` merely stitches the pieces
and starts Express.

## Endpoints

The application exposes several pages, all accessible via the navigation
bar at the top of each view:

- `GET /` – home page with links to the three main sections.
- `GET /authorize` – begins the OAuth flow by redirecting you to Strava.
  After granting access Strava will call `/callback` with a code.
- `GET /callback?code=...` – exchanges the code for access/refresh tokens
  and redirects back to the requested page.

- `GET /activities` – shows a list of your Strava activities for the
  current and previous week. Each activity row displays:
  Name, type, date, start time, pace and privacy indicator (🔒 for private).
  The page uses cached data when available and indicates cache stats at
  the top. There is a **🔄 Refresh cache from Strava** button that forces
  a new fetch and updates the local SQLite cache.

- `GET /planning` – overview of all training weeks defined by CSV files
  in `data/planning/`. Weeks are shown with their calendar (ISO) week
  number, date range and the training‑schema week (W1–W8). Clicking a
  card navigates to the detail page.

- `GET /planning/:weekNumber` – detail for a specific training week,
  listing every planned workout with type, duration, estimated distance,
  heart‑rate zones and any notes.

- `GET /evaluation` – comparison of planned versus actual workouts per
  week. Each card shows totals and a status badge (Perfect, Over, Under,
  Partial or Planned). A refresh button at the top allows you to update
  the cached activities without leaving the page.

- `GET /evaluation/:weekNumber` – day‑by‑day side‑by‑side view of what
  was planned and what was actually done. Activity laps/splits are
  expandable. This detail page also has a **refresh cache** button which
  pulls fresh data for that week.

## Architecture & Data Handling

All Strava interactions are encapsulated in `services/stravaService.js`.
Activities are cached in a local SQLite database (`data/cache.db`) to
avoid unnecessary API calls. The caching service abstracts reads/writes
and supports range queries by local date.

Date computations—including ISO week numbers and week ranges—are
performed locally to avoid timezone surprises; every activity is
normalized to its `start_date_local` value.

New logic layers (`logic/activityLogic.js`, `logic/planningLogic.js`,
`logic/evaluationLogic.js`) keep controller code thin and make unit
testing easier.

## Caching

All activities are automatically cached in a local SQLite database
(`data/cache.db`) to minimize Strava API usage. Cached items persist
across restarts and are used by the activities and evaluation pages.

When data is available in cache the UI displays a badge showing the
number of cached activities and when they were last updated.

**Refresh cache**

A 🔄 button appears on any page that shows activities (`/activities`,
`/evaluation`, and the evaluation detail view). Clicking it forces a
Strava query for the relevant week(s) and overwrites the cache. This is
useful when you've uploaded new workouts or modified existing ones and
want the site to reflect the changes immediately.



