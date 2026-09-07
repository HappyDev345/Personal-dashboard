# Bittersweet Production Dashboard

A responsive production-control dashboard prototype for the live theatrical production of *Bittersweet*.

The dashboard is designed for show callers, lighting and audio technicians, backstage crew, side-screen operators, and directors working from desktop or tablet devices.

## Features

- Scene navigation with automatic scene data loading
- Role-specific operator views
- Script timeline with highlighted cue lines
- Lighting, audio, music, and screen cue controls
- Standby and GO actions with a live cue log
- Scene timer with pause and resume
- Emergency controls:
  - Hold show
  - Skip cue
  - Freeze screens
- Audio technician mic grid with per-actor toggles
- Backstage set-change checklist
- Music and media playback controls
- Responsive layout for tablets and desktop screens
- Offline-friendly static prototype with no build step

## Getting Started

No dependencies or build tools are required for the current prototype.

1. Clone or download the repository.
2. Open `index.html` in a modern web browser.
3. Select a scene from the left sidebar.
4. Use the role selector to preview each operator interface.

For the best local development experience, serve the folder with any static file server and open the resulting local URL.

## Free Cloud Hosting with Render

Render can host this dashboard instead of GitHub Pages, which is useful when GitHub is blocked on the school network.

### Deploy this branch as a Render Web Service

1. Push the `render` branch to a GitHub repository.
2. Sign in to [Render](https://render.com).
3. Create a **New Web Service**.
4. Connect the repository and choose the branch to deploy.
5. Set the runtime to **Node**.
6. Set the build command to `npm install`.
7. Set the start command to `npm start`.
8. Deploy the service and share the generated `onrender.com` URL.

The Express server serves `index.html`, `styles.css`, and `app.js`, while its WebSocket server synchronizes scene changes, cue states, show hold, and mic toggles across connected browsers.

### Test the server

```bash
npm install
npm start
```

Open `http://localhost:3000` in two browser windows and trigger a cue in one window. Both windows should receive the updated cue state.

The health endpoint is available at `/health`.

This first backend keeps state in server memory. Restarting the Render service resets the show state. Persistent storage and authentication should be added before production use.

Free cloud services may have usage limits, sleep when inactive, or depend on internet access. For a live performance, keep a local backup copy or local server available.

### Configure authentication

The server includes role-based login. On Render, add a `JWT_SECRET` environment variable and a `SHOW_USERS_JSON` secret containing users such as:

```json
[
  { "username": "caller", "password": "*", "role": "caller", "displayName": "Show Caller" },
  { "username": "luke", "password": "*", "role": "admin", "displayName": "Luke" },
  { "username": "lighting", "password": "*", "role": "lighting", "displayName": "Lighting Tech" },
  { "username": "guest", "password": "*", "role": "guest", "displayName": "Guest Viewer" }
]
```

Add one object for each crew member. The `caller` and Luke's `admin` role can send cue, scene, and show-control events. Crew roles receive read-only dashboards. The `guest` role can switch between every dashboard view, including Admin, but cannot send control events. The `admin` role is restricted to the username `luke` and includes a private full-access administrator view with connected-station and backend diagnostics.

## Project Structure

```text
.
├── index.html   # Application shell and layout
├── styles.css   # Responsive visual design
├── app.js       # Scene data, state, and dashboard interactions
└── README.md    # Project documentation
```

## Roles

| Role | Primary tools |
| --- | --- |
| Show Caller | Script timeline, cue control, GO actions, emergency controls |
| Lighting Tech | Lighting cue stack and GO indicators |
| Audio Tech | Mic grid, audio cues, and music controls |
| Backstage Crew | Set-change checklist and readiness status |
| Side Screen Operator | Presentation/media controls and CYC presets |
| Director | System overview, rehearsal notes, and emergency controls |

## Data Model

Scene data is currently represented in `app.js` and follows the production specification:

- Act and scene identifiers
- Scene title
- Microphone assignments
- Lighting cues
- Audio cues
- Music items
- Set-change notes
- Screen media
- Script excerpts

The current implementation uses local browser state for demonstration. A future production deployment can replace this with a Node.js/Express API, WebSocket cue synchronization, authentication, and persistent JSON or MongoDB storage.

## Design

- Deep navy production interface
- Gold show branding and status accents
- Purple lighting cues
- Blue audio cues
- Green music cues
- Orange screen cues
- High-contrast red emergency controls
- Montserrat headings, Inter body text, and Georgia script text

## Suggested Commit Messages

Use small, descriptive commits that follow Conventional Commits:

```text
feat: create Bittersweet production dashboard shell
feat: add scene navigation and cue control workflow
feat: add role-specific operator views
style: add responsive production dashboard theme
docs: add dashboard setup and usage guide
```

If you are committing the current work as one commit, use:

```text
feat: build Bittersweet production dashboard prototype
```

## Roadmap

- Add Node.js and Express backend
- Add WebSocket cue synchronization
- Add JWT authentication and permissions
- Persist scenes and cue logs
- Add real media playback and OSC output
- Add offline fallback and latency/stress testing
