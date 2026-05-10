// ── Page Renderers (API-backed, user-specific) ──

function renderDashboard() {
  const s = DATA.stats;
  const hasTrips = DATA.trips.length > 0;
  return `
    <div class="grid grid-4 mb-2">
      <div class="stat-card"><div class="stat-label">Total Trips</div><div class="stat-value">${s.totalTrips||0}</div></div>
      <div class="stat-card"><div class="stat-label">Places Explored</div><div class="stat-value">${s.placesExplored||0}</div></div>
      <div class="stat-card"><div class="stat-label">Total Budget</div><div class="stat-value">${(window.formatLocal||(v=>'$'+v))(s.totalBudget||0)}</div></div>
      <div class="stat-card"><div class="stat-label">Next Trip</div><div class="stat-value">${s.nextTrip?s.nextTrip.name:'—'}</div></div>
    </div>
    <div class="grid grid-2 gap-3">
      <div class="card">
        <div class="card-header"><h3 class="card-title">Your Trips</h3><button class="btn btn-accent btn-sm" onclick="selectedTripId=null;navigateTo('create-trip')">+ New</button></div>
        <div class="card-body" style="padding:0">
          ${hasTrips ? DATA.trips.map(t=>`
            <div style="display:flex;align-items:center;gap:1rem;padding:1rem 1.5rem;border-bottom:1px solid var(--border-light);cursor:pointer" onclick="viewTrip(${t.id})">
              <div style="width:48px;height:48px;border-radius:var(--radius-sm);background:url('${t.cover_img}') center/cover;flex-shrink:0"></div>
              <div style="flex:1"><div style="font-weight:600;font-size:0.9rem">${t.name}</div>
              <div style="font-size:0.78rem;color:var(--text-secondary)">${t.start_date||'No date'}</div></div>
              <span class="badge ${t.status==='completed'?'badge-success':t.status==='upcoming'?'badge-info':'badge-warning'}">${t.status}</span>
            </div>`).join('') : '<div style="padding:2rem;text-align:center;color:var(--text-muted)">No trips yet. Create your first trip! ✈️</div>'}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3 class="card-title">Recommended Destinations</h3></div>
        <div class="card-body"><div class="grid grid-2" style="gap:0.75rem">
          ${DATA.cities.slice(0,4).map(c=>`
            <div style="border-radius:var(--radius-md);overflow:hidden;cursor:pointer;position:relative;height:120px;background:url('${c.img}') center/cover" onclick="navigateTo('city-search')">
              <div style="position:absolute;inset:0;background:linear-gradient(transparent,rgba(0,0,0,0.6));display:flex;flex-direction:column;justify-content:flex-end;padding:0.75rem">
                <div style="color:#fff;font-weight:700;font-size:0.9rem">${c.name}</div>
                <div style="color:rgba(255,255,255,0.8);font-size:0.72rem">${c.country} · ${c.cost}</div>
              </div>
            </div>`).join('')}
        </div></div>
      </div>
    </div>`;
}

function renderMyTrips() {
  return `
    <div class="flex justify-between items-center mb-2">
      <div class="tabs">
        <button class="tab active" onclick="filterTrips('all',this)">All</button>
        <button class="tab" onclick="filterTrips('upcoming',this)">Upcoming</button>
        <button class="tab" onclick="filterTrips('planning',this)">Planning</button>
        <button class="tab" onclick="filterTrips('completed',this)">Completed</button>
      </div>
      <button class="btn btn-accent btn-sm" onclick="selectedTripId=null;navigateTo('create-trip')">+ New Trip</button>
    </div>
    <div class="grid grid-3" id="trips-grid">
      ${DATA.trips.length ? DATA.trips.map(tripCard).join('') : '<p class="text-muted text-center" style="grid-column:1/-1;padding:3rem">No trips yet. Start by creating one!</p>'}
    </div>`;
}

