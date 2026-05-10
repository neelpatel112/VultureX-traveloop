require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Database Setup ──
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Supabase
});

// Initialize database schema
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      )
      WITH (OIDS=FALSE);
      -- Drop the constraint if it already exists, then add it
      ALTER TABLE "session" DROP CONSTRAINT IF EXISTS "session_pkey";
      ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        language TEXT DEFAULT 'English',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';

      CREATE TABLE IF NOT EXISTS trips (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        start_date TEXT,
        end_date TEXT,
        budget REAL DEFAULT 0,
        spent REAL DEFAULT 0,
        status TEXT DEFAULT 'planning',
        cover_img TEXT DEFAULT 'images/city-paris.png',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS trip_stops (
        id SERIAL PRIMARY KEY,
        trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        city TEXT NOT NULL,
        start_date TEXT,
        end_date TEXT,
        sort_order INTEGER DEFAULT 0,
        travel_method TEXT DEFAULT 'Flight',
        travel_cost REAL DEFAULT 0
      );
      ALTER TABLE trip_stops ADD COLUMN IF NOT EXISTS travel_method TEXT DEFAULT 'Flight';
      ALTER TABLE trip_stops ADD COLUMN IF NOT EXISTS travel_cost REAL DEFAULT 0;
      ALTER TABLE trip_stops ADD COLUMN IF NOT EXISTS visited BOOLEAN DEFAULT FALSE;

      CREATE TABLE IF NOT EXISTS stop_activities (
        id SERIAL PRIMARY KEY,
        stop_id INTEGER NOT NULL REFERENCES trip_stops(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'Sightseeing',
        cost REAL DEFAULT 0,
        duration TEXT DEFAULT '1h'
      );

      CREATE TABLE IF NOT EXISTS packing_items (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        trip_id INTEGER,
        text TEXT NOT NULL,
        category TEXT DEFAULT 'General',
        packed INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        trip_id INTEGER,
        title TEXT NOT NULL,
        text TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('PostgreSQL Database initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    client.release();
  }
}
initDB();

// ── Middleware ──
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'session'
  }),
  secret: process.env.SESSION_SECRET || 'traveloop-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 day
}));

// ── Auth Middleware ──
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

// ── Public Config ──
app.get('/api/config', (req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || '' });
});

// ══════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════

