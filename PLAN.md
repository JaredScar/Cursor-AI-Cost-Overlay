# Cursor AI Cost Optimizer Overlay — Implementation Plan

## What the App Does
A lightweight desktop overlay that sits on a monitor of your choice, only visible when Cursor is the active/focused application. It shows real-time model pricing, recommends the cheapest Claude option at the current time, and alerts you when cheaper options are available.

---

## Tech Stack

- **Framework:** Electron.js (cross-platform, can create transparent overlays, detect active window focus)
- **Frontend:** React + Tailwind CSS (inside Electron renderer)
- **Backend Logic:** Node.js (inside Electron main process)
- **Pricing Data:** Web scraping + caching from cursor.com/pricing and known API sources
- **Storage:** Local JSON file for caching pricing data and user preferences
- **Active Window Detection:** `active-win` npm package (detects which app is in focus)

---

## Core Features

### 1. Window Focus Detection
- Poll every 500ms using `active-win` to check if Cursor is the focused application
- Show overlay when Cursor is focused
- Hide overlay when any other app is focused
- Smooth fade in/out transition

### 2. Monitor Selection
- On first launch, show a setup screen listing all connected monitors
- User picks which monitor to display the overlay on
- Save preference to local config file
- Overlay pins to chosen monitor regardless of where Cursor window is

### 3. Pricing Data Engine
- Fetch pricing from cursor.com/pricing on app launch
- Cache pricing data locally with a 6 hour expiry
- Refresh in background every 6 hours automatically
- If fetch fails, use cached data with a warning indicator
- Parse and store pricing per model (Claude Sonnet, Claude Opus, GPT-4, Gemini, etc.)

### 4. Peak/Off-Peak Detection
- Allow user to manually define peak hours in settings (e.g. 9am–6pm weekday)
- Show a clock indicating current pricing period
- Flag models that are known to be cheaper during off-peak hours
- Show estimated cost per session based on time of day

### 5. Model Recommendation Engine
- At any given moment, calculate and display the cheapest Claude model available
- Show a green/amber/red indicator per model based on current cost
- Display a "Best Value Right Now" recommendation prominently
- Show percentage savings vs the most expensive option

### 6. Overlay UI Layout
```
┌─────────────────────────────────┐
│  🟢 Cursor Active               │
│  ⏰ Off-Peak Hours (saves 23%)  │
├─────────────────────────────────┤
│  BEST VALUE NOW                 │
│  ✅ Claude Sonnet 4.6           │
│     ~$0.003 / 1k tokens         │
├─────────────────────────────────┤
│  ALL MODELS                     │
│  🟢 Sonnet 4.6   $0.003  cheap  │
│  🟡 Opus 4.6     $0.015  mid    │
│  🟢 GPT-4o       $0.005  cheap  │
│  🟡 Gemini Pro   $0.004  mid    │
├─────────────────────────────────┤
│  💡 Switch to Sonnet: save 80%  │
│  Last updated: 2 mins ago  ⚙️   │
└─────────────────────────────────┘
```

### 7. Alerts & Notifications
- Desktop notification when a cheaper model becomes available
- Alert when user is in peak hours and could save by waiting
- Weekly summary of estimated spend based on Cursor usage time

---

## File Structure
```
cursor-overlay/
├── main.js              # Electron main process, window management
├── preload.js           # Secure bridge between main and renderer
├── package.json
├── src/
│   ├── App.jsx          # Main React app
│   ├── components/
│   │   ├── Overlay.jsx          # Main overlay UI
│   │   ├── ModelCard.jsx        # Individual model pricing card
│   │   ├── Recommendation.jsx   # Best value banner
│   │   ├── PeakIndicator.jsx    # Peak/off-peak clock display
│   │   └── Settings.jsx         # Settings panel
│   ├── hooks/
│   │   ├── usePricing.js        # Fetches and caches pricing data
│   │   ├── useWindowFocus.js    # Detects Cursor focus state
│   │   └── useMonitor.js        # Monitor detection and selection
│   ├── utils/
│   │   ├── pricingParser.js     # Parses pricing from web
│   │   ├── peakHours.js         # Peak/off-peak logic
│   │   └── recommendation.js   # Best value calculation logic
│   └── config/
│       └── defaults.js          # Default settings and fallback prices
├── assets/
│   └── icon.png
└── electron-builder.config.js   # Build config for Windows/Mac/Linux
```

---

## Implementation Steps for AI Agent

### Phase 1 — Project Setup
1. Initialise Electron + React project with Vite
2. Install dependencies: `electron`, `active-win`, `electron-builder`, `react`, `tailwindcss`
3. Configure Electron main window as transparent, always-on-top, frameless
4. Set up IPC bridge between main and renderer processes

### Phase 2 — Window & Monitor Management
1. Implement monitor enumeration using Electron's `screen` API
2. Build monitor selection UI shown on first launch
3. Save monitor preference to `electron-store`
4. Position overlay window on correct monitor on launch
5. Implement `active-win` polling loop in main process
6. Send focus state to renderer via IPC every 500ms
7. Implement show/hide with CSS fade transition

### Phase 3 — Pricing Engine
1. Build `pricingParser.js` to fetch and parse cursor.com/pricing
2. Implement 6 hour cache with timestamp checking
3. Add fallback hardcoded prices for when fetch fails
4. Build `recommendation.js` to rank models by cost
5. Expose pricing data to renderer via IPC

### Phase 4 — Peak Hours System
1. Build settings UI for defining peak hour ranges
2. Store peak hours config in `electron-store`
3. Implement `peakHours.js` to check current time against ranges
4. Connect peak status to model recommendation logic
5. Add peak/off-peak indicator to overlay UI

### Phase 5 — Overlay UI
1. Build main `Overlay.jsx` component with all sections
2. Build `ModelCard.jsx` with green/amber/red cost indicators
3. Build `Recommendation.jsx` best value banner
4. Build `PeakIndicator.jsx` clock and status
5. Build collapsible `Settings.jsx` panel (gear icon)
6. Make overlay draggable so user can reposition it
7. Add opacity slider in settings

### Phase 6 — Notifications
1. Use Electron's `Notification` API for desktop alerts
2. Trigger notification when cheaper model becomes available
3. Add toggle in settings to enable/disable notifications
4. Build weekly spend summary notification

### Phase 7 — Build & Distribution
1. Configure `electron-builder` for Windows (.exe), Mac (.dmg), Linux (.AppImage)
2. Set up auto-updater using `electron-updater`
3. Add app to system tray with quick settings access
4. Write README with install instructions

---

## Settings the User Can Configure
- Which monitor to display on
- Overlay position (corner of monitor)
- Overlay opacity (0–100%)
- Peak hours definition (start time, end time, days of week)
- Which models to show/hide
- Notification preferences (on/off, frequency)
- Pricing refresh interval (default 6 hours)
- Auto-launch on system startup

---

## Important Technical Notes for AI Agent
- The overlay window must have `alwaysOnTop: true` and `transparent: true` in Electron `BrowserWindow` options
- Use `setIgnoreMouseEvents(true)` on parts of the overlay that should click-through so it doesn't interfere with Cursor
- `active-win` must run in the main process, not renderer — send results via IPC
- On Mac, accessibility permissions are required to detect active window — prompt user on first launch
- On Windows, no special permissions needed for `active-win`
- Pricing data should never be fetched from the renderer process directly — route through main process to avoid CORS issues
- Use `electron-store` for all persistent storage, not localStorage