function tripCard(t) {
  const cities = (t.stops||[]).map(s=>s.city);
  const fc = window.formatCurrency || (v => '$'+v);
  const fl = window.formatLocal || (v => '$'+v);
  const rate = DATA.exchangeRate || 1;
  const spentUSD = (t.stops||[]).reduce((s,st)=>s+(st.travel_cost||0)+(st.activities||[]).reduce((a,act)=>a+act.cost,0),0);
  const spentLocal = spentUSD * rate;
  return `<div class="trip-card" onclick="viewTrip(${t.id})">
    <div class="trip-card-image" style="background-image:url('${t.cover_img||'images/city-paris.png'}')">
      <span class="trip-badge badge ${t.status==='completed'?'badge-success':t.status==='upcoming'?'badge-info':'badge-warning'}">${t.status}</span>
    </div>
    <div class="trip-card-body">
      <div class="trip-card-title">${t.name}</div>
      <p style="font-size:0.82rem;color:var(--text-secondary);margin:0.3rem 0 0.6rem">${t.description||''}</p>
      <div class="trip-card-meta"><span>📍 ${cities.length} cities</span><span>📅 ${t.start_date||'TBD'}</span></div>
    </div>
    <div class="trip-card-footer">
      <span style="font-size:0.82rem;font-weight:600">${fl(Math.round(spentLocal))} / ${fl(t.budget||0)}</span>
      <div class="flex gap-1">
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();editTrip(${t.id})">✏️</button>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();deleteTrip(${t.id})">🗑️</button>
      </div>
    </div>
  </div>`;
}

function renderCreateTrip() {
  const trip = selectedTripId ? (DATA.trips.find(t => t.id === selectedTripId) || null) : null;
  const isEdit = !!trip;
  const fc = window.formatCurrency || (v => '$'+v);
  const currSymbol = DATA.currentLocation?.currency || 'USD';
  return `<div class="card" style="max-width:640px;margin:0 auto">
    <div class="card-header"><h3 class="card-title">${isEdit ? '✏️ Edit Trip' : 'Create New Trip'}</h3></div>
    <div class="card-body flex flex-col gap-3">
      <div class="form-group"><label class="form-label">Trip Name</label><input class="form-input" id="trip-name" placeholder="e.g. Summer in Europe" value="${isEdit ? trip.name : ''}"/></div>
      <div class="grid grid-2">
        <div class="form-group"><label class="form-label">Start Date</label><input class="form-input" type="date" id="trip-start" value="${isEdit && trip.start_date ? trip.start_date : ''}"/></div>
        <div class="form-group"><label class="form-label">End Date</label><input class="form-input" type="date" id="trip-end" value="${isEdit && trip.end_date ? trip.end_date : ''}"/></div>
      </div>
      <div class="form-group"><label class="form-label">Description</label><textarea class="form-input" id="trip-desc" placeholder="What's this trip about?">${isEdit ? (trip.description||'') : ''}</textarea></div>
      <div class="form-group"><label class="form-label">Budget (${currSymbol})</label><input class="form-input" type="number" id="trip-budget" placeholder="3000" value="${isEdit ? (trip.budget||'') : ''}"/></div>
    </div>
    <div class="card-footer flex justify-between">
      <button class="btn btn-outline" onclick="selectedTripId=null;navigateTo('my-trips')">Cancel</button>
      <button class="btn btn-primary" onclick="saveTrip()">${isEdit ? 'Update Trip' : 'Create Trip'}</button>
    </div>
  </div>`;
}

