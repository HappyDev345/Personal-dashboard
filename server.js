const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");
const { WebSocketServer } = require("ws");

const app = express();
const server = http.createServer(app);
const webSocketServer = new WebSocketServer({ server });
const port = process.env.PORT || 3000;
const jwtSecret = process.env.JWT_SECRET || (process.env.NODE_ENV === "production" ? null : "development-only-change-this-secret");
if (!jwtSecret) throw new Error("JWT_SECRET must be set in production.");
const startedAt = new Date();
const connectedUsers = new Map();
const eventLog = [];
const socketTickets = new Map();
const demoUsers = [
  { username: "caller", password: "bittersweet", role: "caller", displayName: "Show Caller" },
  { username: "luke", password: "bittersweet", role: "admin", displayName: "Luke Kohlhoff" },
  { username: "lighting", password: "bittersweet", role: "lighting", displayName: "Lighting Tech" },
  { username: "audio", password: "bittersweet", role: "audio", displayName: "Audio Tech" },
  { username: "backstage", password: "bittersweet", role: "backstage", displayName: "Backstage Crew" },
  { username: "screens", password: "bittersweet", role: "screens", displayName: "Side Screen Operator" },
  { username: "director", password: "bittersweet", role: "director", displayName: "Director" }
];
function loadUsers() {
  if (!process.env.SHOW_USERS_JSON) return process.env.NODE_ENV === "production" ? [] : demoUsers;
  let users;
  try {
    users = JSON.parse(process.env.SHOW_USERS_JSON);
  } catch (error) {
    throw new Error(`SHOW_USERS_JSON must be valid JSON: ${error.message}`);
  }
  if (!Array.isArray(users) || users.some((user) => !user || typeof user.username !== "string" || typeof user.password !== "string" || !["caller", "admin", "lighting", "audio", "backstage", "screens", "director"].includes(user.role) || typeof user.displayName !== "string")) {
    throw new Error("SHOW_USERS_JSON must be an array of users with username, password, role, and displayName.");
  }
  return users;
}
const configuredUsers = loadUsers();

const showState = {
  sceneIndex: 0,
  hold: false,
  holdMessage: "",
  timerStartedAt: Date.now(),
  timerPausedAt: null,
  timerPaused: false,
  cueStates: {},
  micStates: {},
  lastEvent: null
};

function getTimerSeconds() {
  const endTime = showState.timerPausedAt || Date.now();
  return Math.max(0, Math.floor((endTime - showState.timerStartedAt) / 1000));
}

function currentState() {
  return { ...showState, timerSeconds: getTimerSeconds() };
}

app.use(express.static(__dirname));
app.use(express.json());
app.post("/api/login", (request, response) => {
  const { username, password } = request.body || {};
  const user = configuredUsers.find((candidate) => candidate.username === username && candidate.password === password);
  if (!user || (user.role === "admin" && user.username !== "luke")) return response.status(401).json({ error: "Invalid username or password." });
  const token = jwt.sign({ username: user.username, role: user.role, displayName: user.displayName }, jwtSecret, { expiresIn: "12h" });
  return response.json({ token, user: { username: user.username, role: user.role, displayName: user.displayName } });
});
app.post("/api/socket-ticket", authenticateRequest, (request, response) => {
  const ticket = require("crypto").randomBytes(32).toString("hex");
  socketTickets.set(ticket, { user: request.user, expiresAt: Date.now() + 60_000 });
  return response.json({ ticket });
});
app.get("/api/me", authenticateRequest, (request, response) => response.json({ user: request.user }));
app.get("/health", (_request, response) => {
  response.json({ status: "ok", clients: webSocketServer.clients.size });
});

function authenticateToken(token) {
  if (typeof token !== "string" || !token) return null;
  try {
    return jwt.verify(token, jwtSecret);
  } catch {
    return null;
  }
}

function consumeSocketTicket(ticket) {
  const entry = socketTickets.get(ticket);
  if (!entry || entry.expiresAt < Date.now()) {
    socketTickets.delete(ticket);
    return null;
  }
  socketTickets.delete(ticket);
  return entry.user;
}

function authenticateRequest(request, response, next) {
  const user = authenticateToken(request.headers.authorization?.replace(/^Bearer\s+/i, ""));
  if (!user) return response.status(401).json({ error: "Authentication required." });
  request.user = user;
  return next();
}

function broadcast(message) {
  const payload = JSON.stringify(message);
  webSocketServer.clients.forEach((client) => {
    if (client.readyState === 1) client.send(payload);
  });
}

