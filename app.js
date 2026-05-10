// ── Router & App Logic (API-backed) ──

const PAGE_CONFIG = {
  'dashboard':      { title: 'Dashboard', subtitle: 'Here\'s your travel overview.', render: renderDashboard },
  'my-trips':       { title: 'My Trips', subtitle: 'Manage all your travel plans.', render: renderMyTrips },
  'create-trip':    { title: 'Create Trip', subtitle: 'Start planning a new adventure.', render: renderCreateTrip },
  'itinerary':      { title: 'Itinerary Builder', subtitle: 'Build your day-by-day plan.', render: renderItinerary },
  'itinerary-view': { title: 'Itinerary View', subtitle: 'Review your full trip plan.', render: renderItineraryView },
  'city-search':    { title: 'City Search', subtitle: 'Discover amazing destinations.', render: renderCitySearch },
  'activities':     { title: 'Activities', subtitle: 'Find things to do at your stops.', render: renderActivities },
  'budget':         { title: 'Budget', subtitle: 'Track your trip expenses.', render: renderBudget },
  'packing':        { title: 'Packing List', subtitle: 'Never forget essentials.', render: renderPacking },
  'notes':          { title: 'Trip Notes', subtitle: 'Jot down important details.', render: renderNotes },
  'profile':        { title: 'Profile', subtitle: 'Manage your account settings.', render: renderProfile },
  'shared':         { title: 'Shared Trips', subtitle: 'Share your plans with others.', render: renderShared },
};

let currentPage = 'dashboard';
let selectedTripId = null;

function navigateTo(page) {
  if (!PAGE_CONFIG[page]) return;
  currentPage = page;
  const cfg = PAGE_CONFIG[page];
  const subtitle = page === 'dashboard' ? `Welcome back, ${DATA.user?.name || 'Traveler'}! ${cfg.subtitle}` : cfg.subtitle;
  document.getElementById('page-title').textContent = cfg.title;
  document.getElementById('page-subtitle').textContent = subtitle;
  document.getElementById('page-body').innerHTML = cfg.render();
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  document.getElementById('sidebar').classList.remove('open');
  window.scrollTo(0, 0);
}

// ── Trip Actions ──
function viewTrip(id) {
  selectedTripId = id;
  navigateTo('itinerary');
}

function editTrip(id) {
  selectedTripId = id;
  navigateTo('create-trip');
}

async function deleteTrip(id) {
  if (!confirm('Delete this trip?')) return;
  await API.del('/api/trips/' + id);
  await refreshTrips();
  navigateTo('my-trips');
  showToast('Trip deleted', 'success');
}

async function saveTrip() {
  const name = document.getElementById('trip-name')?.value;
  if (!name) { showToast('Please enter a trip name', 'error'); return; }
  const body = {
    name,
    description: document.getElementById('trip-desc')?.value || '',
    start_date: document.getElementById('trip-start')?.value || null,
    end_date: document.getElementById('trip-end')?.value || null,
    budget: parseFloat(document.getElementById('trip-budget')?.value) || 0,
    cover_img: 'images/city-paris.png'
  };
  await API.post('/api/trips', body);
  await refreshTrips();
  showToast('Trip created!', 'success');
  navigateTo('my-trips');
}

function filterTrips(status, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const grid = document.getElementById('trips-grid');
  const filtered = status === 'all' ? DATA.trips : DATA.trips.filter(t => t.status === status);
  grid.innerHTML = filtered.map(tripCard).join('') || '<p class="text-muted text-center" style="grid-column:1/-1;padding:3rem">No trips found</p>';
}

function filterCities() {
  const q = (document.getElementById('city-search-input')?.value || '').toLowerCase();
  const r = document.getElementById('region-filter')?.value || '';
  const filtered = DATA.cities.filter(c => (!q || c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q)) && (!r || c.region === r));
  document.getElementById('cities-grid').innerHTML = filtered.map(cityCard).join('') || '<p class="text-muted text-center" style="grid-column:1/-1;padding:3rem">No cities found</p>';
}

function filterActivities() {
  const q = (document.getElementById('act-search')?.value || '').toLowerCase();
  const t = document.getElementById('act-type-filter')?.value || '';
  const filtered = DATA.catalogActivities.filter(a => (!q || a.name.toLowerCase().includes(q) || a.city.toLowerCase().includes(q)) && (!t || a.type === t));
  document.getElementById('activities-grid').innerHTML = filtered.map(actCard).join('') || '<p class="text-muted text-center" style="grid-column:1/-1;padding:3rem">No activities found</p>';
}

// ── Stop & Activity Actions ──
async function addStop() {
  const trip = getSelectedTrip();
  if (!trip) { showToast('Select a trip first', 'error'); return; }
  const city = prompt('City name:');
  if (!city) return;
  const start = prompt('Start date (YYYY-MM-DD):') || '';
  const end = prompt('End date (YYYY-MM-DD):') || '';
  await API.post(`/api/trips/${trip.id}/stops`, { city, start_date: start, end_date: end });
  await refreshTrips();
  navigateTo('itinerary');
  showToast(`${city} added!`, 'success');
}