function renderItinerary() {
  const trip = getSelectedTrip();
  if (!trip) return '<div class="card"><div class="card-body text-center text-muted" style="padding:3rem">No trip selected. <a href="#" onclick="navigateTo(\'my-trips\')" style="color:var(--primary)">Go to My Trips</a></div></div>';
  const stops = trip.stops || [];
  return `
    <div class="flex justify-between items-center mb-2">
      <div><h3 style="font-size:1.1rem;font-weight:700">${trip.name}</h3><p class="text-sm text-muted">${trip.start_date||''} → ${trip.end_date||''}</p></div>
      <div class="flex gap-1">
        <button class="btn btn-outline btn-sm" onclick="selectedTripId=${trip.id};navigateTo('itinerary-view')">📋 View</button>
        <button class="btn btn-accent btn-sm" onclick="addStop()">+ Add Stop</button>
      </div>
    </div>
    ${stops.length ? '<div class="timeline">' + stops.map(s=>`
      <div class="timeline-item">
        <div class="card">
          <div class="card-header">
            <div><span style="font-weight:700">${s.city}</span><span class="text-sm text-muted" style="margin-left:0.5rem">${s.start_date||''} - ${s.end_date||''}</span></div>
            <div class="flex gap-1"><button class="btn btn-ghost btn-sm" onclick="deleteStop(${s.id})">🗑️</button></div>
          </div>
          <div class="card-body">
            <div style="font-size:0.82rem;font-weight:600;margin-bottom:0.5rem;color:var(--text-secondary)">Activities</div>
            ${(s.activities||[]).map(a=>`<div class="checklist-item"><span>🎯</span><span>${a.name} <span class="text-sm text-muted">($${a.cost} · ${a.duration})</span></span><button class="btn btn-ghost btn-sm" onclick="deleteActivity(${a.id})" style="margin-left:auto">✕</button></div>`).join('')}
            ${(s.activities||[]).length===0?'<div class="text-sm text-muted" style="padding:0.5rem 0">No activities yet</div>':''}
            <button class="btn btn-outline btn-sm mt-1 w-full" onclick="addActivityToStop(${s.id}, '${s.city.replace(/'/g, "\\'")}')">+ Add Activity</button>
          </div>
        </div>
      </div>`).join('') + '</div>'
    : '<div class="card"><div class="card-body text-center text-muted" style="padding:2rem">No stops yet. Click "+ Add Stop" to begin planning!</div></div>'}`;
}

function renderItineraryView() {
  const trip = getSelectedTrip();
  if (!trip) return '<div class="card"><div class="card-body text-center text-muted" style="padding:3rem">No trip selected.</div></div>';
  const stops = trip.stops || [];
  return `
    <div class="flex justify-between items-center mb-2">
      <h3 style="font-size:1.1rem;font-weight:700">${trip.name} — Itinerary</h3>
    </div>
    ${stops.length ? stops.map(s=>`
      <div class="card mb-2">
        <div class="card-header" style="background:linear-gradient(135deg,var(--primary),var(--primary-dark));color:#fff;border-radius:var(--radius-lg) var(--radius-lg) 0 0;display:flex;justify-content:space-between;align-items:center;">
          <div><div style="font-weight:700;font-size:1.05rem">📍 ${s.city}</div><div style="font-size:0.8rem;opacity:0.8">${s.start_date||''} - ${s.end_date||''}</div></div>
          <div style="display:flex;align-items:center;gap:0.4rem;font-size:0.85rem">
            <input type="checkbox" style="width:16px;height:16px;cursor:pointer" ${s.visited?'checked':''} onchange="toggleStopVisited(${s.id}, this.checked)">
            <label style="cursor:pointer" onclick="this.previousElementSibling.click()">Visited</label>
          </div>
        </div>
        <div class="card-body" style="padding:0">
          ${(s.activities||[]).map((a,i)=>`<div style="display:flex;align-items:center;gap:1rem;padding:1rem 1.5rem;border-bottom:1px solid var(--border-light)">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--bg-main);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem;color:var(--primary)">${i+1}</div>
            <div style="flex:1"><div style="font-weight:600;font-size:0.88rem">${a.name}</div><div style="font-size:0.75rem;color:var(--text-secondary)">${a.type} · ${a.duration}</div></div>
            <span style="font-weight:600;color:var(--primary)">$${a.cost}</span>
          </div>`).join('')}
          ${(s.activities||[]).length===0?'<div style="padding:1.5rem;text-align:center;color:var(--text-muted)">No activities</div>':''}
        </div>
      </div>`).join('')
    : '<div class="card"><div class="card-body text-center text-muted" style="padding:3rem">No stops in this trip yet.</div></div>'}`;
}

