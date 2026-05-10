# ✈️ Traveloop — Multi-City Travel Planning Platform

> **Odoo × Parul University Hackathon — Problem Statement: Travel Loop**  
> Built by **Team VultureX**
---
![login page](login.png)
---
A fully offline-capable, single-file travel planning web app built with **React 19 + TypeScript + Zustand**. Plan multi-city trips, manage itineraries, track budgets, and share your adventures — all persisted locally in the browser with no backend required.


## ✨ Features

### 🔐 Authentication
- Sign up and login with local user accounts
- Session persisted via Zustand + `localStorage`
- Profile editing (name, email, avatar, bio)
- Saved destinations list
- Account deletion

### 🏠 Dashboard
- Summary stats: total trips, cities planned, upcoming trips, budget tracked
- Ongoing / upcoming / completed trip status with smart date detection
- Quick-access cards for popular cities (Paris, Tokyo, New York, Bali, Rome, Barcelona)
- One-click navigation to any trip's itinerary

### 🧳 Trip Management
- Create trips with name, description, dates, status, tags, cover image, and public/private toggle
- Edit or delete trips
- Filter trips by status: Planning / Upcoming / Ongoing / Completed
- Each trip has its own stops, packing list, notes, and budget

### 📍 Add Stops (Multi-City Planning)
- Add multiple city stops to a trip with start/end dates
- Set cost index per stop: Budget / Moderate / Luxury
- Add stop-level notes and cover images
- Reorder stops and delete individual stops

### 📋 Itinerary View
- Day-by-day timeline view across all stops
- All activities per stop with cost, duration, type, and location
- Total trip cost aggregated from all activities
- Navigate directly to any stop's activity list
---
![city search](search.png)
---
### 🌍 City Search
- Browse **16 curated global destinations** with descriptions, highlights, daily budget ranges, and ratings
- Filter by continent: Europe / Asia / Americas / Oceania / Africa
- Filter by cost index: Budget / Moderate / Luxury
- Sort by rating or name
- One-click "Add to Trip" with date picker — directly creates a stop in the selected trip

### 🎯 Activity Search
- **27 curated activities** across major cities with real locations, costs, durations, and ratings
- Filter by type: Sightseeing, Food, Adventure, Culture, Shopping, Nightlife, Transport, Accommodation
- Filter by max cost with a live slider
- Search by activity name or city
- Add activities directly to any stop in the current trip
---
![budget page](budget.png)
---
### 💰 Budget Tracker
- Set a total trip budget split across 5 categories: Transport, Accommodation, Activities, Meals, Other
- Interactive **Pie Chart** (category breakdown) and **Bar Chart** (category vs. allocated) via Recharts
- Visual spend indicators per category with over-budget alerts
- Inline budget editing with save/cancel

### 🎒 Packing List
- Add custom items with 6 categories: Clothing, Documents, Electronics, Toiletries, Medicine, Other
- Check/uncheck items as you pack
- Reset all items to unpacked
- Progress bar showing items packed vs. total
- Per-category grouping

### 📝 Trip Notes
- Create notes linked to specific stops or the overall trip
- Edit and delete notes with timestamps (created + last updated)
- Filterable by stop

### 🔗 Share Trip
- Toggle trips between Public and Private
- Auto-generated unique `shareId` per trip
- Copy-to-clipboard shareable link
- Live preview of the shared itinerary as a public viewer would see it

### 📊 Admin Dashboard
- Platform-wide stats: total users, total trips, public trips, total stops, total activities, average budget
- Top Cities bar chart
- Trip status distribution breakdown
- Monthly trip creation line chart
- All charts powered by Recharts

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Language | TypeScript 5.9 (strict mode) |
| State Management | Zustand 5 with `persist` middleware |
| Styling | Tailwind CSS 4 |
| Charts | Recharts 3 |
| Icons | Lucide React |
| Dates | date-fns 4 |
| IDs | uuid 14 |
| Utilities | clsx + tailwind-merge |
| Build Tool | Vite 7 |
| Output | `vite-plugin-singlefile` — single `.html` bundle |

---

## 📁 Project Structure

```
multi-city-travel-planning-platform/
├── index.html                  # Vite entry point
├── package.json
├── vite.config.ts              # Vite + singlefile plugin config
├── tsconfig.json               # TypeScript strict config
└── src/
    ├── main.tsx                # React root mount
    ├── App.tsx                 # Auth gate + page router
    ├── index.css               # Global styles + Tailwind
    ├── utils/
    │   └── cn.ts               # clsx + tailwind-merge helper
    ├── store/
    │   └── useStore.ts         # Zustand store — all state + actions
    ├── components/
    │   └── Sidebar.tsx         # Collapsible sidebar navigation
    └── pages/
        ├── LoginPage.tsx       # Sign up / Login
        ├── Dashboard.tsx       # Overview + stats
        ├── CreateTrip.tsx      # Trip creation form
        ├── MyTrips.tsx         # Trip list with filters
        ├── AddStops.tsx        # Multi-city stop builder
        ├── ItineraryView.tsx   # Day-by-day itinerary timeline
        ├── CitySearch.tsx      # City browser with filters
        ├── ActivitySearch.tsx  # Activity browser with filters
        ├── BudgetPage.tsx      # Budget tracker + charts
        ├── PackingList.tsx     # Packing checklist
        ├── TripNotes.tsx       # Notes per trip/stop
        ├── SharedItinerary.tsx # Public share + link generator
        ├── UserProfile.tsx     # Profile settings
        └── AdminDashboard.tsx  # Platform-wide analytics
```

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js v18+
- npm

### 1. Clone the repository
```bash
git clone https://github.com/neelpatel112/VultureX-traveloop.git
cd VultureX-traveloop
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start the dev server
```bash
npm run dev
```
App runs at `http://localhost:5173`

### 4. Build for production
```bash
npm run build
```
Output: a single `dist/index.html` — fully self-contained, no server needed. Open it directly in any browser.

### 5. Preview the production build
```bash
npm run preview
```

---

## 🗃️ Data & Storage

All data is stored in the browser's `localStorage` under the key `traveloop-storage` via Zustand's `persist` middleware. No backend, no database, no network calls required.

**Persisted state includes:**
- All user accounts and the currently logged-in user
- All trips with their stops, activities, packing lists, notes, and budgets
- Current trip selection and active page

**Data models:**

| Model | Key Fields |
|---|---|
| `User` | id, name, email, avatar, bio, savedDestinations, createdAt |
| `Trip` | id, name, dates, status, stops, packingList, notes, budget, isPublic, shareId, tags |
| `Stop` | id, city, country, dates, activities, notes, coverImage, costIndex |
| `Activity` | id, name, type, cost, duration, description, time, location |
| `PackingItem` | id, name, category, checked |
| `TripNote` | id, title, content, stopId, createdAt, updatedAt |
| `Budget` | total, transport, accommodation, activities, meals, other |

---

## 👥 Team VultureX

Built at the **Odoo × Parul University Hackathon** under the problem statement **"Travel Loop"**.

---

## 📄 License

Built for a hackathon. Free to use and build upon.
 