app.post('/api/signup', async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query('INSERT INTO users (name, email, password, phone) VALUES ($1, $2, $3, $4) RETURNING id', [name, email, hash, phone || '']);
    
    req.session.userId = result.rows[0].id;
    req.session.save(err => {
      if (err) return res.status(500).json({ error: 'Session save failed' });
      res.json({ success: true, user: { id: result.rows[0].id, name, email } });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    req.session.userId = user.id;
    req.session.save(err => {
      if (err) return res.status(500).json({ error: 'Session save failed' });
      res.json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ── Google Sign-In ──
const { OAuth2Client } = require('google-auth-library');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

app.post('/api/google-login', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'No credential provided' });
  
  try {
    const client = new OAuth2Client(GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const { email, name, sub: googleId } = payload;
    
    // Check if user exists
    let result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    let user;
    
    if (result.rows.length > 0) {
      user = result.rows[0];
    } else {
      // Create new user with random password (they'll use Google to login)
      const hash = await bcrypt.hash(googleId + Date.now(), 10);
      const insertResult = await pool.query(
        'INSERT INTO users (name, email, password, phone) VALUES ($1, $2, $3, $4) RETURNING *',
        [name, email, hash, '']
      );
      user = insertResult.rows[0];
    }
    
    req.session.userId = user.id;
    req.session.save(err => {
      if (err) return res.status(500).json({ error: 'Session save failed' });
      res.json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
    });
  } catch (err) {
    console.error('Google login error:', err.message);
    res.status(401).json({ error: 'Invalid Google token' });
  }
});

app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, language, phone, created_at FROM users WHERE id = $1', [req.session.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/me', requireAuth, async (req, res) => {
  const { name, email, language, phone } = req.body;
  try {
    await pool.query('UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), language = COALESCE($3, language), phone = COALESCE($4, phone) WHERE id = $5', [name, email, language, phone, req.session.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/me', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.session.userId]);
    req.session.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════
// TRIPS ROUTES
// ══════════════════════════════════

app.get('/api/trips', requireAuth, async (req, res) => {
  try {
    const tripsResult = await pool.query('SELECT * FROM trips WHERE user_id = $1 ORDER BY created_at DESC', [req.session.userId]);
    const trips = tripsResult.rows;
    
    for (const trip of trips) {
      const stopsResult = await pool.query('SELECT * FROM trip_stops WHERE trip_id = $1 ORDER BY sort_order', [trip.id]);
      trip.stops = stopsResult.rows;
      
      for (const stop of trip.stops) {
        const actsResult = await pool.query('SELECT * FROM stop_activities WHERE stop_id = $1', [stop.id]);
        stop.activities = actsResult.rows;
      }
    }
    res.json(trips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trips', requireAuth, async (req, res) => {
  const { name, description, start_date, end_date, budget, cover_img } = req.body;
  if (!name) return res.status(400).json({ error: 'Trip name required' });
  
  try {
    const result = await pool.query(
      'INSERT INTO trips (user_id, name, description, start_date, end_date, budget, cover_img) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [req.session.userId, name, description || '', start_date, end_date, budget || 0, cover_img || 'images/city-paris.png']
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/trips/:id', requireAuth, async (req, res) => {
  const { name, description, start_date, end_date, budget, spent, status, cover_img } = req.body;
  try {
    const trip = await pool.query('SELECT * FROM trips WHERE id = $1 AND user_id = $2', [req.params.id, req.session.userId]);
    if (trip.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
    
    await pool.query(
      'UPDATE trips SET name=COALESCE($1,name), description=COALESCE($2,description), start_date=COALESCE($3,start_date), end_date=COALESCE($4,end_date), budget=COALESCE($5,budget), spent=COALESCE($6,spent), status=COALESCE($7,status), cover_img=COALESCE($8,cover_img) WHERE id=$9',
      [name, description, start_date, end_date, budget, spent, status, cover_img, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/trips/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM trips WHERE id = $1 AND user_id = $2', [req.params.id, req.session.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Stops ──
app.post('/api/trips/:tripId/stops', requireAuth, async (req, res) => {
  const { city, start_date, end_date, travel_method, travel_cost } = req.body;
  try {
    const trip = await pool.query('SELECT id FROM trips WHERE id = $1 AND user_id = $2', [req.params.tripId, req.session.userId]);
    if (trip.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
    
    const maxOrderRes = await pool.query('SELECT MAX(sort_order) as m FROM trip_stops WHERE trip_id = $1', [req.params.tripId]);
    const maxOrder = maxOrderRes.rows[0].m || 0;
    
    const result = await pool.query(
      'INSERT INTO trip_stops (trip_id, city, start_date, end_date, sort_order, travel_method, travel_cost) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [req.params.tripId, city, start_date, end_date, maxOrder + 1, travel_method || 'Flight', travel_cost || 0]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/stops/:id', requireAuth, async (req, res) => {
  try {
    await pool.query(`DELETE FROM trip_stops WHERE id = $1 AND trip_id IN (SELECT id FROM trips WHERE user_id = $2)`, [req.params.id, req.session.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Activities ──
app.post('/api/stops/:stopId/activities', requireAuth, async (req, res) => {
  const { name, type, cost, duration } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO stop_activities (stop_id, name, type, cost, duration) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [req.params.stopId, name, type || 'Sightseeing', cost || 0, duration || '1h']
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/activities/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM stop_activities WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════
// PACKING ROUTES
// ══════════════════════════════════

app.get('/api/packing', requireAuth, async (req, res) => {
  try {
    const items = await pool.query('SELECT * FROM packing_items WHERE user_id = $1 ORDER BY category, id', [req.session.userId]);
    res.json(items.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/packing', requireAuth, async (req, res) => {
  const { text, category, trip_id } = req.body;
  if (!text) return res.status(400).json({ error: 'Item text required' });
  try {
    const result = await pool.query(
      'INSERT INTO packing_items (user_id, trip_id, text, category) VALUES ($1, $2, $3, $4) RETURNING id',
      [req.session.userId, trip_id || null, text, category || 'General']
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/packing/:id', requireAuth, async (req, res) => {
  const { packed, text, category } = req.body;
  try {
    await pool.query(
      'UPDATE packing_items SET packed=COALESCE($1,packed), text=COALESCE($2,text), category=COALESCE($3,category) WHERE id=$4 AND user_id=$5',
      [packed, text, category, req.params.id, req.session.userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/packing/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM packing_items WHERE id = $1 AND user_id = $2', [req.params.id, req.session.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/packing/reset', requireAuth, async (req, res) => {
  try {
    await pool.query('UPDATE packing_items SET packed = 0 WHERE user_id = $1', [req.session.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════
// NOTES ROUTES
// ══════════════════════════════════

app.get('/api/notes', requireAuth, async (req, res) => {
  try {
    const notes = await pool.query(`
      SELECT notes.*, trips.name as trip_name FROM notes
      LEFT JOIN trips ON notes.trip_id = trips.id
      WHERE notes.user_id = $1 ORDER BY notes.created_at DESC
    `, [req.session.userId]);
    res.json(notes.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notes', requireAuth, async (req, res) => {
  const { title, text, trip_id } = req.body;
  if (!title) return res.status(400).json({ error: 'Note title required' });
  try {
    const result = await pool.query(
      'INSERT INTO notes (user_id, trip_id, title, text) VALUES ($1, $2, $3, $4) RETURNING id',
      [req.session.userId, trip_id || null, title, text || '']
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/notes/:id', requireAuth, async (req, res) => {
  const { title, text } = req.body;
  try {
    await pool.query(
      'UPDATE notes SET title=COALESCE($1,title), text=COALESCE($2,text) WHERE id=$3 AND user_id=$4',
      [title, text, req.params.id, req.session.userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/notes/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM notes WHERE id = $1 AND user_id = $2', [req.params.id, req.session.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Stops Status ──
app.put('/api/stops/:id/visited', requireAuth, async (req, res) => {
  const { visited } = req.body;
  try {
    // Verify user owns the trip
    const check = await pool.query('SELECT trips.user_id FROM trip_stops JOIN trips ON trip_stops.trip_id = trips.id WHERE trip_stops.id = $1', [req.params.id]);
    if (check.rows.length === 0 || check.rows[0].user_id !== req.session.userId) return res.status(403).json({ error: 'Unauthorized' });
    
    await pool.query('UPDATE trip_stops SET visited = $1 WHERE id = $2', [visited, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Dashboard Stats ──
app.get('/api/stats', requireAuth, async (req, res) => {
  const uid = req.session.userId;
  try {
    const totalTripsRes = await pool.query('SELECT COUNT(*) as c FROM trips WHERE user_id = $1', [uid]);
    const placesExploredRes = await pool.query('SELECT COUNT(*) as c FROM trip_stops WHERE trip_id IN (SELECT id FROM trips WHERE user_id = $1) AND visited = TRUE', [uid]);
    const totalBudgetRes = await pool.query('SELECT COALESCE(SUM(budget),0) as s FROM trips WHERE user_id = $1', [uid]);
    const totalSpentRes = await pool.query('SELECT COALESCE(SUM(spent),0) as s FROM trips WHERE user_id = $1', [uid]);
    const nextTripRes = await pool.query("SELECT name, start_date FROM trips WHERE user_id = $1 AND start_date >= TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') ORDER BY start_date LIMIT 1", [uid]);
    
    res.json({ 
      totalTrips: parseInt(totalTripsRes.rows[0].c), 
      placesExplored: parseInt(placesExploredRes.rows[0].c), 
      totalBudget: parseFloat(totalBudgetRes.rows[0].s), 
      totalSpent: parseFloat(totalSpentRes.rows[0].s), 
      nextTrip: nextTripRes.rows[0] || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin Dashboard ──
app.get('/api/admin/stats', requireAuth, async (req, res) => {
  try {
    const usersCount = await pool.query('SELECT COUNT(*) as c FROM users');
    const tripsCount = await pool.query('SELECT COUNT(*) as c FROM trips');
    const budgetTotal = await pool.query('SELECT COALESCE(SUM(budget),0) as s FROM trips');
    const spentTotal = await pool.query('SELECT COALESCE(SUM(spent),0) as s FROM trips');
    const topCities = await pool.query('SELECT city, COUNT(*) as c FROM trip_stops GROUP BY city ORDER BY c DESC LIMIT 5');
    
    res.json({
      totalUsers: parseInt(usersCount.rows[0].c),
      totalTrips: parseInt(tripsCount.rows[0].c),
      totalBudget: parseFloat(budgetTotal.rows[0].s),
      totalSpent: parseFloat(spentTotal.rows[0].s),
      topCities: topCities.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT users.id, users.name, users.email, users.created_at, COUNT(trips.id) as trips_count
      FROM users
      LEFT JOIN trips ON users.id = trips.user_id
      GROUP BY users.id
      ORDER BY users.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', requireAuth, async (req, res) => {
  try {
    if (req.params.id == req.session.userId) return res.status(400).json({ error: "Cannot delete yourself" });
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users/:id/trips', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT trips.*, 
        (SELECT COUNT(*) FROM trip_stops WHERE trip_id = trips.id) as stops_count,
        (SELECT COUNT(*) FROM stop_activities sa JOIN trip_stops ts ON sa.stop_id = ts.id WHERE ts.trip_id = trips.id) as activities_count
      FROM trips WHERE user_id = $1 ORDER BY created_at DESC
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/top-activities', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT sa.name, sa.type, COUNT(*) as usage_count
      FROM stop_activities sa
      GROUP BY sa.name, sa.type
      ORDER BY usage_count DESC
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/recent-trips', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT trips.id, trips.name, trips.budget, trips.start_date, trips.created_at, users.name as user_name, users.email as user_email,
        (SELECT COUNT(*) FROM trip_stops WHERE trip_id = trips.id) as stops_count
      FROM trips
      JOIN users ON trips.user_id = users.id
      ORDER BY trips.created_at DESC
      LIMIT 15
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Shared Trip Public API ──
app.get('/api/public/trips/:id', async (req, res) => {
  try {
    const tripResult = await pool.query('SELECT id, name, description, start_date, end_date, cover_img FROM trips WHERE id = $1', [req.params.id]);
    if (tripResult.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
    const trip = tripResult.rows[0];
    
    const stopsResult = await pool.query('SELECT * FROM trip_stops WHERE trip_id = $1 ORDER BY sort_order', [trip.id]);
    trip.stops = stopsResult.rows;
    for (const stop of trip.stops) {
      const actsResult = await pool.query('SELECT * FROM stop_activities WHERE stop_id = $1', [stop.id]);
      stop.activities = actsResult.rows;
    }
    
    res.json(trip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/shared/:id', (req, res) => res.sendFile(path.join(__dirname, 'shared.html')));

// ── Wikipedia image helper (cached) ──
const wikiImageCache = {};
async function getWikiImage(searchQuery, isCity = true) {
  const cacheKey = searchQuery + (isCity ? '_city' : '_act');
  if (wikiImageCache[cacheKey]) return wikiImageCache[cacheKey];
  try {
    const q = searchQuery.split('-')[0].split(',')[0].trim();
    const finalQ = isCity ? q + ' city' : q;
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=thumbnail&pithumbsize=800&generator=search&gsrsearch=${encodeURIComponent(finalQ)}&gsrlimit=1`;
    
    const wikiRes = await fetch(wikiUrl, {
      headers: {
        'User-Agent': 'TraveloopApp/1.0 (https://traveloop.com; contact@traveloop.com)'
      }
    });
    if (!wikiRes.ok) return null;
    const text = await wikiRes.text();
    try {
      const wikiData = JSON.parse(text);
      if (wikiData.query && wikiData.query.pages) {
        const pages = wikiData.query.pages;
        const pageId = Object.keys(pages)[0];
        if (pageId !== '-1' && pages[pageId].thumbnail) {
          wikiImageCache[cacheKey] = pages[pageId].thumbnail.source;
          return pages[pageId].thumbnail.source;
        }
      }
    } catch (e) {
      console.error('JSON parse error from Wikipedia for', searchQuery);
    }
  } catch (e) { console.error('Wiki image error for', searchQuery, e.message); }
  return null;
}

// ── Catalogs ──
app.get('/api/cities', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    // Return default recommended cities with real Wikipedia images
    const defaults = [
      { id: 1, name: 'Paris', country: 'France', img: 'images/city-paris.png', cost: '$$', pop: 95, region: 'Europe', lat: 48.8566, lon: 2.3522 },
      { id: 2, name: 'Tokyo', country: 'Japan', img: 'images/city-tokyo.png', cost: '$$$', pop: 92, region: 'Asia', lat: 35.6762, lon: 139.6503 },
      { id: 3, name: 'Bali', country: 'Indonesia', img: 'images/city-bali.png', cost: '$', pop: 88, region: 'Asia', lat: -8.3405, lon: 115.092 },
      { id: 4, name: 'New York', country: 'USA', img: 'images/city-newyork.png', cost: '$$$', pop: 97, region: 'Americas', lat: 40.7128, lon: -74.006 },
      { id: 5, name: 'Rome', country: 'Italy', img: 'images/city-paris.png', cost: '$$', pop: 90, region: 'Europe', lat: 41.9028, lon: 12.4964 },
      { id: 6, name: 'London', country: 'UK', img: 'images/city-newyork.png', cost: '$$$', pop: 93, region: 'Europe', lat: 51.5074, lon: -0.1278 }
    ];

    // Fetch real images for defaults
    await Promise.all(defaults.map(async (city) => {
      const realImg = await getWikiImage(city.name);
      if (realImg) city.img = realImg;
    }));

    return res.json(defaults);
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=8&featuretype=city`;
    // We use the built-in fetch in Node.js
    const response = await fetch(url, { headers: { 'User-Agent': 'TraveloopHackathonApp/1.0' } });
    const data = await response.json();
    
    const fallbacks = ['images/city-paris.png', 'images/city-tokyo.png', 'images/city-bali.png', 'images/city-newyork.png'];
    const results = data.map(item => ({
      id: item.place_id,
      name: item.name || item.address.city || item.address.town || 'Unknown',
      country: item.address.country || 'Unknown',
      img: fallbacks[parseInt(item.place_id || 0) % 4] || 'images/city-paris.png', // Rotating Fallback
      cost: '$$', // Fallback
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      pop: Math.floor(Math.random() * 30) + 70, // Mocked popularity
      region: item.address.state || 'Unknown'
    })).filter(c => c.name !== 'Unknown');
    
    // Remove duplicates by name
    const unique = [];
    const names = new Set();
    for (const r of results) {
      if (!names.has(r.name)) {
        names.add(r.name);
        unique.push(r);
      }
    }

    // Fetch real images from Wikipedia API (cached, no API key needed!)
    await Promise.all(unique.map(async (city) => {
      const realImg = await getWikiImage(city.name);
      if (realImg) city.img = realImg;
    }));

    res.json(unique);
  } catch (err) {
    console.error('Nominatim error:', err);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

app.get('/api/catalog/activities', async (req, res) => {
  const activities = [
    { id: 1, name: 'Eiffel Tower Visit', city: 'Paris', type: 'Sightseeing', cost: 25, duration: '2h', img: 'images/city-paris.png' },
    { id: 2, name: 'Seine River Cruise', city: 'Paris', type: 'Tour', cost: 40, duration: '1.5h', img: 'images/city-paris.png' },
    { id: 3, name: 'Shibuya Crossing Walk', city: 'Tokyo', type: 'Sightseeing', cost: 0, duration: '1h', img: 'images/city-tokyo.png' },
    { id: 4, name: 'Sushi Making Class', city: 'Tokyo', type: 'Food', cost: 60, duration: '3h', img: 'images/city-tokyo.png' },
    { id: 5, name: 'Ubud Rice Terraces', city: 'Bali', type: 'Nature', cost: 10, duration: '4h', img: 'images/city-bali.png' },
    { id: 6, name: 'Surf Lesson Kuta', city: 'Bali', type: 'Adventure', cost: 35, duration: '2h', img: 'images/city-bali.png' },
    { id: 7, name: 'Central Park Walk', city: 'New York', type: 'Nature', cost: 0, duration: '2h', img: 'images/city-newyork.png' },
    { id: 8, name: 'Broadway Show', city: 'New York', type: 'Entertainment', cost: 120, duration: '3h', img: 'images/city-newyork.png' },
    { id: 9, name: 'Colosseum Tour', city: 'Rome', type: 'Sightseeing', cost: 30, duration: '2.5h', img: 'images/city-paris.png' },
    { id: 10, name: 'Food Walking Tour', city: 'Rome', type: 'Food', cost: 55, duration: '3h', img: 'images/city-paris.png' },
  ];

  await Promise.all(activities.map(async (activity) => {
    // Try to get a specific image for the activity, fallback to the city image
    const realImg = await getWikiImage(activity.name, false) || await getWikiImage(activity.city, true);
    if (realImg) activity.img = realImg;
  }));

  res.json(activities);
});

app.get('/api/activities/search', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'Search query required' });
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
    const nomRes = await fetch(nomUrl, { headers: { 'User-Agent': 'TraveloopApp/1.0 (https://traveloop.com)' }});
    const nomData = await nomRes.json();
    if (!nomData || nomData.length === 0) return res.json([]);
    
    const lat = nomData[0].lat;
    const lon = nomData[0].lon;
    
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gsradius=10000&gscoord=${lat}|${lon}&gslimit=12&format=json`;
    const wikiRes = await fetch(wikiUrl, { headers: { 'User-Agent': 'TraveloopApp/1.0 (https://traveloop.com)' }});
    const wikiData = await wikiRes.json();
    
    if (!wikiData.query || !wikiData.query.geosearch) return res.json([]);
    
    const activities = wikiData.query.geosearch.map(place => ({
      id: place.pageid,
      name: place.title,
      city: nomData[0].name || q,
      type: 'Sightseeing',
      cost: 0,
      duration: '1h',
      img: 'images/city-paris.png'
    }));
    
    await Promise.all(activities.map(async (act) => {
      const realImg = await getWikiImage(act.name, false) || await getWikiImage(act.city, true);
      if (realImg) act.img = realImg;
    }));
    
    res.json(activities);
  } catch (err) {
    console.error('Activity search error:', err);
    res.status(500).json({ error: 'Failed to search activities' });
  }
});

// ── Public Shared Trip API (no auth required) ──
app.get('/api/shared/trip/:id', async (req, res) => {
  try {
    const tripRes = await pool.query(`
      SELECT trips.*, users.name as owner_name
      FROM trips JOIN users ON trips.user_id = users.id
      WHERE trips.id = $1
    `, [req.params.id]);
    if (tripRes.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
    
    const trip = tripRes.rows[0];
    const stopsRes = await pool.query('SELECT * FROM trip_stops WHERE trip_id = $1 ORDER BY sort_order', [trip.id]);
    trip.stops = stopsRes.rows;
    
    for (const stop of trip.stops) {
      const actsRes = await pool.query('SELECT * FROM stop_activities WHERE stop_id = $1', [stop.id]);
      stop.activities = actsRes.rows;
    }
    
    res.json(trip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'app.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/shared/:id', (req, res) => res.sendFile(path.join(__dirname, 'shared.html')));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  🌍 Traveloop server running at http://localhost:${PORT}`);
    console.log(`  📦 Connected to PostgreSQL (Supabase)\n`);
  });
}

module.exports = app;