function renderCitySearch() {
  return `
    <div class="flex gap-2 mb-2 items-center">
      <div class="search-bar" style="flex:1"><span class="search-icon">🔍</span><input type="text" placeholder="Search cities..." id="city-search-input" oninput="filterCities()"/></div>
      <select class="form-select" id="region-filter" onchange="filterCities()" style="width:160px">
        <option value="">All Regions</option><option value="Europe">Europe</option><option value="Asia">Asia</option><option value="Americas">Americas</option>
      </select>
    </div>
    <div class="grid grid-3" id="cities-grid">${DATA.cities.map(cityCard).join('')}</div>`;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function cityCard(c) {
  let costText = c.cost;
  let distanceHtml = '';
  let bestMethod = 'Flight';
  let baseCost = 0;
  
  if (c.lat && c.lon && DATA.currentLocation && DATA.currentLocation.latitude) {
    const dist = calculateDistance(DATA.currentLocation.latitude, DATA.currentLocation.longitude, c.lat, c.lon);
    
    if (dist < 200) { bestMethod = 'Bus'; baseCost = dist * 0.04; }
    else if (dist < 800) { bestMethod = 'Train'; baseCost = dist * 0.06; }
    else { bestMethod = 'Flight'; baseCost = 50 + (dist * 0.08); }
    
    if (bestMethod === 'Bus' && baseCost < 5) baseCost = 5;
    if (bestMethod === 'Train' && baseCost < 10) baseCost = 10;
    
    const fc = window.formatCurrency || (v => '$'+v);
    costText = `${fc(baseCost)} via ${bestMethod}`;
    distanceHtml = `<span>${bestMethod==='Flight'?'✈️':bestMethod==='Train'?'🚆':'🚌'} ${Math.round(dist)} km</span>`;
  }
  
  let budgetWarning = '';
  const trip = DATA.trips && DATA.trips.length ? (DATA.trips.find(t => t.id === selectedTripId) || DATA.trips[0]) : null;
  const travelCostLocal = baseCost * (DATA.exchangeRate || 1);
  if (trip && trip.budget > 0 && travelCostLocal > trip.budget) {
    budgetWarning = `<div style="font-size:0.75rem;color:var(--danger);font-weight:600;margin-top:0.3rem">⚠️ Exceeds trip budget (${(window.formatLocal||(v=>'$'+v))(trip.budget)})</div>`;
  }

  return `<div class="trip-card">
    <div class="trip-card-image" style="background-image:url('${c.img}')"><span class="trip-badge badge badge-info">${c.region}</span></div>
    <div class="trip-card-body">
      <div class="trip-card-title">${c.name}</div>
      <div class="trip-card-meta"><span>🌍 ${c.country}</span><span style="color:var(--primary);font-weight:600">${costText}</span>${distanceHtml}</div>
      ${budgetWarning}
    </div>
    <div class="trip-card-footer"><span class="text-sm text-muted">Popularity: ${c.pop}%</span><button class="btn btn-primary btn-sm" onclick="addCityToTrip('${c.name}', '${bestMethod}', ${baseCost})">+ Add</button></div>
  </div>`;
}

function renderActivities() {
  return `
    <div class="flex gap-2 mb-2 items-center">
      <div class="search-bar" style="flex:1"><span class="search-icon">🌍</span><input type="text" placeholder="Search destination (e.g. Paris, Tokyo)..." id="act-dest-search" onkeypress="if(event.key==='Enter') searchDestinationActivities()"/></div>
      <button class="btn btn-primary" onclick="searchDestinationActivities()" id="act-search-btn">Search Destination</button>
      <select class="form-select" id="act-type-filter" onchange="filterActivities()" style="width:160px">
        <option value="">All Types</option><option>Sightseeing</option><option>Food</option><option>Tour</option><option>Nature</option><option>Adventure</option><option>Entertainment</option>
      </select>
    </div>
    <div class="grid grid-3" id="activities-grid">${DATA.catalogActivities.map(actCard).join('')}</div>`;
}

function actCard(a) {
  const fc = window.formatCurrency || (v => '$'+v);
  return `<div class="card">
    <div style="height:120px;background:url('${a.img}') center/cover;border-radius:var(--radius-lg) var(--radius-lg) 0 0"></div>
    <div class="card-body">
      <div style="font-weight:700;font-size:0.95rem;margin-bottom:0.3rem">${a.name}</div>
      <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.6rem">📍 ${a.city} · ${a.duration}</div>
      <div class="flex justify-between items-center"><span class="badge badge-primary">${a.type}</span><span style="font-weight:700;color:var(--primary)">${a.cost===0?'Free':fc(a.cost)}</span></div>
    </div>
    <div class="card-footer" style="padding:0.75rem">
      <button class="btn btn-primary btn-sm w-full" onclick="addActivityToTrip('${a.name}', '${a.type}', ${a.cost}, '${a.duration}')">+ Add to Stop</button>
    </div>
  </div>`;
}

function renderBudget() {
  if (!DATA.trips.length) return '<div class="card"><div class="card-body text-center text-muted" style="padding:3rem">Create a trip to start tracking your budget.</div></div>';
  const trip = getSelectedTrip() || DATA.trips[0];
  const rate = DATA.exchangeRate || 1;
  
  const totalActUSD = (trip.stops||[]).reduce((s,st)=>(st.activities||[]).reduce((a,act)=>a+act.cost,s),0);
  const totalTravelUSD = (trip.stops||[]).reduce((s,st)=>s+(st.travel_cost||0),0);
  const totalActLocal = Math.round(totalActUSD * rate);
  const totalTravelLocal = Math.round(totalTravelUSD * rate);
  const totalCostLocal = totalActLocal + totalTravelLocal;
  
  const isOverBudget = trip.budget > 0 && totalCostLocal > trip.budget;
  const fl = window.formatLocal || (v => '$'+v);
  
  let tripSelector = '';
  if (DATA.trips.length > 1) {
    const options = DATA.trips.map(t => `<option value="${t.id}" ${t.id === trip.id ? 'selected' : ''}>${t.name}</option>`).join('');
    tripSelector = `
      <div style="margin-bottom:1.5rem;display:flex;align-items:center;gap:0.8rem;">
        <label style="font-weight:600;color:var(--text-secondary)">Select Trip:</label>
        <select class="input-field" style="max-width:300px;padding:0.5rem" onchange="selectedTripId=parseInt(this.value);navigateTo('budget', true)">
          ${options}
        </select>
      </div>
    `;
  }
  
  return `
    ${tripSelector}
    ${isOverBudget ? '<div style="background:rgba(239,68,68,0.1);color:#dc2626;padding:1rem;border-radius:var(--radius-md);margin-bottom:1rem;display:flex;align-items:center;gap:0.5rem;font-weight:500">⚠️ <strong>Over Budget Alert:</strong> Your total cost exceeds your trip budget!</div>' : ''}
    <div class="grid grid-4 mb-2">
      <div class="stat-card"><div class="stat-label">Trip Budget</div><div class="stat-value">${fl(trip.budget||0)}</div></div>
      <div class="stat-card"><div class="stat-label">Travel Cost</div><div class="stat-value text-info">${fl(totalTravelLocal)}</div></div>
      <div class="stat-card"><div class="stat-label">Activities Cost</div><div class="stat-value text-primary">${fl(totalActLocal)}</div></div>
      <div class="stat-card"><div class="stat-label">Remaining</div><div class="stat-value" style="color:var(--${isOverBudget?'danger':'success'})">${fl((trip.budget||0)-totalCostLocal)}</div></div>
    </div>
    <div class="card">
      <div class="card-header"><h3 class="card-title">Cost by Stop — ${trip.name}</h3></div>
      <div class="card-body">
        ${(trip.stops||[]).map(s=>{
          const actCost = (s.activities||[]).reduce((a,act)=>a+act.cost,0);
          const trvCost = s.travel_cost || 0;
          const stopTotal = actCost + trvCost;
          return `
          <div style="margin-bottom:1.5rem">
            <div class="flex justify-between" style="font-size:0.95rem;margin-bottom:0.3rem">
              <span style="font-weight:700">📍 ${s.city}</span>
              <span style="font-weight:700">${fl(Math.round((actCost+trvCost)*rate))}</span>
            </div>
            <div class="flex justify-between text-sm text-muted mb-1">
              <span>Travel (${s.travel_method || 'Flight'}): ${fl(Math.round(trvCost*rate))}</span>
              <span>Activities: ${fl(Math.round(actCost*rate))}</span>
            </div>
            <div style="background:var(--bg-main);height:8px;border-radius:99px;overflow:hidden;display:flex">
              <div style="height:100%;width:${stopTotal?Math.min(100,(trvCost/stopTotal)*100):0}%;background:var(--info)"></div>
              <div style="height:100%;width:${stopTotal?Math.min(100,(actCost/stopTotal)*100):0}%;background:var(--primary)"></div>
            </div>
          </div>`;}).join('')}
        ${(trip.stops||[]).length===0?'<p class="text-muted">No stops to show budget for.</p>':''}
      </div>
    </div>`;
}

function renderPacking() {
  const items = DATA.packingItems;
  const packed = items.filter(i=>i.packed).length;
  const categories = [...new Set(items.map(i=>i.category))];

  const suggestedItems = [
    { text: 'Passport / ID', category: 'Documents', icon: '🪪' },
    { text: 'Flight Tickets', category: 'Documents', icon: '✈️' },
    { text: 'Travel Insurance', category: 'Documents', icon: '📋' },
    { text: 'Hotel Booking Confirmation', category: 'Documents', icon: '🏨' },
    { text: 'T-Shirts', category: 'Clothing', icon: '👕' },
    { text: 'Pants / Shorts', category: 'Clothing', icon: '👖' },
    { text: 'Underwear & Socks', category: 'Clothing', icon: '🧦' },
    { text: 'Jacket / Hoodie', category: 'Clothing', icon: '🧥' },
    { text: 'Comfortable Shoes', category: 'Clothing', icon: '👟' },
    { text: 'Sunglasses', category: 'Clothing', icon: '🕶️' },
    { text: 'Phone Charger', category: 'Electronics', icon: '🔌' },
    { text: 'Power Bank', category: 'Electronics', icon: '🔋' },
    { text: 'Earphones / Headphones', category: 'Electronics', icon: '🎧' },
    { text: 'Camera', category: 'Electronics', icon: '📷' },
    { text: 'Universal Adapter', category: 'Electronics', icon: '🔌' },
    { text: 'Toothbrush & Paste', category: 'Toiletries', icon: '🪥' },
    { text: 'Shampoo & Soap', category: 'Toiletries', icon: '🧴' },
    { text: 'Sunscreen', category: 'Toiletries', icon: '☀️' },
    { text: 'Deodorant', category: 'Toiletries', icon: '🧊' },
    { text: 'First Aid Kit', category: 'Medicine', icon: '🩹' },
    { text: 'Pain Killers', category: 'Medicine', icon: '💊' },
    { text: 'Motion Sickness Pills', category: 'Medicine', icon: '💊' },
    { text: 'Water Bottle', category: 'General', icon: '🍶' },
    { text: 'Snacks for Travel', category: 'Snacks', icon: '🍫' },
    { text: 'Neck Pillow', category: 'General', icon: '🛏️' },
  ];

  // Filter out already-added suggested items
  const existingTexts = new Set(items.map(i => i.text.toLowerCase()));
  const availableSuggestions = suggestedItems.filter(s => !existingTexts.has(s.text.toLowerCase()));
  const suggestedCats = [...new Set(availableSuggestions.map(s => s.category))];

  return `
    <div class="flex justify-between items-center mb-2">
      <span class="badge badge-primary" style="font-size:0.85rem;padding:0.4rem 0.8rem">${packed}/${items.length} packed</span>
      <div class="flex gap-1">
        ${availableSuggestions.length ? `<button class="btn btn-outline btn-sm" onclick="addAllSuggestedItems()">✨ Add All Essentials</button>` : ''}
        <button class="btn btn-outline btn-sm" onclick="resetPacking()">↺ Reset</button>
        <button class="btn btn-primary btn-sm" onclick="addPackingItem()">+ Custom Item</button>
      </div>
    </div>
    ${categories.length ? `<div class="grid grid-2 gap-3">${categories.map(cat=>`
      <div class="card">
        <div class="card-header"><h3 class="card-title">${cat}</h3><span class="badge badge-info">${items.filter(i=>i.category===cat&&i.packed).length}/${items.filter(i=>i.category===cat).length}</span></div>
        <div class="card-body" style="padding:0.5rem">
          ${items.filter(i=>i.category===cat).map(item=>`
            <div class="checklist-item ${item.packed?'checked':''}">
              <input type="checkbox" ${item.packed?'checked':''} onchange="togglePack(${item.id})"/>
              <span class="checklist-text">${item.text}</span>
              <button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="removePackingItem(${item.id})">✕</button>
            </div>`).join('')}
        </div>
      </div>`).join('')}</div>` : ''}
    ${availableSuggestions.length ? `
      <div class="card mt-2">
        <div class="card-header"><h3 class="card-title">✨ Suggested Essentials</h3><span class="badge badge-warning">${availableSuggestions.length} items</span></div>
        <div class="card-body">
          <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:1rem">Click any item to add it to your packing list:</p>
          <div class="grid grid-2 gap-3">${suggestedCats.map(cat => `
            <div>
              <div style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:0.5rem">${cat}</div>
              ${availableSuggestions.filter(s=>s.category===cat).map(s=>`
                <div style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0.6rem;border-radius:var(--radius-sm);cursor:pointer;transition:background 0.2s;border:1px solid var(--border-light);margin-bottom:0.4rem" onclick="addSuggestedItem('${s.text.replace(/'/g,"\\'")}','${s.category}')" onmouseover="this.style.background='var(--bg-main)'" onmouseout="this.style.background='transparent'">
                  <span style="font-size:1.1rem">${s.icon}</span>
                  <span style="font-size:0.85rem;font-weight:500;flex:1">${s.text}</span>
                  <span style="color:var(--primary);font-size:1.1rem;font-weight:700">+</span>
                </div>`).join('')}
            </div>`).join('')}
          </div>
        </div>
      </div>` : ''}
    ${!categories.length && !availableSuggestions.length ? '<div class="card"><div class="card-body text-center text-muted" style="padding:3rem">No packing items. Add some!</div></div>' : ''}`;
}

