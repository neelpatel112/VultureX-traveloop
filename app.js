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
  'shared':         { title: 'Shared Trips', subtitle: 'Share your plans with others.', render: renderShared }
};

let currentPage = 'dashboard';
let selectedTripId = null;

function navigateTo(page, preserveScroll = false, skipHistory = false) {
  if (!PAGE_CONFIG[page]) return;
  currentPage = page;
  
  if (!skipHistory) {
    history.pushState({ page, tripId: selectedTripId }, '', `#${page}`);
  }
  
  const cfg = PAGE_CONFIG[page];
  const subtitle = page === 'dashboard' ? `Welcome back, ${DATA.user?.name || 'Traveler'}! ${cfg.subtitle}` : cfg.subtitle;
  document.getElementById('page-title').textContent = cfg.title;
  document.getElementById('page-subtitle').textContent = subtitle;
  document.getElementById('page-body').innerHTML = cfg.render();
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  document.getElementById('sidebar').classList.remove('open');
  if (!preserveScroll) window.scrollTo(0, 0);
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
  
  if (selectedTripId) {
    await API.put('/api/trips/' + selectedTripId, body);
    showToast('Trip updated!', 'success');
  } else {
    await API.post('/api/trips', body);
    showToast('Trip created!', 'success');
  }
  
  await refreshTrips();
  selectedTripId = null;
  navigateTo('my-trips');
}

function filterTrips(status, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const grid = document.getElementById('trips-grid');
  const filtered = status === 'all' ? DATA.trips : DATA.trips.filter(t => t.status === status);
  grid.innerHTML = filtered.map(tripCard).join('') || '<p class="text-muted text-center" style="grid-column:1/-1;padding:3rem">No trips found</p>';
}

let citySearchTimeout = null;
async function filterCities() {
  const q = document.getElementById('city-search-input')?.value || '';
  const grid = document.getElementById('cities-grid');
  
  if (!q) {
    grid.innerHTML = DATA.cities.map(cityCard).join('');
    return;
  }

  clearTimeout(citySearchTimeout);
  grid.innerHTML = '<p class="text-muted text-center" style="grid-column:1/-1;padding:3rem">Searching globally...</p>';
  
  citySearchTimeout = setTimeout(async () => {
    try {
      const res = await API.get('/api/cities?q=' + encodeURIComponent(q));
      grid.innerHTML = res.length ? res.map(cityCard).join('') : '<p class="text-muted text-center" style="grid-column:1/-1;padding:3rem">No cities found worldwide</p>';
    } catch (e) {
      grid.innerHTML = '<p class="text-danger text-center" style="grid-column:1/-1;padding:3rem">Error fetching cities</p>';
    }
  }, 600); // 600ms debounce
}

function filterActivities() {
  const t = document.getElementById('act-type-filter')?.value || '';
  const filtered = DATA.catalogActivities.filter(a => (!t || a.type === t));
  document.getElementById('activities-grid').innerHTML = filtered.map(actCard).join('') || '<p class="text-muted text-center" style="grid-column:1/-1;padding:3rem">No activities found</p>';
}

async function searchDestinationActivities() {
  const q = document.getElementById('act-dest-search')?.value?.trim();
  const btn = document.getElementById('act-search-btn');
  if (!q) return;
  
  btn.textContent = 'Searching...';
  btn.disabled = true;
  document.getElementById('activities-grid').innerHTML = '<p class="text-muted text-center" style="grid-column:1/-1;padding:3rem">Fetching real activities from Wikipedia...</p>';
  
  try {
    const res = await API.get('/api/activities/search?q=' + encodeURIComponent(q));
    if (res && res.length) {
      DATA.catalogActivities = res;
      filterActivities();
    } else {
      document.getElementById('activities-grid').innerHTML = '<p class="text-muted text-center" style="grid-column:1/-1;padding:3rem">No activities found for this destination.</p>';
    }
  } catch (err) {
    showToast('Failed to fetch activities', 'error');
    filterActivities();
  } finally {
    btn.textContent = 'Search Destination';
    btn.disabled = false;
  }
}

