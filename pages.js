// ── Page Renderers (API-backed, user-specific) ──

function renderDashboard() {
  const s = DATA.stats;
  const hasTrips = DATA.trips.length > 0;
  return `
    <div class="grid grid-4 mb-2">
      <div class="stat-card"><div class="stat-label">Total Trips</div><div class="stat-value">${s.totalTrips||0}</div></div>
      <div class="stat-card"><div class="stat-label">Cities Explored</div><div class="stat-value">${s.totalCities||0}</div></div>
      <div class="stat-card"><div class="stat-label">Total Budget</div><div class="stat-value">$${s.totalBudget||0}</div></div>
      <div class="stat-card"><div class="stat-label">Next Trip</div><div class="stat-value">${s.nextTrip?s.nextTrip.name:'—'}</div></div>
    </div>
    <div class="grid grid-2 gap-3">
      <div class="card">
        <div class="card-header"><h3 class="card-title">Your Trips</h3><button class="btn btn-accent btn-sm" onclick="navigateTo('create-trip')">+ New</button></div>
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
      <button class="btn btn-accent btn-sm" onclick="navigateTo('create-trip')">+ New Trip</button>
    </div>
    <div class="grid grid-3" id="trips-grid">
      ${DATA.trips.length ? DATA.trips.map(tripCard).join('') : '<p class="text-muted text-center" style="grid-column:1/-1;padding:3rem">No trips yet. Start by creating one!</p>'}
    </div>`;
}