function renderNotes() {
  return `
    <div class="flex justify-between items-center mb-2">
      <h3 style="font-weight:600">Your Notes</h3>
      <button class="btn btn-primary btn-sm" onclick="addNote()">+ New Note</button>
    </div>
    ${DATA.notes.length ? `<div class="grid grid-2 gap-3">${DATA.notes.map(n=>`
      <div class="card">
        <div class="card-header">
          <div><div class="card-title">${n.title}</div><div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.2rem">${n.trip_name||'General'} · ${n.created_at?.split('T')[0]||''}</div></div>
          <div class="flex gap-1"><button class="btn btn-ghost btn-sm" onclick="deleteNote(${n.id})">🗑️</button></div>
        </div>
        <div class="card-body"><p style="font-size:0.88rem;line-height:1.6;color:var(--text-secondary)">${n.text}</p></div>
      </div>`).join('')}</div>`
    : '<div class="card"><div class="card-body text-center text-muted" style="padding:3rem">No notes yet. Start journaling!</div></div>'}`;
}

function renderProfile() {
  const u = DATA.user;
  return `
    <div class="card" style="max-width:640px;margin:0 auto">
      <div class="card-body" style="text-align:center;padding:2rem">
        <div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--primary));margin:0 auto 1rem;display:flex;align-items:center;justify-content:center;font-size:1.8rem;color:#fff;font-weight:700">${u.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)}</div>
        <h3 style="font-size:1.2rem;font-weight:700">${u.name}</h3>
        <p class="text-sm text-muted">${u.email}</p>
        <p class="text-sm text-muted mt-1">Member since ${u.created_at?.split('T')[0]||'—'}</p>
      </div>
    </div>
    <div class="card mt-2" style="max-width:640px;margin:1rem auto 0">
      <div class="card-header"><h3 class="card-title">Settings</h3></div>
      <div class="card-body flex flex-col gap-3">
        <div class="form-group"><label class="form-label">Full Name</label><input class="form-input" id="profile-name" value="${u.name}"/></div>
        <div class="form-group"><label class="form-label">Email</label><input class="form-input" type="email" id="profile-email" value="${u.email}"/></div>
        <div class="form-group"><label class="form-label">Language</label><select class="form-select" id="profile-language"><option ${u.language==='English'?'selected':''}>English</option><option ${u.language==='French'?'selected':''}>French</option><option ${u.language==='Spanish'?'selected':''}>Spanish</option></select></div>
        <div class="flex gap-1 justify-between">
          <button class="btn btn-outline" style="color:var(--danger);border-color:var(--danger)" onclick="deleteAccount()">Delete Account</button>
          <button class="btn btn-primary" onclick="saveProfile()">Save Changes</button>
        </div>
      </div>
    </div>
    <div class="card mt-2" style="max-width:640px;margin:1rem auto 0">
      <div class="card-body text-center"><button class="btn btn-outline w-full" onclick="logout()">🚪 Logout</button></div>
    </div>`;
}

