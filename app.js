const scenes = [
  {
    act: 1, number: 1, title: "The road to Moab", mics: ["Elimelech", "Mahlon", "Chilon", "Naomi"],
    lighting: [{ cue: "LX-05", description: "Apron & extensions" }, { cue: "LX-06", description: "Blackout" }],
    audio: [{ cue: "Audio 01", description: "Please take your seats" }],
    music: [{ item: "Overture", source: "TRACK 01 / 02:34" }],
    set: ["Fruit tree", "Orpah & Year 2 ready behind curtain"],
    screens: [{ type: "ppt", file: "MoabTownThrowdown.pptx" }],
    script: [
      { character: "Elimelech", line: "It’s… it’s my lungs..." },
      { character: "Mahlon", line: "Are we there yet?", cue: true },
      { character: "Naomi", line: "We are nearly there. Keep walking." }
    ]
  },
  {
    act: 1, number: 2, title: "A new beginning", mics: ["Naomi", "Ruth", "Orpah", "Boaz"],
    lighting: [{ cue: "LX-07", description: "Full stage, pink gobo" }, { cue: "LX-08", description: "Warm special — stage right" }],
    audio: [{ cue: "SFX 04", description: "Market ambience" }, { cue: "Audio 02", description: "Transition sting" }],
    music: [{ item: "Fields of Home", source: "TRACK 06 / 03:12" }],
    set: ["Market stall", "Grain baskets", "Boaz's cloak"],
    screens: [{ type: "ppt", file: "BethlehemMarket.pptx" }],
    script: [{ character: "Ruth", line: "Where you go, I will go.", cue: true }, { character: "Naomi", line: "Then let us begin again." }]
  },
  {
    act: 2, number: 1, title: "The threshing floor", mics: ["Ruth", "Boaz", "Naomi", "Narrator"],
    lighting: [{ cue: "LX-14", description: "Moonlight — cool blue" }, { cue: "LX-15", description: "Fade to dawn" }],
    audio: [{ cue: "SFX 09", description: "Night wind" }],
    music: [{ item: "Under the Stars", source: "TRACK 11 / 04:06" }],
    set: ["Threshing floor", "Lanterns preset", "Blanket downstage"],
    screens: [{ type: "video", file: "NightSky.mp4" }],
    script: [{ character: "Boaz", line: "Who is there?", cue: true }, { character: "Ruth", line: "It is Ruth. Your servant." }]
  }
];

const state = {
  sceneIndex: 0, role: "caller", timerSeconds: 872, timerPaused: false, hold: false,
  cueStates: {}, micStates: { Elimelech: true, Mahlon: true, Chilon: false, Naomi: true },
  flashCueId: null, user: null,
  adminData: null,
  checklist: {}, logs: [{ time: "14:31", text: "System ready", type: "SYSTEM" }]
};

const $ = (selector) => document.querySelector(selector);
const currentScene = () => scenes[state.sceneIndex];
const roleNames = { caller: "SHOW CALLER", admin: "ADMIN", lighting: "LIGHTING TECH", audio: "AUDIO TECH", backstage: "BACKSTAGE CREW", screens: "SIDE SCREEN OPERATOR", director: "DIRECTOR" };
let socket = null;

function sendEvent(event) {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event));
}

function applyRemoteState(remoteState) {
  if (!remoteState) return;
  if (Number.isInteger(remoteState.sceneIndex)) state.sceneIndex = remoteState.sceneIndex;
  if (typeof remoteState.hold === "boolean") state.hold = remoteState.hold;
  if (remoteState.cueStates) state.cueStates = { ...remoteState.cueStates };
  if (remoteState.micStates) state.micStates = { ...state.micStates, ...remoteState.micStates };
  render();
}

function applyCueEvent(event) {
  if (!event || typeof event.cueId !== "string") return;
  state.cueStates[event.cueId] = event.type === "cue:go" ? "go" : "standby";
  state.flashCueId = event.type === "cue:go" ? event.cueId : null;
  addLog(event.type === "cue:go" ? "GO" : "STBY", `${event.cueId.toUpperCase()} received`);
  render();
}