// ── Stop & Activity Actions ──
async function addStop() {
  const trip = getSelectedTrip();
  if (!trip) { showToast('Select a trip first', 'error'); return; }
  openModal(`
    <div class="modal-header"><div class="modal-title">📍 Add New Stop</div><button class="modal-close" onclick="closeModal()">&times;</button></div>
    <div class="modal-body flex flex-col gap-3">
      <div class="form-group"><label class="form-label">City Name</label><input class="form-input" id="modal-city" placeholder="e.g. Paris, Mumbai, Tokyo" autofocus/></div>
      <div class="grid grid-2">
        <div class="form-group"><label class="form-label">Start Date</label><input class="form-input" type="date" id="modal-stop-start"/></div>
        <div class="form-group"><label class="form-label">End Date</label><input class="form-input" type="date" id="modal-stop-end"/></div>
      </div>
      <div class="grid grid-2">
        <div class="form-group">
          <label class="form-label">Travel Method</label>
          <select class="form-select" id="modal-stop-method">
            <option value="Flight">✈️ Flight</option>
            <option value="Train">🚆 Train</option>
            <option value="Bus">🚌 Bus</option>
            <option value="Car">🚗 Car</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">Est. Travel Cost (USD)</label><input class="form-input" type="number" id="modal-stop-cost" placeholder="0" min="0"/></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitStop(${trip.id})">Add Stop</button>
    </div>
  `);
}

async function submitStop(tripId) {
  const city = document.getElementById('modal-city')?.value?.trim();
  if (!city) { showToast('Please enter a city name', 'error'); return; }
  const start = document.getElementById('modal-stop-start')?.value || '';
  const end = document.getElementById('modal-stop-end')?.value || '';
  const method = document.getElementById('modal-stop-method')?.value || 'Flight';
  const cost = parseFloat(document.getElementById('modal-stop-cost')?.value) || 0;
  closeModal();
  try {
    const trip = getSelectedTrip();
    if (trip) {
      if (!trip.stops) trip.stops = [];
      trip.stops.push({ id: Date.now(), city, start_date: start, end_date: end, travel_method: method, travel_cost: cost, activities: [] });
      navigateTo('itinerary', true);
      showToast(`${city} added!`, 'success');
    }
    
    await API.post(`/api/trips/${tripId}/stops`, { city, start_date: start, end_date: end, travel_method: method, travel_cost: cost });
    await refreshTrips();
    navigateTo('itinerary', true);
  } catch (err) {
    showToast(err.message, 'error');
    refreshTrips().then(() => navigateTo('itinerary', true));
  }
}

window.addActivityToStop = function(stopId, cityName) {
  openModal(`
    <div class="modal-header"><div class="modal-title">🎯 Add Activity</div><button class="modal-close" onclick="closeModal()">&times;</button></div>
    <div class="modal-body flex flex-col gap-3 text-center">
      <p class="text-muted" style="margin-bottom:0.5rem">How would you like to add an activity to <strong>${cityName}</strong>?</p>
      <button class="btn btn-primary" onclick="closeModal(); setTimeout(()=>searchCatalogForCity('${cityName.replace(/'/g, "\\'")}'), 100)">
        🌍 Find in Activities Catalog
      </button>
      <div style="display:flex;align-items:center;color:var(--text-muted);font-size:0.85rem">
        <div style="flex:1;height:1px;background:var(--border-light)"></div>
        <span style="padding:0 0.5rem">OR</span>
        <div style="flex:1;height:1px;background:var(--border-light)"></div>
      </div>
      <button class="btn btn-outline" onclick="closeModal(); setTimeout(()=>addCustomActivityToStop(${stopId}), 100)">
        ✏️ Create Custom Activity
      </button>
    </div>
  `);
};

window.searchCatalogForCity = function(cityName) {
  navigateTo('activities');
  setTimeout(() => {
    const searchInput = document.getElementById('act-dest-search');
    if (searchInput) {
      searchInput.value = cityName;
      searchDestinationActivities();
    }
  }, 100);
};