function renderShared() {
  if (!DATA.trips.length) return '<div class="card"><div class="card-body text-center text-muted" style="padding:3rem">Create a trip first to share it with others!</div></div>';
  const selectedTrip = getSelectedTrip() || DATA.trips[0];
  const baseUrl = window.location.origin;
  const shareUrl = `${baseUrl}/shared/${selectedTrip.id}`;
  
  const tripOptions = DATA.trips.map(t => `<option value="${t.id}" ${t.id === selectedTrip.id ? 'selected' : ''}>${t.name}</option>`).join('');
  
  return `
    <div class="card mb-2" style="max-width:700px;margin:0 auto">
      <div class="card-header"><h3 class="card-title">Share Your Trip</h3></div>
      <div class="card-body flex flex-col gap-3">
        <p class="text-sm text-muted">Share your trip plan with friends, family, or fellow travelers. They can view the full itinerary without needing to sign in!</p>
        <div class="form-group">
          <label class="form-label">Select Trip</label>
          <select class="form-select" id="share-trip-select" onchange="updateShareLink()">
            ${tripOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Share Link</label>
          <div class="flex gap-1">
            <input class="form-input" style="flex:1" value="${shareUrl}" readonly id="share-url"/>
            <button class="btn btn-primary" onclick="copyShareLink()">📋 Copy</button>
          </div>
        </div>
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap">
          <a href="https://wa.me/?text=${encodeURIComponent('Check out my trip plan! ' + shareUrl)}" target="_blank" class="btn btn-outline btn-sm" style="text-decoration:none">💬 WhatsApp</a>
          <a href="mailto:?subject=${encodeURIComponent(selectedTrip.name + ' - My Trip Plan')}&body=${encodeURIComponent('Check out my trip plan on Traveloop: ' + shareUrl)}" class="btn btn-outline btn-sm" style="text-decoration:none">📧 Email</a>
          <button class="btn btn-outline btn-sm" onclick="window.open('${shareUrl}', '_blank')">👁️ Preview</button>
        </div>
      </div>
    </div>`;
}