function handleRemoteEvent(event) {
  if (!event) return;
  if (event.type === "cue:go") {
    applyCueEvent(event);
    window.setTimeout(() => {
      if (state.flashCueId === event.cueId) {
        state.flashCueId = null;
        render();
      }
    }, 1800);
  } else if (event.type === "scene:select") {
    state.cueStates = {};
    addLog("SYSTEM", "Scene changed by show caller");
  } else if (event.type === "show:hold") {
    addLog("ALERT", event.value ? "SHOW HOLD received" : "Show resumed");
  }
}

function connectSocket() {
  const token = localStorage.getItem("bittersweet-token");
  if (!token || !window.WebSocket || !["http:", "https:"].includes(window.location.protocol)) return;
  socket = new WebSocket(`${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}?token=${encodeURIComponent(token)}`);
  socket.addEventListener("open", () => {
    $("#sync-label").textContent = "Connected to show server";
  });
  socket.addEventListener("close", () => {
    $("#sync-label").textContent = "Offline — local controls only";
  });
  socket.addEventListener("message", (message) => {
    const payload = JSON.parse(message.data);
    if (payload.type === "admin:update" && state.user?.username === "luke") {
      state.adminData = payload.data;
      if (state.role === "admin") render();
    } else if (payload.type === "event") {
      handleRemoteEvent(payload.event);
    } else if (payload.type === "state:init" || payload.type === "state:update") {
      applyRemoteState(payload.state);
    }
  });
}

function renderScenes() {
  $("#scene-list").innerHTML = scenes.map((scene, index) => `
    <button class="scene-button ${index === state.sceneIndex ? "active" : ""}" data-scene="${index}" ${["caller", "admin"].includes(state.user?.role || state.role) ? "" : "disabled"}>
      <span class="scene-number">${scene.act}.${scene.number}</span>
      <span><strong>Scene ${scene.number}</strong><small>${scene.title}</small></span>
    </button>`).join("");
  document.querySelectorAll("[data-scene]").forEach((button) => button.addEventListener("click", () => {
    state.sceneIndex = Number(button.dataset.scene);
    state.cueStates = {};
    sendEvent({ type: "scene:select", sceneIndex: state.sceneIndex });
    state.checklist = {};
    addLog("SYSTEM", `Loaded Act ${currentScene().act}, Scene ${currentScene().number}`);
    render();
  }));
}

function cueRows(items, type, idPrefix = type, interactive = true) {
  return items.map((item, index) => {
    const id = item.cueId || `${idPrefix}-${index}`;
    const stateName = state.cueStates[id] || "standby";
    const name = item.description || item.item || item.file;
    const label = item.cue || item.type?.toUpperCase() || type.toUpperCase();
    const lightingGo = state.role === "lighting" && stateName === "go";
    const controls = interactive
      ? `<button class="${lightingGo ? "go-now-button" : "small-button"}" ${lightingGo ? "disabled" : ""} data-standby="${id}">${lightingGo ? "GO NOW" : "STBY"}</button><button class="go-button" ${state.hold ? "disabled" : ""} data-go="${id}">GO</button>`
      : `<span class="cue-received">${stateName === "go" ? "RECEIVED" : "AWAITING GO"}</span>`;
    return `<div class="cue-row ${state.flashCueId === id ? "cue-row-flash" : ""}">
      <span class="cue-stripe ${type}"></span>
      <div><div class="cue-meta">${label}</div><div class="cue-name">${name}</div></div>
      <div class="cue-actions"><span class="cue-status ${stateName}">${stateName}</span>
      ${controls}</div>
    </div>`;
  }).join("");
}