function tripCard(t) {
  const cities = (t.stops||[]).map(s=>s.city);
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
      <span style="font-size:0.82rem;font-weight:600">$${t.spent||0} / $${t.budget||0}</span>
      <div class="flex gap-1">
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();editTrip(${t.id})">✏️</button>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();deleteTrip(${t.id})">🗑️</button>
      </div>
    </div>
  </div>`;
}

function renderCreateTrip() {
  return `<div class="card" style="max-width:640px;margin:0 auto">
    <div class="card-header"><h3 class="card-title">Create New Trip</h3></div>
    <div class="card-body flex flex-col gap-3">
      <div class="form-group"><label class="form-label">Trip Name</label><input class="form-input" id="trip-name" placeholder="e.g. Summer in Europe"/></div>
      <div class="grid grid-2">
        <div class="form-group"><label class="form-label">Start Date</label><input class="form-input" type="date" id="trip-start"/></div>
        <div class="form-group"><label class="form-label">End Date</label><input class="form-input" type="date" id="trip-end"/></div>
      </div>
      <div class="form-group"><label class="form-label">Description</label><textarea class="form-input" id="trip-desc" placeholder="What's this trip about?"></textarea></div>
      <div class="form-group"><label class="form-label">Budget ($)</label><input class="form-input" type="number" id="trip-budget" placeholder="3000"/></div>
    </div>
    <div class="card-footer flex justify-between">
      <button class="btn btn-outline" onclick="navigateTo('my-trips')">Cancel</button>
      <button class="btn btn-primary" onclick="saveTrip()">Create Trip</button>
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
            <button class="btn btn-outline btn-sm mt-1 w-full" onclick="addActivityToStop(${s.id})">+ Add Activity</button>
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
        <div class="card-header" style="background:linear-gradient(135deg,var(--primary),var(--primary-dark));color:#fff;border-radius:var(--radius-lg) var(--radius-lg) 0 0">
          <div><div style="font-weight:700;font-size:1.05rem">📍 ${s.city}</div><div style="font-size:0.8rem;opacity:0.8">${s.start_date||''} - ${s.end_date||''}</div></div>
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

function cityCard(c) {
  return `<div class="trip-card">
    <div class="trip-card-image" style="background-image:url('${c.img}')"><span class="trip-badge badge badge-info">${c.region}</span></div>
    <div class="trip-card-body"><div class="trip-card-title">${c.name}</div><div class="trip-card-meta"><span>🌍 ${c.country}</span><span>💲 ${c.cost}</span><span>🔥 ${c.pop}%</span></div></div>
    <div class="trip-card-footer"><span class="text-sm text-muted">Popularity: ${c.pop}%</span><button class="btn btn-primary btn-sm" onclick="addCityToTrip('${c.name}')">+ Add</button></div>
  </div>`;
}

function renderActivities() {
  return `
    <div class="flex gap-2 mb-2 items-center">
      <div class="search-bar" style="flex:1"><span class="search-icon">🔍</span><input type="text" placeholder="Search activities..." id="act-search" oninput="filterActivities()"/></div>
      <select class="form-select" id="act-type-filter" onchange="filterActivities()" style="width:160px">
        <option value="">All Types</option><option>Sightseeing</option><option>Food</option><option>Tour</option><option>Nature</option><option>Adventure</option><option>Entertainment</option>
      </select>
    </div>
    <div class="grid grid-3" id="activities-grid">${DATA.catalogActivities.map(actCard).join('')}</div>`;
}

function actCard(a) {
  return `<div class="card">
    <div style="height:120px;background:url('${a.img}') center/cover;border-radius:var(--radius-lg) var(--radius-lg) 0 0"></div>
    <div class="card-body">
      <div style="font-weight:700;font-size:0.95rem;margin-bottom:0.3rem">${a.name}</div>
      <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.6rem">📍 ${a.city} · ${a.duration}</div>
      <div class="flex justify-between items-center"><span class="badge badge-primary">${a.type}</span><span style="font-weight:700;color:var(--primary)">${a.cost===0?'Free':'$'+a.cost}</span></div>
    </div>
  </div>`;
}

function renderBudget() {
  if (!DATA.trips.length) return '<div class="card"><div class="card-body text-center text-muted" style="padding:3rem">Create a trip to start tracking your budget.</div></div>';
  const trip = getSelectedTrip() || DATA.trips[0];
  const totalAct = (trip.stops||[]).reduce((s,st)=>(st.activities||[]).reduce((a,act)=>a+act.cost,s),0);
  return `
    <div class="grid grid-4 mb-2">
      <div class="stat-card"><div class="stat-label">Trip Budget</div><div class="stat-value">$${trip.budget||0}</div></div>
      <div class="stat-card"><div class="stat-label">Activities Cost</div><div class="stat-value">$${totalAct}</div></div>
      <div class="stat-card"><div class="stat-label">Remaining</div><div class="stat-value" style="color:var(--success)">$${(trip.budget||0)-totalAct}</div></div>
      <div class="stat-card"><div class="stat-label">Stops</div><div class="stat-value">${(trip.stops||[]).length}</div></div>
    </div>
    <div class="card">
      <div class="card-header"><h3 class="card-title">Cost by Stop — ${trip.name}</h3></div>
      <div class="card-body">
        ${(trip.stops||[]).map(s=>{const cost=(s.activities||[]).reduce((a,act)=>a+act.cost,0);return `
          <div style="margin-bottom:1rem">
            <div class="flex justify-between" style="font-size:0.85rem;margin-bottom:0.3rem"><span style="font-weight:600">📍 ${s.city}</span><span>$${cost}</span></div>
            <div style="background:var(--bg-main);height:8px;border-radius:99px;overflow:hidden"><div style="height:100%;width:${trip.budget?Math.min(100,(cost/trip.budget)*100):0}%;background:var(--primary);border-radius:99px"></div></div>
          </div>`;}).join('')}
        ${(trip.stops||[]).length===0?'<p class="text-muted">No stops to show budget for.</p>':''}
      </div>
    </div>`;
}

function renderPacking() {
  const items = DATA.packingItems;
  const packed = items.filter(i=>i.packed).length;
  const categories = [...new Set(items.map(i=>i.category))];
  return `
    <div class="flex justify-between items-center mb-2">
      <span class="badge badge-primary" style="font-size:0.85rem;padding:0.4rem 0.8rem">${packed}/${items.length} packed</span>
      <div class="flex gap-1">
        <button class="btn btn-outline btn-sm" onclick="resetPacking()">↺ Reset</button>
        <button class="btn btn-primary btn-sm" onclick="addPackingItem()">+ Add Item</button>
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
      </div>`).join('')}</div>`
    : '<div class="card"><div class="card-body text-center text-muted" style="padding:3rem">No packing items. Add some!</div></div>'}`;
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
  const trip = getSelectedTrip();
  return `
    <div class="card mb-2">
      <div class="card-header"><h3 class="card-title">Share Your Trip</h3></div>
      <div class="card-body">
        <div class="form-group mb-2"><label class="form-label">Select Trip</label><select class="form-select">${DATA.trips.map(t=>`<option>${t.name}</option>`).join('')}${!DATA.trips.length?'<option>No trips available</option>':''}</select></div>
        <div class="flex gap-1">
          <input class="form-input" style="flex:1" value="https://traveloop.com/shared/${trip?trip.id:'...'}" readonly id="share-url"/>
          <button class="btn btn-primary" onclick="copyShareLink()">📋 Copy</button>
        </div>
      </div>
    </div>`;
}