function getDevice(userAgent = "") {
  const device = /iPad|Tablet|Android/i.test(userAgent) ? "Tablet" : /Mobile|iPhone|Android/i.test(userAgent) ? "Mobile" : "Desktop";
  const browser = /Edg/i.test(userAgent) ? "Edge" : /Chrome/i.test(userAgent) ? "Chrome" : /Firefox/i.test(userAgent) ? "Firefox" : /Safari/i.test(userAgent) ? "Safari" : "Browser";
  return `${device} · ${browser}`;
}

function adminSnapshot() {
  return {
    uptimeSeconds: Math.floor((Date.now() - startedAt.getTime()) / 1000),
    clients: webSocketServer.clients.size,
    users: [...connectedUsers.values()],
    lastEvent: showState.lastEvent,
    recentEvents: eventLog,
    state: currentState()
  };
}

function broadcastAdminSnapshot() {
  const payload = JSON.stringify({ type: "admin:update", data: adminSnapshot() });
  webSocketServer.clients.forEach((client) => {
    if (client.readyState === 1 && client.user?.username === "luke") client.send(payload);
  });
}

webSocketServer.on("connection", (socket, request) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const user = consumeSocketTicket(requestUrl.searchParams.get("ticket"));
  if (!user) {
    socket.close(1008, "Authentication required.");
    return;
  }
  socket.user = user;
  const connectionId = `${user.username}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  connectedUsers.set(connectionId, {
    id: connectionId,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    device: getDevice(request.headers["user-agent"]),
    connectedAt: new Date().toISOString()
  });
  socket.send(JSON.stringify({ type: "state:init", state: currentState() }));
  if (user.username === "luke") socket.send(JSON.stringify({ type: "admin:update", data: adminSnapshot() }));
  broadcastAdminSnapshot();

  socket.on("message", (rawMessage) => {
    let message;
    try {
      message = JSON.parse(rawMessage.toString());
    } catch {
      socket.send(JSON.stringify({ type: "error", message: "Invalid event payload." }));
      return;
    }

    if (!message || typeof message.type !== "string") {
      socket.send(JSON.stringify({ type: "error", message: "Event type is required." }));
      return;
    }
    if (!["caller", "admin"].includes(user.role) || (user.role === "admin" && user.username !== "luke")) {
      socket.send(JSON.stringify({ type: "error", message: "Only the show caller can control cues." }));
      return;
    }

    if (message.type === "scene:select" && Number.isInteger(message.sceneIndex)) {
      showState.sceneIndex = message.sceneIndex;
      showState.cueStates = {};
    } else if (message.type === "timer:pause" && !showState.timerPaused) {
      showState.timerPaused = true;
      showState.timerPausedAt = Date.now();
    } else if (message.type === "timer:resume" && showState.timerPaused) {
      showState.timerStartedAt += Date.now() - showState.timerPausedAt;
      showState.timerPaused = false;
      showState.timerPausedAt = null;
    } else if (message.type === "cue:standby" && typeof message.cueId === "string") {
      showState.cueStates[message.cueId] = "standby";
    } else if (message.type === "cue:go" && typeof message.cueId === "string") {
      showState.cueStates[message.cueId] = "go";
    } else if (message.type === "show:hold") {
      showState.hold = Boolean(message.value);
      showState.holdMessage = showState.hold && typeof message.message === "string" ? message.message.trim().slice(0, 160) : "";
    } else if (message.type === "admin:logout-all" && user.username === "luke") {
      showState.lastEvent = { type: message.type, receivedAt: new Date().toISOString() };
      eventLog.unshift(showState.lastEvent);
      eventLog.splice(20);
      broadcast({ type: "admin:logout-all", initiatedBy: user.username });
      webSocketServer.clients.forEach((client) => {
        if (client !== socket && client.readyState === 1) client.close(4001, "Signed out by Luke.");
      });
      broadcastAdminSnapshot();
      return;
    } else if (message.type === "mic:toggle" && typeof message.actor === "string") {
      showState.micStates[message.actor] = Boolean(message.value);
    } else {
      socket.send(JSON.stringify({ type: "error", message: "Unsupported event." }));
      return;
    }

    showState.lastEvent = { ...message, receivedAt: new Date().toISOString() };
    eventLog.unshift(showState.lastEvent);
    eventLog.splice(20);
    broadcast({ type: "event", event: showState.lastEvent });
    broadcast({ type: "state:update", state: currentState(), event: showState.lastEvent });
    broadcastAdminSnapshot();
  });
  socket.on("close", () => {
    connectedUsers.delete(connectionId);
    broadcastAdminSnapshot();
  });
});

server.listen(port, () => {
  console.log(`Bittersweet dashboard listening on port ${port}`);
});