function callerView(scene) {
  const allCues = [
    ...scene.lighting.map((x, index) => ({ ...x, type: "lighting", cueId: `lighting-${index}` })),
    ...scene.audio.map((x, index) => ({ ...x, type: "audio", cueId: `audio-${index}` })),
    ...scene.music.map((x, index) => ({ ...x, type: "music", cueId: `music-${index}` })),
    ...scene.screens.map((x, index) => ({ ...x, type: "screens", cueId: `screens-${index}` }))
  ];
  return `<div class="panel script-panel"><div class="panel-header"><h2>Script timeline</h2><span class="next-cue">NEXT CUE · ${scene.script.find((line) => line.cue)?.character || "—"}</span></div><div class="script-body">${scene.script.map((line) => `<div class="script-line ${line.cue ? "cue" : ""}"><span class="character">${line.character}${line.cue ? " · CUE LINE" : ""}</span>${line.line}</div>`).join("")}</div></div>
    <div class="panel cue-panel"><div class="panel-header"><h2>Cue control</h2><span class="next-cue">${allCues.length} cues in scene</span></div><div class="panel-body"><div class="cue-list">${allCues.map((cue) => cueRows([cue], cue.type, cue.cueId)).join("")}</div></div></div>
    ${statsPanel(scene)}${emergencyPanel()}`;
}

function statsPanel(scene) {
  return `<div class="panel full-width"><div class="panel-header"><h2>Scene brief</h2><small>Loaded automatically with scene</small></div><div class="panel-body"><div class="stat-grid"><div class="stat"><strong>${scene.mics.length}</strong><span>mics assigned</span></div><div class="stat"><strong>${scene.lighting.length}</strong><span>lighting cues</span></div><div class="stat"><strong>${scene.set.length}</strong><span>set notes</span></div><div class="stat"><strong>${scene.screens.length}</strong><span>screen media</span></div></div></div></div>`;
}

function emergencyPanel() {
  return `<div class="panel emergency-panel full-width"><div class="panel-header"><h2>Emergency controls</h2><small>Visible to caller & director</small></div><div class="panel-body emergency-controls"><button class="emergency-button" data-emergency="hold">${state.hold ? "RESUME SHOW" : "HOLD SHOW"}</button><button class="emergency-button" data-emergency="skip">SKIP CUE</button><button class="emergency-button" data-emergency="freeze">FREEZE SCREENS</button></div></div>`;
}