window.addCustomActivityToStop = async function(stopId) {
  openModal(`
    <div class="modal-header"><div class="modal-title">✏️ Custom Activity</div><button class="modal-close" onclick="closeModal()">&times;</button></div>
    <div class="modal-body flex flex-col gap-3">
      <div class="form-group"><label class="form-label">Activity Name</label><input class="form-input" id="modal-act-name" placeholder="e.g. Eiffel Tower Visit" autofocus/></div>
      <div class="form-group">
        <label class="form-label">Type</label>
        <select class="form-select" id="modal-act-type">
          <option value="Sightseeing">🏛️ Sightseeing</option>
          <option value="Food">🍕 Food</option>
          <option value="Tour">🚌 Tour</option>
          <option value="Nature">🌿 Nature</option>
          <option value="Adventure">🧗 Adventure</option>
          <option value="Entertainment">🎭 Entertainment</option>
          <option value="Shopping">🛍️ Shopping</option>
          <option value="Relaxation">🧘 Relaxation</option>
        </select>
      </div>
      <div class="grid grid-2">
        <div class="form-group"><label class="form-label">Cost ($)</label><input class="form-input" type="number" id="modal-act-cost" placeholder="0" min="0"/></div>
        <div class="form-group"><label class="form-label">Duration</label>
          <select class="form-select" id="modal-act-duration">
            <option value="30m">30 minutes</option>
            <option value="1h" selected>1 hour</option>
            <option value="1.5h">1.5 hours</option>
            <option value="2h">2 hours</option>
            <option value="3h">3 hours</option>
            <option value="4h">4 hours</option>
            <option value="Half day">Half day</option>
            <option value="Full day">Full day</option>
          </select>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitActivity(${stopId})">Add Activity</button>
    </div>
  `);
}

async function submitActivity(stopId) {
  const name = document.getElementById('modal-act-name')?.value?.trim();
  if (!name) { showToast('Please enter an activity name', 'error'); return; }
  const type = document.getElementById('modal-act-type')?.value || 'Sightseeing';
  const cost = parseFloat(document.getElementById('modal-act-cost')?.value) || 0;
  const duration = document.getElementById('modal-act-duration')?.value || '1h';
  closeModal();
  try {
    const trip = getSelectedTrip();
    const stop = trip?.stops?.find(s => s.id === stopId);
    if (stop) {
      if (!stop.activities) stop.activities = [];
      stop.activities.push({ id: Date.now(), name, type, cost, duration });
      navigateTo('itinerary', true);
      showToast('Activity added!', 'success');
    }
    
    await API.post(`/api/stops/${stopId}/activities`, { name, type, cost, duration });
    await refreshTrips();
    navigateTo('itinerary', true);
  } catch (err) {
    showToast(err.message, 'error');
    refreshTrips().then(() => navigateTo('itinerary', true));
  }
}

async function deleteStop(stopId) {
  await API.del('/api/stops/' + stopId);
  await refreshTrips();
  navigateTo('itinerary');
  showToast('Stop removed', 'success');
}

async function deleteActivity(actId) {
  const trip = getSelectedTrip();
  if (trip && trip.stops) {
    trip.stops.forEach(s => {
      if (s.activities) s.activities = s.activities.filter(a => a.id !== actId);
    });
    navigateTo('itinerary', true);
    showToast('Activity removed', 'success');
  }
  
  await API.del('/api/activities/' + actId);
  await refreshTrips();
  navigateTo('itinerary', true);
}

