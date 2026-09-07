const http = require("http");
const express = require("express");
const { WebSocketServer } = require("ws");

const app = express();
const server = http.createServer(app);
const webSocketServer = new WebSocketServer({ server });
const port = process.env.PORT || 3000;

const showState = {
  sceneIndex: 0,
  hold: false,
  cueStates: {},
  micStates: {},
  lastEvent: null
};

app.use(express.static(__dirname));
app.get("/health", (_request, response) => {
  response.json({ status: "ok", clients: webSocketServer.clients.size });
});

function broadcast(message) {
  const payload = JSON.stringify(message);
  webSocketServer.clients.forEach((client) => {
    if (client.readyState === 1) client.send(payload);
  });
}

webSocketServer.on("connection", (socket) => {
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
    broadcast({ type: "state:update", state: showState, event: showState.lastEvent });
  });
});

server.listen(port, () => {
  console.log(`Bittersweet dashboard listening on port ${port}`);
});