function specialistView(scene) {
  if (state.role === "lighting") return `<div class="panel"><div class="panel-header"><h2>Lighting cue feed</h2><span class="next-cue">${state.flashCueId ? "GO NOW" : "LISTENING FOR CALLER"}</span></div><div class="panel-body"><div class="crew-notice">Watch this panel for the caller's GO. No local controls are required.</div><div class="cue-list">${cueRows(scene.lighting, "lighting", "lighting", false)}</div></div></div>${statsPanel(scene)}`;
  if (state.role === "audio") return `<div class="panel"><div class="panel-header"><h2>Audio status</h2><span class="next-cue">LISTENING FOR CALLER</span></div><div class="panel-body"><div class="crew-notice">Mic and playback status is informational. The show caller controls cues.</div><div class="mic-grid">${scene.mics.map((mic) => `<div class="mic-card"><div><strong>${mic}</strong><small>Mic ${scene.mics.indexOf(mic) + 1} · ${state.micStates[mic] === false ? "OFF" : "ON"}</small></div><span class="status-pill ${state.micStates[mic] !== false ? "on" : "off"}">${state.micStates[mic] !== false ? "ON" : "OFF"}</span></div>`).join("")}</div></div></div><div class="panel"><div class="panel-header"><h2>Audio & music feed</h2></div><div class="panel-body"><div class="cue-list">${cueRows(scene.audio, "audio", "audio", false)}</div><div style="height:10px"></div><div class="media-card"><div><div class="media-title">${scene.music[0].item}</div><small>${scene.music[0].source}</small></div><span class="status-pill">CALLER CONTROLLED</span></div></div></div>`;
  if (state.role === "backstage") return `<div class="panel"><div class="panel-header"><h2>Set change status</h2><span class="next-cue">WAIT FOR CALLER</span></div><div class="panel-body"><div class="crew-notice">Complete the set change when called, then report readiness to the caller.</div><div class="checklist">${scene.set.map((item, index) => `<div class="check-item ${state.checklist[index] ? "done" : ""}"><span class="check-indicator">${state.checklist[index] ? "✓" : "—"}</span>${item}</div>`).join("")}</div></div></div>${statsPanel(scene)}`;
  if (state.role === "screens") return `<div class="panel"><div class="panel-header"><h2>Screen cue feed</h2><span class="next-cue">LISTENING FOR CALLER</span></div><div class="panel-body"><div class="crew-notice">Media playback is controlled by the show caller.</div><div class="media-card"><div><div class="media-title">${scene.screens[0].file}</div><small>${scene.screens[0].type.toUpperCase()} · Scene ${scene.act}.${scene.number}</small></div><span class="status-pill">CALLER CONTROLLED</span></div><div class="cue-list" style="margin-top:12px">${cueRows(scene.screens, "screens", "screens", false)}</div></div></div><div class="panel"><div class="panel-header"><h2>CYC background</h2></div><div class="panel-body"><div class="stat-grid"><div class="stat"><strong>BLUE</strong><span>current wash</span></div><div class="stat"><strong>3</strong><span>presets ready</span></div></div></div></div>`;
  if (state.role === "admin") return `<div class="panel full-width"><div class="panel-header"><h2>Administrator control room</h2><span class="next-cue">FULL ACCESS</span></div><div class="panel-body"><div class="crew-notice admin-notice">Luke has full system permissions. Use this view to monitor stations and test show controls.</div><div class="stat-grid"><div class="stat"><strong>${scene.lighting.length + scene.audio.length}</strong><span>active cues</span></div><div class="stat"><strong>${scene.mics.length}</strong><span>actors mic'd</span></div><div class="stat"><strong>LIVE</strong><span>show status</span></div><div class="stat"><strong>4</strong><span>stations online</span></div></div><textarea class="notes" placeholder="Add administrator notes..."></textarea></div></div>${callerView(scene)}`;
  return `<div class="panel full-width"><div class="panel-header"><h2>Director overview</h2><span class="next-cue">READ-ONLY SHOW MONITOR</span></div><div class="panel-body"><div class="crew-notice">The show caller controls all cues and emergency actions. This view monitors the live system.</div><div class="stat-grid"><div class="stat"><strong>${scene.lighting.length + scene.audio.length}</strong><span>active cues</span></div><div class="stat"><strong>${scene.mics.length}</strong><span>actors mic'd</span></div><div class="stat"><strong>LIVE</strong><span>show status</span></div><div class="stat"><strong>4</strong><span>stations online</span></div></div><textarea class="notes" placeholder="Add private rehearsal notes..."></textarea></div></div>`;
}

function addLog(type, text) {
  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  state.logs.unshift({ time: now, type, text });
  state.logs = state.logs.slice(0, 5);
}

