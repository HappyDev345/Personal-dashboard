const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");
const { WebSocketServer } = require("ws");

const app = express();
const server = http.createServer(app);
const webSocketServer = new WebSocketServer({ server });
const port = process.env.PORT || 3000;
const jwtSecret = process.env.JWT_SECRET || "development-only-change-this-secret";
const demoUsers = [
  { username: "caller", password: "bittersweet", role: "caller", displayName: "Show Caller" },
  { username: "luke", password: "bittersweet", role: "admin", displayName: "Luke Kohlhoff" },
  { username: "lighting", password: "bittersweet", role: "lighting", displayName: "Lighting Tech" },
  { username: "audio", password: "bittersweet", role: "audio", displayName: "Audio Tech" },
  { username: "backstage", password: "bittersweet", role: "backstage", displayName: "Backstage Crew" },
  { username: "screens", password: "bittersweet", role: "screens", displayName: "Side Screen Operator" },
  { username: "director", password: "bittersweet", role: "director", displayName: "Director" }
];
const configuredUsers = process.env.SHOW_USERS_JSON
  ? JSON.parse(process.env.SHOW_USERS_JSON)
  : process.env.NODE_ENV === "production" ? [] : demoUsers;

const showState = {
  sceneIndex: 0,
  hold: false,
  cueStates: {},
  micStates: {},
  lastEvent: null
};

app.use(express.static(__dirname));
app.use(express.json());
app.post("/api/login", (request, response) => {
  const { username, password } = request.body || {};
  const user = configuredUsers.find((candidate) => candidate.username === username && candidate.password === password);
  if (!user) return response.status(401).json({ error: "Invalid username or password." });
  const token = jwt.sign({ username: user.username, role: user.role, displayName: user.displayName }, jwtSecret, { expiresIn: "12h" });
  return response.json({ token, user: { username: user.username, role: user.role, displayName: user.displayName } });
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

webSocketServer.on("connection", (socket, request) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const user = authenticateToken(requestUrl.searchParams.get("token"));
  if (!user) {
    socket.close(1008, "Authentication required.");
    return;
  }
  socket.send(JSON.stringify({ type: "state:init", state: showState }));

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
    if (!["caller", "admin"].includes(user.role)) {
      socket.send(JSON.stringify({ type: "error", message: "Only the show caller can control cues." }));
      return;
    }

    if (message.type === "scene:select" && Number.isInteger(message.sceneIndex)) {
      showState.sceneIndex = message.sceneIndex;
      showState.cueStates = {};
    } else if (message.type === "cue:standby" && typeof message.cueId === "string") {
      showState.cueStates[message.cueId] = "standby";
    } else if (message.type === "cue:go" && typeof message.cueId === "string") {
      showState.cueStates[message.cueId] = "go";
    } else if (message.type === "show:hold") {
      showState.hold = Boolean(message.value);
    } else if (message.type === "mic:toggle" && typeof message.actor === "string") {
      showState.micStates[message.actor] = Boolean(message.value);
    } else {
      socket.send(JSON.stringify({ type: "error", message: "Unsupported event." }));
      return;
    }

    showState.lastEvent = { ...message, receivedAt: new Date().toISOString() };
    broadcast({ type: "event", event: showState.lastEvent });
    broadcast({ type: "state:update", state: showState, event: showState.lastEvent });
  });
});

server.listen(port, () => {
  console.log(`Bittersweet dashboard listening on port ${port}`);
});
