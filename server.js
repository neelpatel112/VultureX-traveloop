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
        sort_order INTEGER DEFAULT 0
      );

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

// ══════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════

app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query('INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id', [name, email, hash]);
    
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

app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, language, created_at FROM users WHERE id = $1', [req.session.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/me', requireAuth, async (req, res) => {
  const { name, email, language } = req.body;
  try {
    await pool.query('UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), language = COALESCE($3, language) WHERE id = $4', [name, email, language, req.session.userId]);
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
  const { city, start_date, end_date } = req.body;
  try {
    const trip = await pool.query('SELECT id FROM trips WHERE id = $1 AND user_id = $2', [req.params.tripId, req.session.userId]);
    if (trip.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
    
    const maxOrderRes = await pool.query('SELECT MAX(sort_order) as m FROM trip_stops WHERE trip_id = $1', [req.params.tripId]);
    const maxOrder = maxOrderRes.rows[0].m || 0;
    
    const result = await pool.query(
      'INSERT INTO trip_stops (trip_id, city, start_date, end_date, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [req.params.tripId, city, start_date, end_date, maxOrder + 1]
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

// ── Dashboard Stats ──
app.get('/api/stats', requireAuth, async (req, res) => {
  const uid = req.session.userId;
  try {
    const totalTripsRes = await pool.query('SELECT COUNT(*) as c FROM trips WHERE user_id = $1', [uid]);
    const totalCitiesRes = await pool.query('SELECT COUNT(DISTINCT city) as c FROM trip_stops WHERE trip_id IN (SELECT id FROM trips WHERE user_id = $1)', [uid]);
    const totalBudgetRes = await pool.query('SELECT COALESCE(SUM(budget),0) as s FROM trips WHERE user_id = $1', [uid]);
    const totalSpentRes = await pool.query('SELECT COALESCE(SUM(spent),0) as s FROM trips WHERE user_id = $1', [uid]);
    const nextTripRes = await pool.query("SELECT name, start_date FROM trips WHERE user_id = $1 AND start_date >= TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') ORDER BY start_date LIMIT 1", [uid]);
    
    res.json({ 
      totalTrips: parseInt(totalTripsRes.rows[0].c), 
      totalCities: parseInt(totalCitiesRes.rows[0].c), 
      totalBudget: parseFloat(totalBudgetRes.rows[0].s), 
      totalSpent: parseFloat(totalSpentRes.rows[0].s), 
      nextTrip: nextTripRes.rows[0] || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Catalogs ──
app.get('/api/cities', (req, res) => {
  res.json([
    { id: 1, name: 'Paris', country: 'France', img: 'images/city-paris.png', cost: '$$', pop: 95, region: 'Europe' },
    { id: 2, name: 'Tokyo', country: 'Japan', img: 'images/city-tokyo.png', cost: '$$$', pop: 92, region: 'Asia' },
    { id: 3, name: 'Bali', country: 'Indonesia', img: 'images/city-bali.png', cost: '$', pop: 88, region: 'Asia' },
    { id: 4, name: 'New York', country: 'USA', img: 'images/city-newyork.png', cost: '$$$', pop: 97, region: 'Americas' },
    { id: 5, name: 'Rome', country: 'Italy', img: 'images/city-paris.png', cost: '$$', pop: 90, region: 'Europe' },
    { id: 6, name: 'London', country: 'UK', img: 'images/city-newyork.png', cost: '$$$', pop: 93, region: 'Europe' },
  ]);
});

app.get('/api/catalog/activities', (req, res) => {
  res.json([
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
  ]);
});

app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'app.html')));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  🌍 Traveloop server running at http://localhost:${PORT}`);
    console.log(`  📦 Connected to PostgreSQL (Supabase)\n`);
  });
}

module.exports = app;