function bindEvents() {
  document.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => {
    state.cueStates[button.dataset.go] = "go";
    state.flashCueId = button.dataset.go;
    sendEvent({ type: "cue:go", cueId: button.dataset.go });
    addLog("GO", `${button.dataset.go.toUpperCase()} fired`);
    $("#go-state").innerHTML = '<span class="go-dot" style="background:#9ad7ae"></span>GO FIRED';
    $("#sync-label").textContent = "Cue dispatched to all stations";
    render();
    setTimeout(() => { $("#go-state").innerHTML = '<span class="go-dot"></span>STANDBY'; $("#sync-label").textContent = "All stations synced"; }, 1600);
  }));
  document.querySelectorAll("[data-standby]").forEach((button) => button.addEventListener("click", () => { state.cueStates[button.dataset.standby] = "standby"; sendEvent({ type: "cue:standby", cueId: button.dataset.standby }); addLog("STBY", `${button.dataset.standby.toUpperCase()} standing by`); render(); }));
  document.querySelectorAll("[data-mic]").forEach((button) => button.addEventListener("click", () => { state.micStates[button.dataset.mic] = state.micStates[button.dataset.mic] === false; sendEvent({ type: "mic:toggle", actor: button.dataset.mic, value: state.micStates[button.dataset.mic] }); addLog("MIC", `${button.dataset.mic} mic ${state.micStates[button.dataset.mic] ? "on" : "off"}`); render(); }));
  document.querySelectorAll("[data-check]").forEach((input) => input.addEventListener("change", () => { state.checklist[input.dataset.check] = input.checked; render(); }));
  document.querySelectorAll("[data-play]").forEach((button) => button.addEventListener("click", () => { button.textContent = button.textContent === "▶" ? "Ⅱ" : "▶"; addLog("MEDIA", button.textContent === "Ⅱ" ? "Playback started" : "Playback paused"); renderLog(); }));
  document.querySelectorAll("[data-emergency]").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.emergency === "hold") { state.hold = !state.hold; sendEvent({ type: "show:hold", value: state.hold }); addLog("ALERT", state.hold ? "SHOW HOLD activated" : "Show resumed"); }
    else if (button.dataset.emergency === "skip") { addLog("ALERT", "Current cue skipped"); }
    else { addLog("ALERT", "Screens frozen"); }
    render();
  }));
  const ready = $("[data-ready]"); if (ready) ready.addEventListener("click", () => { addLog("READY", "Backstage set marked ready"); renderLog(); ready.textContent = "SET READY ✓"; });
}

function adminView() {
  const data = state.adminData || { uptimeSeconds: 0, clients: 0, users: [], lastEvent: null, recentEvents: [] };
  const uptime = `${Math.floor(data.uptimeSeconds / 3600)}h ${Math.floor((data.uptimeSeconds % 3600) / 60)}m`;
  return `<div class="panel full-width"><div class="panel-header"><h2>Administrator control room</h2><span class="next-cue">LUKE ONLY · FULL ACCESS</span></div><div class="panel-body"><div class="crew-notice admin-notice">Private technical monitor. This view is available only to Luke.</div><div class="stat-grid"><div class="stat"><strong>ONLINE</strong><span>backend status</span></div><div class="stat"><strong>${data.clients}</strong><span>connected clients</span></div><div class="stat"><strong>${data.users.length}</strong><span>logged-in stations</span></div><div class="stat"><strong>${uptime}</strong><span>server uptime</span></div></div></div></div>
    <div class="panel"><div class="panel-header"><h2>Connected stations</h2><small>Live WebSocket registry</small></div><div class="panel-body"><div class="user-list">${data.users.length ? data.users.map((user) => `<div class="user-row"><div><strong>${user.displayName}</strong><small>${user.username} · ${user.role}</small></div><span class="device-label">${user.device}</span></div>`).join("") : '<p class="empty-state">No connected stations.</p>'}</div></div>
    <div class="panel"><div class="panel-header"><h2>Backend diagnostics</h2><small>Live server telemetry</small></div><div class="panel-body"><div class="diagnostic-list"><div><span>WebSocket</span><strong>CONNECTED</strong></div><div><span>State store</span><strong>IN MEMORY</strong></div><div><span>Last event</span><strong>${data.lastEvent ? data.lastEvent.type : "NONE"}</strong></div><div><span>Received</span><strong>${data.lastEvent ? new Date(data.lastEvent.receivedAt).toLocaleTimeString() : "—"}</strong></div></div><div class="admin-log">${data.recentEvents.slice(0, 6).map((event) => `<div><strong>${event.type}</strong><span>${new Date(event.receivedAt).toLocaleTimeString()}</span></div>`).join("") || '<p class="empty-state">No events recorded.</p>'}</div></div></div>`;
}