function addCityToTrip(city, travelMethod = 'Flight', travelCost = 0) {
  if (DATA.trips.length === 0) { showToast('Create a trip first!', 'warning'); return; }
  
  const proceedAdd = (tripId) => {
    const trip = DATA.trips.find(t => t.id === tripId);
    if (!trip) return;
    
    const rate = DATA.exchangeRate || 1;
    const currentCostLocal = (trip.stops||[]).reduce((s,st)=>s+(st.travel_cost||0)+(st.activities||[]).reduce((a,act)=>a+act.cost,0),0) * rate;
    const newCostLocal = travelCost * rate;
    if (trip.budget > 0 && (currentCostLocal + newCostLocal) > trip.budget) {
      showToast(`Cannot add ${city}. This exceeds your trip budget of ${(window.formatLocal||(v=>'$'+v))(trip.budget)}!`, 'error');
      return;
    }

    selectedTripId = trip.id;
    if (!trip.stops) trip.stops = [];
    trip.stops.push({ id: Date.now(), city, start_date: '', end_date: '', travel_method: travelMethod, travel_cost: travelCost, activities: [] });
    
    API.post(`/api/trips/${trip.id}/stops`, { city, start_date: '', end_date: '', travel_method: travelMethod, travel_cost: travelCost }).then(async () => {
      await refreshTrips();
      showToast(`${city} added to ${trip.name}!`, 'success');
      navigateTo('itinerary', true);
    });
  };

  if (DATA.trips.length === 1) {
    proceedAdd(DATA.trips[0].id);
  } else {
    window._proceedAdd = proceedAdd;
    const options = DATA.trips.map(t => `<button class="btn btn-outline w-full" style="text-align:left;margin-bottom:0.5rem" onclick="closeModal();window._proceedAdd(${t.id})">🗺️ ${t.name} <span class="text-muted text-sm ml-1">(Budget: ${t.budget?(window.formatLocal||(v=>'$'+v))(t.budget):'None'})</span></button>`).join('');
    openModal(`
      <div class="modal-header"><div class="modal-title">Select Trip</div><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body flex flex-col">
        <p class="text-muted mb-2">Which trip would you like to add <strong>${city}</strong> to?</p>
        ${options}
      </div>
    `);
  }
}

function addActivityToTrip(name, type = 'Sightseeing', cost = 0, duration = '1h') {
  if (DATA.trips.length === 0) { showToast('Create a trip first!', 'warning'); return; }
  
  const allStops = [];
  DATA.trips.forEach(t => {
    (t.stops || []).forEach(s => {
      allStops.push({ tripId: t.id, tripName: t.name, stopId: s.id, city: s.city });
    });
  });
  
  if (allStops.length === 0) {
    showToast('Add a city stop to your trip first!', 'warning');
    return;
  }
  
  window._proceedAddAct = async (stopId, tripId) => {
    const trip = DATA.trips.find(t => t.id === tripId);
    const stop = trip?.stops?.find(s => s.id === stopId);
    if (!stop) return;
    
    const rate = DATA.exchangeRate || 1;
    const currentCostLocal = (trip.stops||[]).reduce((sum,st)=>sum+(st.travel_cost||0)+(st.activities||[]).reduce((a,act)=>a+act.cost,0),0) * rate;
    const newCostLocal = cost * rate;
    if (trip.budget > 0 && (currentCostLocal + newCostLocal) > trip.budget) {
      showToast(`Cannot add ${name}. This exceeds your trip budget of ${(window.formatLocal||(v=>'$'+v))(trip.budget)}!`, 'error');
      return;
    }
    
    if (!stop.activities) stop.activities = [];
    stop.activities.push({ id: Date.now(), name, type, cost, duration });
    
    selectedTripId = tripId;
    API.post(`/api/stops/${stopId}/activities`, { name, type, cost, duration }).then(async () => {
      await refreshTrips();
      showToast(`${name} added to ${stop.city}!`, 'success');
      navigateTo('itinerary', true);
    });
  };
  
  const options = allStops.map(s => `<button class="btn btn-outline w-full" style="text-align:left;margin-bottom:0.5rem" onclick="closeModal();window._proceedAddAct(${s.stopId}, ${s.tripId})">📍 ${s.city} <span class="text-muted text-sm ml-1">(${s.tripName})</span></button>`).join('');
  
  openModal(`
    <div class="modal-header"><div class="modal-title">Select Stop</div><button class="modal-close" onclick="closeModal()">&times;</button></div>
    <div class="modal-body flex flex-col">
      <p class="text-muted mb-2">Which city stop would you like to add <strong>${name}</strong> to?</p>
      <div style="max-height:300px;overflow-y:auto;padding-right:0.5rem">${options}</div>
    </div>
  `);
}

window.toggleStopVisited = async function(stopId, visited) {
  try {
    await API.put(`/api/stops/${stopId}/visited`, { visited });
    await refreshTrips();
    if (currentPage === 'dashboard') {
      await loadInitialData(); // Refresh stats for dashboard
      navigateTo('dashboard', true);
    }
  } catch (err) {
    showToast('Failed to update visited status', 'error');
  }
};

function getSelectedTrip() {
  if (selectedTripId) return DATA.trips.find(t => t.id === selectedTripId);
  return DATA.trips[0] || null;
}

