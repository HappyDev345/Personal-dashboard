# BITTERSWEET Production Dashboard

> A realtime calling and technical-operations desk for the live musical
> *Bittersweet*.

The dashboard gives the show caller and production teams one shared view of
scenes, script, lighting, audio, music, screens, microphones, and backstage
changes. It is designed for clear reading on laptops, tablets, and backstage
stations.

## What it does

- Loads all 14 scenes from Acts 1–3.
- Shows the script alongside a technical cue running order.
- Displays lighting, audio, music, screen, microphone, and set information.
- Synchronizes scene selection, cue GO/STBY, timer state, show hold, skipped
  cues, screen freeze, and microphone state over WebSockets.
- Provides read-only specialist dashboards for each production station.
- Provides a private Luke administrator view with connected-user and backend
  diagnostics.
- Includes a local-only rehearsal mode with cue testing, scene looping,
  transition speed, and persistent rehearsal notes.
- Shows explicit online/offline connection status.

## Roles and permissions

| Role | Access |
| --- | --- |
| Show Caller | Change scenes, operate cues, timer, and emergency controls |
| Luke / Admin | Full caller access plus administrator diagnostics |
| Guest | View every dashboard, including Admin; cannot change show state |
| Lighting Tech | Lighting cue feed and GO indicators |
| Audio Tech | Mic grid, audio cues, and music information |
| Backstage Crew | Set-change checklist and readiness status |
| Side Screen Operator | Screen media and CYC information |
| Director | Read-only production overview and notes |

Only the authenticated caller and the username `luke` can broadcast control
events. Permissions are enforced by the server as well as the browser.

## Quick start

### Local development

Requirements: Node.js 18 or newer.

```bash
npm install
npm start
```

Open <http://localhost:3000>. The server serves the dashboard and exposes the
realtime WebSocket connection.

For a static UI preview, open `index.html` directly in a browser. Static mode
does not provide authentication or realtime synchronization.

### Health check

```text
GET /health
```

The endpoint returns the server health and is useful for Render monitoring.

## Render deployment

Create a **Web Service** connected to this repository:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Build command | `npm install` |
| Start command | `npm start` |

Set these environment variables in Render:

- `JWT_SECRET` — a long, random secret. Required in production.
- `SHOW_USERS_JSON` — optional JSON array of additional or replacement users.
- `PORT` — optional; Render supplies this automatically.

Example `SHOW_USERS_JSON`:

```json
[
  {
    "username": "caller",
    "password": "change-me",
    "role": "caller",
    "displayName": "Show Caller"
  },
  {
    "username": "lighting",
    "password": "change-me",
    "role": "lighting",
    "displayName": "Lighting Tech"
  }
]
```

The value must be strict JSON: use double quotes around every property name
and string, do not add comments, and do not leave a trailing comma after the
last property or user. Validate the complete value with a JSON validator
before saving it in Render. `SHOW_USERS_JSON` replaces the configured user
list; the built-in guest account is added automatically if it is missing.

The built-in `guest` account is added automatically if it is not present:

```text
Username: guest
Password: bittersweet
```

Change or replace demo credentials before a public production run. The
dashboard keeps live state in server memory, so a service restart resets the
current cue state and timer.

## Using the dashboard

1. Sign in to the station account.
2. Select a scene from the left navigation.
3. Choose the appropriate station view from the top-right selector.
4. In Caller view, use the technical timeline to see all upcoming cues and
   set actions.
5. Press **STBY** and **GO** for cues when ready.
6. Use **HOLD SHOW**, **SKIP CUE**, or **FREEZE SCREENS** only when necessary.

### Rehearsal mode

Use the **LIVE / REHEARSAL** button in the top bar. Rehearsal mode:

- Prevents local actions from being broadcast to connected stations.
- Ignores incoming live cue and emergency events while active.
- Allows local GO/STBY and emergency-control testing.
- Supports 0.5×, 1×, and 2× transition timing.
- Can loop the current scene after its cues are completed.
- Saves rehearsal notes in the current browser.

Return to **LIVE** before operating the show. The top bar and rehearsal panel
clearly identify the current mode.

## Data and project structure

Scene data is normalized in `production-data.js` and loaded before `app.js`.
Each scene contains:

```text
act, number, title, mics, lighting, audio, music,
set, screens, script
```

Project files:

```text
index.html          Dashboard shell and login screen
styles.css          Responsive production interface
app.js              Browser state, rendering, controls, and WebSocket client
production-data.js  Complete 14-scene production dataset
server.js           Express API, authentication, WebSocket server, and state
package.json        Node.js scripts and dependencies
```

## Realtime behavior

The server maintains shared in-memory show state and broadcasts authorized
events to connected clients. WebSocket tickets are short-lived and issued
after JWT authentication; the JWT is not placed directly in the WebSocket URL.

Important operational notes:

- All connected browsers need network access to the deployed server.
- Browser refreshes preserve authentication but reconnect the WebSocket.
- Render restarts clear in-memory state.
- Keep a local backup or offline copy available for performance use.

## Troubleshooting

**The dashboard says offline**

- Confirm the Render service is running.
- Open `/health`.
- Check that the browser is using the deployed `https://` URL.
- Verify `JWT_SECRET` is configured in Render.

**A user cannot sign in**

- Check the username, password, role, and `displayName` fields.
- Ensure `SHOW_USERS_JSON` is valid JSON.
- Remember that user changes require a service restart/redeploy.

**Cues are not syncing**

- Confirm every station is on the same deployed URL.
- Check the online indicator on each station.
- Sign out and sign back in to obtain a fresh session and WebSocket ticket.

**The admin view is missing**

- The private full-access Admin view is available only when signed in as
  username `luke`.
- The guest account can view Admin but cannot operate controls.

## Design system

- Deep navy interface for low-light production environments
- Gold show branding and status accents
- Purple lighting, blue audio, green music, and orange screen cues
- Red emergency controls with high contrast
- Montserrat headings, Inter interface text, and Georgia script text

## Roadmap

- Persist show state and cue logs beyond process restarts.
- Add media asset validation and playback readiness checks.
- Add exportable post-show cue and timing reports.
- Add offline queueing and automated latency/stress tests.
- Add optional OSC output for lighting desks.

## License

This project is private production software for the *Bittersweet* musical.