function renderLog() { $("#cue-log").innerHTML = state.logs.map((log) => `<span class="log-entry"><strong>${log.time}</strong> ${log.type} · ${log.text}</span>`).join(""); }
function render() {
  const scene = currentScene();
  $("#act-label").textContent = `ACT ${scene.act}`;
  $("#scene-heading").textContent = `Scene ${scene.number} · ${scene.title}`;
  $("#page-title").innerHTML = `Scene ${scene.number} <span>·</span> ${scene.title}`;
  $("#role-eyebrow").textContent = `${roleNames[state.role]} VIEW`;
  $("#alert-banner").hidden = !state.hold;
  $("#alert-copy").textContent = state.hold ? "All cue advancement is paused." : "";
  $("#dashboard").innerHTML = state.role === "caller" ? callerView(scene) : state.role === "admin" ? adminView() : specialistView(scene);
  renderScenes(); renderLog(); bindEvents();
}

$("#role-select").addEventListener("change", (event) => { if (!["caller", "admin"].includes(state.user?.role || state.role)) return; state.role = event.target.value; addLog("SYSTEM", `${roleNames[state.role]} view selected`); render(); });
$("#resume-button").addEventListener("click", () => { state.hold = false; sendEvent({ type: "show:hold", value: false }); addLog("ALERT", "Show resumed"); render(); });
$("#timer-button").addEventListener("click", () => { state.timerPaused = !state.timerPaused; $("#timer-button").textContent = state.timerPaused ? "▶" : "Ⅱ"; $("#timer-button").title = state.timerPaused ? "Resume timer" : "Pause timer"; });
$("#sign-out-button").addEventListener("click", () => {
  localStorage.removeItem("bittersweet-token");
  if (socket) socket.close();
  socket = null;
  state.user = null;
  $("#login-form").reset();
  $("#login-error").textContent = "";
  $("#login-screen").hidden = false;
  $(".app-shell").style.visibility = "hidden";
});
setInterval(() => { if (!state.timerPaused) { state.timerSeconds += 1; const h = String(Math.floor(state.timerSeconds / 3600)).padStart(2, "0"); const m = String(Math.floor((state.timerSeconds % 3600) / 60)).padStart(2, "0"); const s = String(state.timerSeconds % 60).padStart(2, "0"); $("#timer").textContent = `${h}:${m}:${s}`; } }, 1000);
render();

async function signIn(event) {
  event.preventDefault();
  const error = $("#login-error");
  error.textContent = "";
  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: $("#username").value.trim(), password: $("#password").value })
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      error.textContent = result.error || "Invalid username or password.";
      return;
    }
    const result = await response.json();
    localStorage.setItem("bittersweet-token", result.token);
    state.user = result.user;
    state.role = result.user.role;
    $("#login-screen").hidden = true;
    $(".app-shell").style.visibility = "visible";
    $("#role-select").value = state.role;
    $("#role-select").disabled = !["caller", "admin"].includes(result.user.role);
    $(".avatar").textContent = result.user.displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
    render();
    connectSocket();
  } catch (requestError) {
    error.textContent = "Unable to reach the show server. Check the Render deployment.";
  }
}

$("#login-form").addEventListener("submit", signIn);
if (window.location.protocol === "file:") {
  $("#login-screen").hidden = true;
} else {
  const token = localStorage.getItem("bittersweet-token");
  if (token) {
    fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Session expired")))
      .then((result) => {
        state.user = result.user;
        state.role = result.user.role;
        $("#login-screen").hidden = true;
        $(".app-shell").style.visibility = "visible";
        $("#role-select").value = state.role;
        $("#role-select").disabled = !["caller", "admin"].includes(result.user.role);
        $(".avatar").textContent = result.user.displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
        render();
        connectSocket();
      })
      .catch(() => {
        localStorage.removeItem("bittersweet-token");
        $("#login-screen").hidden = false;
        $(".app-shell").style.visibility = "hidden";
      });
  } else {
    $("#login-screen").hidden = false;
    $(".app-shell").style.visibility = "hidden";
  }
}