// ── Packing Actions ──
async function togglePack(id) {
  const item = DATA.packingItems.find(i => i.id === id);
  if (!item) return;
  item.packed = item.packed ? 0 : 1;
  navigateTo('packing', true);
  
  API.put('/api/packing/' + id, { packed: item.packed }).catch(err => {
    showToast(err.message, 'error');
    refreshPacking().then(() => navigateTo('packing', true));
  });
}

async function resetPacking() {
  await API.post('/api/packing/reset', {});
  await refreshPacking();
  navigateTo('packing', true);
  showToast('Packing list reset', 'info');
}

async function addSuggestedItem(text, category) {
  DATA.packingItems.push({ id: Date.now(), text, category, packed: 0 });
  navigateTo('packing', true);
  showToast(`${text} added!`, 'success');
  
  API.post('/api/packing', { text, category }).catch(err => {
    showToast(err.message, 'error');
    refreshPacking().then(() => navigateTo('packing', true));
  });
}

async function addAllSuggestedItems() {
  const allSuggested = [
    { text: 'Passport / ID', category: 'Documents' },
    { text: 'Flight Tickets', category: 'Documents' },
    { text: 'Travel Insurance', category: 'Documents' },
    { text: 'Hotel Booking Confirmation', category: 'Documents' },
    { text: 'T-Shirts', category: 'Clothing' },
    { text: 'Pants / Shorts', category: 'Clothing' },
    { text: 'Underwear & Socks', category: 'Clothing' },
    { text: 'Jacket / Hoodie', category: 'Clothing' },
    { text: 'Comfortable Shoes', category: 'Clothing' },
    { text: 'Sunglasses', category: 'Clothing' },
    { text: 'Phone Charger', category: 'Electronics' },
    { text: 'Power Bank', category: 'Electronics' },
    { text: 'Earphones / Headphones', category: 'Electronics' },
    { text: 'Camera', category: 'Electronics' },
    { text: 'Universal Adapter', category: 'Electronics' },
    { text: 'Toothbrush & Paste', category: 'Toiletries' },
    { text: 'Shampoo & Soap', category: 'Toiletries' },
    { text: 'Sunscreen', category: 'Toiletries' },
    { text: 'Deodorant', category: 'Toiletries' },
    { text: 'First Aid Kit', category: 'Medicine' },
    { text: 'Pain Killers', category: 'Medicine' },
    { text: 'Motion Sickness Pills', category: 'Medicine' },
    { text: 'Water Bottle', category: 'General' },
    { text: 'Snacks for Travel', category: 'Snacks' },
    { text: 'Neck Pillow', category: 'General' },
  ];
  const existingTexts = new Set(DATA.packingItems.map(i => i.text.toLowerCase()));
  const toAdd = allSuggested.filter(s => !existingTexts.has(s.text.toLowerCase()));
  
  toAdd.forEach((item, index) => {
    DATA.packingItems.push({ id: Date.now() + index, text: item.text, category: item.category, packed: 0 });
  });
  navigateTo('packing', true);
  showToast(`${toAdd.length} essential items added!`, 'success');
  
  for (const item of toAdd) {
    await API.post('/api/packing', { text: item.text, category: item.category });
  }
  await refreshPacking();
}

async function addPackingItem() {
  openModal(`
    <div class="modal-header"><div class="modal-title">🎒 Add Packing Item</div><button class="modal-close" onclick="closeModal()">&times;</button></div>
    <div class="modal-body flex flex-col gap-3">
      <div class="form-group"><label class="form-label">Item Name</label><input class="form-input" id="modal-pack-text" placeholder="e.g. Passport, Charger, Sunscreen" autofocus/></div>
      <div class="form-group">
        <label class="form-label">Category</label>
        <select class="form-select" id="modal-pack-cat">
          <option value="General">📦 General</option>
          <option value="Documents">📄 Documents</option>
          <option value="Clothing">👕 Clothing</option>
          <option value="Electronics">🔌 Electronics</option>
          <option value="Toiletries">🧴 Toiletries</option>
          <option value="Medicine">💊 Medicine</option>
          <option value="Snacks">🍫 Snacks</option>
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitPackingItem()">Add Item</button>
    </div>
  `);
}