async function addActivityToStop(stopId) {
  const name = prompt('Activity name:');
  if (!name) return;
  const type = prompt('Type (Sightseeing/Food/Tour/Nature/Adventure):') || 'Sightseeing';
  const cost = parseFloat(prompt('Cost ($):') || '0');
  const duration = prompt('Duration (e.g. 2h):') || '1h';
  await API.post(`/api/stops/${stopId}/activities`, { name, type, cost, duration });
  await refreshTrips();
  navigateTo('itinerary');
  showToast('Activity added!', 'success');
}

async function deleteStop(stopId) {
  await API.del('/api/stops/' + stopId);
  await refreshTrips();
  navigateTo('itinerary');
  showToast('Stop removed', 'success');
}

async function deleteActivity(actId) {
  await API.del('/api/activities/' + actId);
  await refreshTrips();
  navigateTo('itinerary');
  showToast('Activity removed', 'success');
}

function addCityToTrip(city) {
  if (DATA.trips.length === 0) { showToast('Create a trip first!', 'warning'); return; }
  const trip = DATA.trips[0];
  selectedTripId = trip.id;
  API.post(`/api/trips/${trip.id}/stops`, { city, start_date: '', end_date: '' }).then(async () => {
    await refreshTrips();
    showToast(`${city} added to ${trip.name}!`, 'success');
  });
}

function addActivityToTrip(actName) {
  if (DATA.trips.length === 0) { showToast('Create a trip first!', 'warning'); return; }
  showToast(`Navigate to Itinerary Builder to add "${actName}" to a stop`, 'info');
}

function getSelectedTrip() {
  if (selectedTripId) return DATA.trips.find(t => t.id === selectedTripId);
  return DATA.trips[0] || null;
}

// ── Packing Actions ──
async function togglePack(id) {
  const item = DATA.packingItems.find(i => i.id === id);
  if (!item) return;
  await API.put('/api/packing/' + id, { packed: item.packed ? 0 : 1 });
  await refreshPacking();
  navigateTo('packing');
}

async function resetPacking() {
  await API.post('/api/packing/reset', {});
  await refreshPacking();
  navigateTo('packing');
  showToast('Packing list reset', 'info');
}

async function addPackingItem() {
  const text = prompt('Item name:');
  if (!text) return;
  const category = prompt('Category (Documents/Clothing/Electronics/Toiletries):') || 'General';
  await API.post('/api/packing', { text, category });
  await refreshPacking();
  navigateTo('packing');
  showToast('Item added!', 'success');
}

async function removePackingItem(id) {
  await API.del('/api/packing/' + id);
  await refreshPacking();
  navigateTo('packing');
}

// ── Notes Actions ──
async function addNote() {
  const title = prompt('Note title:');
  if (!title) return;
  const text = prompt('Note content:') || '';
  const tripId = DATA.trips.length > 0 ? DATA.trips[0].id : null;
  await API.post('/api/notes', { title, text, trip_id: tripId });
  await refreshNotes();
  navigateTo('notes');
  showToast('Note added!', 'success');
}

function editNote(id) { showToast('Edit note feature coming soon', 'info'); }

async function deleteNote(id) {
  await API.del('/api/notes/' + id);
  await refreshNotes();
  navigateTo('notes');
  showToast('Note deleted', 'success');
}

function copyShareLink() {
  const url = document.getElementById('share-url');
  if (url) { navigator.clipboard?.writeText(url.value); showToast('Link copied!', 'success'); }
}

// ── Profile Actions ──
async function saveProfile() {
  const name = document.querySelector('#profile-name')?.value;
  const email = document.querySelector('#profile-email')?.value;
  const language = document.querySelector('#profile-language')?.value;
  await API.put('/api/me', { name, email, language });
  DATA.user = await API.get('/api/me');
  document.querySelector('.user-name').textContent = DATA.user.name;
  document.querySelector('.user-email').textContent = DATA.user.email;
  showToast('Profile updated!', 'success');
}

async function deleteAccount() {
  if (!confirm('Are you sure? This will delete all your data permanently.')) return;
  await API.del('/api/me');
  window.location.href = '/';
}

async function logout() {
  await API.post('/api/logout', {});
  window.location.href = '/';
}

// ── Toast ──
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type==='success'?'✅':type==='error'?'❌':type==='warning'?'⚠️':'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 3000);
}

function openModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('active');
}
function closeModal() { document.getElementById('modal-overlay').classList.remove('active'); }

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  // Load user data from API
  const ok = await loadAllData();
  if (!ok) { window.location.href = '/'; return; }

  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.page));
  });
  document.getElementById('menu-btn')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
  document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  navigateTo('dashboard');
});
