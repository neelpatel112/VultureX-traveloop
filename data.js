// ── API-backed Data Layer ──
// All data is fetched from the backend and is user-specific

const DATA = {
  user: null,
  trips: [],
  packingItems: [],
  notes: [],
  cities: [],
  catalogActivities: [],
  stats: {},
  adminStats: null,
  currentLocation: null
};

const API = {
  async get(url) {
    const res = await fetch(url, { credentials: 'include' });
    if (res.status === 401) { window.location.href = '/'; return null; }
    if (!res.ok) throw new Error('API error');
    return res.json();
  },
  async post(url, body) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });
    if (res.status === 401) { window.location.href = '/'; return null; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'API error');
    return data;
  },
  async put(url, body) {
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });
    if (res.status === 401) { window.location.href = '/'; return null; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'API error');
    return data;
  },
  async del(url) {
    const res = await fetch(url, { method: 'DELETE', credentials: 'include' });
    if (res.status === 401) { window.location.href = '/'; return null; }
    return res.json();
  }
};

async function loadAllData() {
  try {
    const [user, trips, packing, notes, cities, activities, stats] = await Promise.all([
      API.get('/api/me'),
      API.get('/api/trips'),
      API.get('/api/packing'),
      API.get('/api/notes'),
      API.get('/api/cities'),
      API.get('/api/catalog/activities'),
      API.get('/api/stats')
    ]);
    if (!user) return false;
    DATA.user = user;
    DATA.trips = trips || [];
    DATA.packingItems = packing || [];
    DATA.notes = notes || [];
    DATA.cities = cities || [];
    DATA.catalogActivities = activities || [];
    DATA.stats = stats || {};

    try {
      const ipRes = await fetch('https://ipapi.co/json/');
      if (ipRes.ok) {
        DATA.currentLocation = await ipRes.json();
        const curr = DATA.currentLocation.currency || 'USD';
        try {
          const exRes = await fetch('https://open.er-api.com/v6/latest/USD');
          if (exRes.ok) {
            const exData = await exRes.json();
            DATA.exchangeRate = exData.rates[curr] || 1;
          }
        } catch (e) {}
      }
    } catch (e) {
      console.warn('Could not get IP location', e);
    }
    
    // Global formatCurrency helper (converts USD → local currency)
    window.formatCurrency = function(usdAmount) {
      const rate = DATA.exchangeRate || 1;
      const curr = DATA.currentLocation?.currency || 'USD';
      return new Intl.NumberFormat(DATA.currentLocation?.languages?.split(',')[0] || 'en-US', { style: 'currency', currency: curr, maximumFractionDigits: 0 }).format(usdAmount * rate);
    };
    // Format a value that is ALREADY in local currency (no conversion)
    window.formatLocal = function(localAmount) {
      const curr = DATA.currentLocation?.currency || 'USD';
      return new Intl.NumberFormat(DATA.currentLocation?.languages?.split(',')[0] || 'en-US', { style: 'currency', currency: curr, maximumFractionDigits: 0 }).format(localAmount);
    };

    // Update sidebar user info
    const nameEl = document.querySelector('.user-name');
    const emailEl = document.querySelector('.user-email');
    const avatarEl = document.querySelector('.user-avatar');
    if (nameEl) nameEl.textContent = user.name;
    if (emailEl) emailEl.textContent = user.email;
    if (avatarEl) avatarEl.textContent = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

    return true;
  } catch (e) {
    console.error('Failed to load data:', e);
    return false;
  }
}

async function refreshTrips() {
  DATA.trips = await API.get('/api/trips') || [];
  DATA.stats = await API.get('/api/stats') || {};
}

async function refreshPacking() {
  DATA.packingItems = await API.get('/api/packing') || [];
}

async function refreshNotes() {
  DATA.notes = await API.get('/api/notes') || [];
}

async function refreshAdminStats() {
  try {
    DATA.adminStats = await API.get('/api/admin/stats');
  } catch (e) {
    console.error('Admin stats error:', e);
  }
}