async function submitPackingItem() {
  const text = document.getElementById('modal-pack-text')?.value?.trim();
  if (!text) { showToast('Please enter an item name', 'error'); return; }
  const category = document.getElementById('modal-pack-cat')?.value || 'General';
  closeModal();
  
  DATA.packingItems.push({ id: Date.now(), text, category, packed: 0 });
  navigateTo('packing', true);
  showToast('Item added!', 'success');
  
  API.post('/api/packing', { text, category }).catch(err => {
    showToast(err.message, 'error');
    refreshPacking().then(() => navigateTo('packing', true));
  });
}

async function removePackingItem(id) {
  DATA.packingItems = DATA.packingItems.filter(i => i.id !== id);
  navigateTo('packing', true);
  
  API.del('/api/packing/' + id).catch(err => {
    showToast(err.message, 'error');
    refreshPacking().then(() => navigateTo('packing', true));
  });
}

// ── Notes Actions ──
async function addNote() {
  openModal(`
    <div class="modal-header"><div class="modal-title">📝 Add Note</div><button class="modal-close" onclick="closeModal()">&times;</button></div>
    <div class="modal-body flex flex-col gap-3">
      <div class="form-group"><label class="form-label">Note Title</label><input class="form-input" id="modal-note-title" placeholder="e.g. Hotel check-in info" autofocus/></div>
      <div class="form-group"><label class="form-label">Content</label><textarea class="form-input" id="modal-note-text" rows="4" placeholder="Write your note here..."></textarea></div>
      <div class="form-group">
        <label class="form-label">Link to Trip</label>
        <select class="form-select" id="modal-note-trip">
          <option value="">General (no trip)</option>
          ${DATA.trips.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitNote()">Save Note</button>
    </div>
  `);
}

async function submitNote() {
  const title = document.getElementById('modal-note-title')?.value?.trim();
  if (!title) { showToast('Please enter a title', 'error'); return; }
  const text = document.getElementById('modal-note-text')?.value || '';
  const tripId = document.getElementById('modal-note-trip')?.value || null;
  closeModal();
  await API.post('/api/notes', { title, text, trip_id: tripId || null });
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

window.copyShareLink = function() {
  const input = document.getElementById('share-url');
  if (input) {
    navigator.clipboard.writeText(input.value).then(() => {
      showToast('Share link copied to clipboard!', 'success');
    }).catch(() => {
      input.select();
      document.execCommand('copy');
      showToast('Share link copied!', 'success');
    });
  }
};

window.updateShareLink = function() {
  const select = document.getElementById('share-trip-select');
  if (select) {
    const tripId = select.value;
    const baseUrl = window.location.origin;
    document.getElementById('share-url').value = `${baseUrl}/shared/${tripId}`;
  }
};

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

// ── Account Management ──
window.deleteAccount = async function() {
  if (!confirm('⚠️ Are you sure you want to permanently delete your account?\n\nAll your trips, activities, and data will be lost forever. This cannot be undone.')) return;
  try {
    const res = await fetch('/api/me', { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed');
    showToast('Account deleted. Goodbye!', 'success');
    setTimeout(() => { window.location.href = '/'; }, 1500);
  } catch (e) {
    showToast('Failed to delete account', 'error');
  }
};

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  // Load user data from API
  const ok = await loadAllData();
  if (!ok) { window.location.href = '/'; return; }

  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  function toggleSidebar() {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active', sidebar.classList.contains('open'));
  }
  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  }

  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      navigateTo(item.dataset.page);
      closeSidebar(); // Auto-close on mobile after clicking a nav item
    });
  });
  document.getElementById('menu-btn')?.addEventListener('click', toggleSidebar);
  overlay?.addEventListener('click', closeSidebar);
  document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  
  window.addEventListener('popstate', (event) => {
    if (event.state && event.state.page) {
      selectedTripId = event.state.tripId;
      navigateTo(event.state.page, false, true); // skip pushing history
    } else {
      navigateTo('dashboard', false, true);
    }
  });

  const initialHash = window.location.hash.replace('#', '') || 'dashboard';
  navigateTo(initialHash);
});
