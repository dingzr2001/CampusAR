const journeys = {
  rider: [
    {
      stage: "Approach the junction",
      view: "MAP VIEW",
      distance: "30 m ahead",
      icon: "↑",
      title: "Continue straight",
      advisory:
        "Open AR as you approach to see the bike lane and crossing markings.",
      advisoryType: "",
      action: "Open AR",
      art: "map",
    },
    {
      stage: "Red signal at the stop line",
      view: "AR VIEW · LIVE",
      distance: "24 s remaining",
      icon: "●",
      title: "Red light ahead",
      advisory: "Check the signal and highlighted stop line.",
      advisoryType: "alert",
      action: "",
      art: "riderWait",
    },
    {
      stage: "Cross with care",
      view: "AR VIEW · LIVE",
      distance: "17 s remaining",
      icon: "↑",
      title: "Continue straight",
      advisory:
        "Caution: turning traffic may cross your path. Check the highlighted conflict zone.",
      advisoryType: "danger",
      action: "Check crossing",
      art: "riderGo",
    },
  ],
  driver: [
    {
      stage: "Find the correct lane",
      view: "AR VIEW · LIVE",
      distance: "40 m ahead",
      icon: "↱",
      title: "Use right-turn lane",
      advisory:
        "Stay in the highlighted lane. The bike lane is immediately to your right.",
      advisoryType: "",
      action: "Check lane",
      art: "driverLane",
    },
    {
      stage: "Red signal at the stop line",
      view: "AR VIEW · LIVE",
      distance: "20 s remaining",
      icon: "●",
      title: "Red light ahead",
      advisory: "Check the signal, stop line, and exit crosswalk.",
      advisoryType: "alert",
      action: "",
      art: "driverRed",
    },
    {
      stage: "Make the right turn",
      view: "AR VIEW · LIVE",
      distance: "Crossing ahead",
      icon: "↱",
      title: "Make right turn",
      advisory:
        "Check the conflict zone for pedestrians and cyclists before completing the turn.",
      advisoryType: "danger",
      action: "Continue driving",
      art: "driverGo",
    },
  ],
};

function createJourneyState(persona) {
  return {
    persona,
    step: 0,
    distance: persona === "driver" ? 40 : 30,
    visualDistance: null,
    stopped: false,
    lane: null,
    remaining: 20,
    hazardRemaining: 12,
    yielded: false,
    redCrossed: false,
    conflictCrossed: false,
    wrongLaneCrossed: false,
    errors: 0,
    summary: false,
    feedback: null,
    sheetExpanded: false,
    sheetAutoOpened: false,
    reportOpen: false,
    reportEntryExpanded: false,
    reportSelected: null,
    reportDraft: "",
    reportSubmitted: false,
  };
}
const state = createJourneyState("rider");
let ticker = null;
let feedbackTimeout = null;
let motionFrame = null;
const $ = (id) => document.getElementById(id);
const setText = (id, value) => {
  $(id).textContent = value;
};
const STOP_WARNING_METERS = { rider: 10, driver: 20 };
const REPORT_STORAGE_KEY = "campus-ar-conflict-reports-v1";
// Each named junction area has a map footprint and one world rectangle. Both AR
// cameras project that same world rectangle, so reports remain at the same place.
const reportRegions = [
  { id: "approach", label: "Near crosswalk", map: [155, 310, 70, 36], world: [-1, 1.5, 5.5, 3.5] },
  { id: "crossing", label: "Bike crossing", map: [130, 175, 120, 125], world: [-3.2, 4, 4.2, 16] },
  { id: "exit", label: "Exit crosswalk", map: [274, 158, 43, 145], world: [11.4, 12, 18.5, 21.8] },
];
function loadReports() {
  try {
    const value = JSON.parse(localStorage.getItem(REPORT_STORAGE_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch (_) {
    return {};
  }
}
let reports = loadReports();
const hasReport = (id) => Boolean(reports[id]?.description);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
function mapRegion(region, report = false) {
  const [x, y, width, height] = region.map;
  const selected = state.reportSelected === region.id;
  if (!report && !hasReport(region.id)) return "";
  const attrs = report ? `class="report-map-region ${selected ? "selected" : ""} ${hasReport(region.id) ? "submitted" : ""}" data-report-region="${region.id}" role="button" tabindex="0" aria-label="${region.label}${hasReport(region.id) ? ", previously reported" : ""}"` : 'class="reported-map-region"';
  return `<g ${attrs}><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" rx="6"/><text x="${(x + width / 2).toFixed(1)}" y="${(y + height / 2 + 4).toFixed(1)}" text-anchor="middle">${region.label}</text>${report ? `<rect class="report-hit" x="${x - 10}" y="${y - 10}" width="${width + 20}" height="${height + 20}"/>` : ""}</g>`;
}
function reportedRiderRegions(quad) {
  return reportRegions.filter((region) => hasReport(region.id) && !(region.id === "crossing" && state.step === 2 && state.hazardRemaining > 0)).map((region) => {
    const [x1, z1, x2, z2] = region.world;
    return quad(x1, x2, z1, z2, "#ffcf43", 'class="reported-ar-region" stroke="#ffe78e" stroke-width="2" opacity=".42"');
  }).join("");
}
function reportedDriverRegions(rect) {
  return reportRegions.filter((region) => hasReport(region.id) && !(region.id === "exit" && state.step === 2 && state.hazardRemaining > 0)).map((region) => {
    const [x1, z1, x2, z2] = region.world;
    return rect(x1, z1, x2, z2, "#ffcf43", 'class="reported-ar-region" stroke="#ffe78e" stroke-width="2" opacity=".42"');
  }).join("");
}
function reportedNotice() {
  if (state.distance > (state.persona === "driver" ? -10 : -4) || state.distance < -25 || nearStopLine() || (state.step === 2 && state.hazardRemaining > 0)) return "";
  const relevant = reportRegions.find((region) => {
    if (!hasReport(region.id)) return false;
    if (state.persona === "rider" && state.step === 0) return true;
    const [x1, z1, x2, z2] = region.world;
    const centerX = (x1 + x2) / 2, centerZ = (z1 + z2) / 2;
    if (state.persona === "driver") {
      const local = driverLocal(centerX, centerZ);
      if (local.depth < 0) return false;
      const [x, y] = driverPoint(local);
      return x >= 0 && x <= 520 && y >= 80 && y <= 350;
    }
    const [x, y] = riderProject(centerX, centerZ);
    return x >= 0 && x <= 360 && y >= 80 && y <= 430;
  });
  return relevant ? `<span class="reported-notice">Reported conflict area<small>Steady yellow zone · ${escapeHtml(relevant.label)}</small></span>` : "";
}
const nearStopLine = () =>
  state.step < 2 && state.distance <= STOP_WARNING_METERS[state.persona];
const CONFLICT_DISTANCE = {
  rider: { warning: -4, end: -21, crossed: -10 },
  driver: { warning: -12, end: -30, crossed: -20 },
};
const nearConflict = () =>
  state.step === 2 &&
  state.hazardRemaining > 0 &&
  state.distance <= CONFLICT_DISTANCE[state.persona].warning &&
  state.distance >= CONFLICT_DISTANCE[state.persona].end;
const approachLaneFocus = () => state.distance <= 30 && state.distance >= 0;
function riskMessage() {
  if (nearStopLine())
    return state.distance < 0
      ? "Red light: you have crossed the stop line. Check traffic and the signal now."
      : `Red light · ${state.distance} m to the stop line. Slow down and check the signal.`;
  if (nearConflict())
    return state.distance < 0
      ? "Conflict zone occupied: check crossing traffic around you."
      : "Conflict zone ahead: check for turning traffic and people crossing.";
  return "";
}

const defs = `<defs><pattern id="grass" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#e7ebf0"/><circle cx="6" cy="8" r="2" fill="#cbd3db"/><circle cx="18" cy="19" r="2" fill="#cbd3db"/></pattern><pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="#ed435783"/><path d="M0 0V9" stroke="#d92842" stroke-width="3"/></pattern><filter id="shadow"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#101318" flood-opacity=".23"/></filter></defs>`;
const bike = (x, y, scale = 1) =>
  `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="#151a23" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="-18" cy="8" r="10" fill="#f7f9fc"/><circle cx="18" cy="8" r="10" fill="#f7f9fc"/><path d="M-18 8L-5-11L7 8H-18M7 8L18 8L7-9H-3M-5-11H-12M7-9H15"/></g>`;
function mapArt(report = false) {
  const markerY = 396 - (30 - state.distance) * 1.5;
  const laneFocus = approachLaneFocus();
  const crossingTop = Array.from(
    { length: 6 },
    (_, i) =>
      `<rect x="${94 + i * 30}" y="122" width="17" height="20" rx="1"/>`,
  ).join("");
  const crossingNear = Array.from(
    { length: 6 },
    (_, i) =>
      `<rect x="${94 + i * 30}" y="318" width="17" height="20" rx="1"/>`,
  ).join("");
  const crossingLeft = Array.from(
    { length: 5 },
    (_, i) =>
      `<rect x="64" y="${154 + i * 30}" width="20" height="17" rx="1"/>`,
  ).join("");
  const crossingRight = Array.from(
    { length: 5 },
    (_, i) =>
      `<rect x="276" y="${154 + i * 30}" width="20" height="17" rx="1"/>`,
  ).join("");
  return `<svg viewBox="-25 -10 410 500" preserveAspectRatio="xMidYMid meet" aria-label="Top down junction map showing the bike lane on the near right, crossing diagonally to the far left">${defs}
    <rect x="-25" y="-10" width="410" height="500" fill="url(#grass)"/>
    <path d="M-25 150H385V310H-25Z M90 -10H270V490H90Z" fill="#717b88"/>
    <path d="M-25 146H385M-25 314H385M86 -10V490M274 -10V490" stroke="#f8fafc" stroke-width="5"/>
    <path d="M199.5 -10V122M205.5 -10V122M154.5 338V490M160.5 338V490M-25 227H64M-25 233H64M296 227H385M296 233H385" stroke="#f4d77a" stroke-width="2.5" opacity=".95"/>
    <path d="M168.75 -10V70M236.25 -10V122M123.75 338V490M191.25 400V490M-25 190H64M-25 270H10M350 190H385M296 270H385" stroke="#e6ebf1" stroke-width="2" stroke-dasharray="11 12" opacity=".8"/>
    <path d="M168.75 70V122M191.25 338V400M10 270H64M296 190H350" stroke="#f8fafc" stroke-width="2.5"/>
    <g fill="#f7f9fc">${crossingTop}${crossingNear}${crossingLeft}${crossingRight}</g>
    <path d="M225 490V310H270V490Z M90 150V-10H135V150Z" fill="#438beb45"/>
    <path d="M225 490V310M270 490V310M90 150V-10M135 150V-10" stroke="#3d86e9" stroke-width="${laneFocus ? 5 : 3}" opacity=".95"/>
    <path d="M247.5 490V310M112.5 150V-10" stroke="#bedaff" stroke-width="2" stroke-dasharray="9 8"/>
    ${laneFocus ? '<path d="M225 490V310M270 490V310M90 150V-10M135 150V-10" stroke="#a6ddff" stroke-width="2" opacity=".95"/>' : ""}
    <path d="M225 310L90 150M270 310L135 150" fill="none" stroke="#6aa7f1" stroke-width="3" stroke-dasharray="10 8"/>
    <path d="M258.75 478V310M258.75 310L123.75 150M123.75 150V58" fill="none" stroke="#397fe6" stroke-width="11" stroke-linecap="round" stroke-dasharray="15 11"/>
    <path d="M123.75 50l-14 22h28z" fill="#397fe6" stroke="#1c3f72" stroke-width="2"/>
    <path d="M90 112H112.5M135 112H202.5M157.5 350H225M247.5 350H270M54 234V310M306 150V226" fill="none" stroke="#fff" stroke-width="5"/>
    ${reportRegions.map((region) => mapRegion(region, report)).join("")}
    ${report && state.persona === "driver" ? '<path d="M180 460V350Q180 230 300 230H355" fill="none" stroke="#65b9ff" stroke-width="10" stroke-dasharray="17 11" opacity=".9"/>' : ""}
    ${nearStopLine() ? '<path d="M247.5 350H270" stroke="#f44560" stroke-width="8" filter="url(#shadow)"/><path d="M247.5 350H270" stroke="#fff" stroke-width="3"/>' : ""}
    ${report ? "" : `<circle cx="258.75" cy="${markerY}" r="24" fill="#ffffff" filter="url(#shadow)"/><circle cx="258.75" cy="${markerY}" r="15" fill="#397fe6"/>${bike(258.75, markerY - 3, 0.44)}`}
    <circle cx="299" cy="339" r="25" fill="#ffffff" filter="url(#shadow)"/>
    <path d="M299 326v13l8 8" fill="none" stroke="#3e5e83" stroke-width="3" stroke-linecap="round"/></svg>`;
}

// Project a lane-level world into the rider's camera. World z=0 is the near stop
// line; the crossing ends at z=22. The camera follows the bike route across it.
function riderCamera() {
  const travelled = -(state.visualDistance ?? state.distance);
  const t = Math.max(0, Math.min(1, travelled / 22));
  const eased = t * t * (3 - 2 * t);
  return { z: travelled - 5, x: 4.8125 - 8.25 * eased };
}
function riderProject(x, z) {
  const camera = riderCamera(),
    depth = Math.max(0, z - camera.z);
  return [180 + ((x - camera.x) * 175) / (depth + 4), 72 + 1250 / (depth + 4)];
}
function riderSceneArt(green = false) {
  const camera = riderCamera(),
    near = camera.z,
    far = camera.z + 100;
  const laneWidth = approachLaneFocus() ? 0.28 : 0.13;
  const point = (x, z) =>
    riderProject(x, z)
      .map((v) => v.toFixed(1))
      .join(",");
  const quad = (left, right, start, end, fill, extra = "") => {
    const a = Math.max(start, near),
      b = Math.min(end, far);
    return b <= a
      ? ""
      : `<polygon points="${point(left, a)} ${point(right, a)} ${point(right, b)} ${point(left, b)}" fill="${fill}" ${extra}/>`;
  };
  const band = (left, right, z, fill, extra = "") =>
    quad(left, right, z, z + 0.22, fill, extra);
  const stripe = (x, start, end, width, fill) =>
    quad(x - width / 2, x + width / 2, start, end, fill);
  let markings = "";
  for (let z = Math.floor(near / 8) * 8; z < far; z += 8) {
    if (z < -15) for (const x of [-3.4375, 0.6875]) markings += stripe(x, z, z + 3, 0.11, "#ecf6ff");
    if (z > 37) markings += stripe(-0.6875, z, z + 3, 0.11, "#ecf6ff");
    if (z > 22) markings += stripe(3.4375, z, z + 3, 0.11, "#ecf6ff");
  }
  markings += stripe(0.6875, -15, 0, 0.16, "#f8fafc");
  markings += stripe(-0.6875, 22, 37, 0.16, "#f8fafc");
  for (const x of [-1.47, -1.28]) markings += stripe(x, -100, 0, 0.08, "#f4d77a");
  for (const x of [1.28, 1.47]) markings += stripe(x, 22, 120, 0.08, "#f4d77a");
  for (const z of [10.82, 11.18]) {
    markings += band(-100, -5.5, z, "#f4d77a");
    markings += band(5.5, 100, z, "#f4d77a");
  }
  for (let x = -100; x < 100; x += 8) {
    if (x < -20) markings += band(x, Math.min(x + 3, -20), 16.5, "#eef3f8");
    if (x > 20) markings += band(x, x + 3, 5.5, "#eef3f8");
    if (x < -5.5) markings += band(x, Math.min(x + 3, -5.5), 5.5, "#eef3f8");
    if (x > 5.5) markings += band(x, x + 3, 16.5, "#eef3f8");
  }
  markings += band(-20, -5.5, 16.5, "#f8fafc");
  markings += band(5.5, 20, 5.5, "#f8fafc");
  let crosswalk = "";
  for (let x = -7; x < 8; x += 1.7) {
    crosswalk += quad(x, x + 1.05, 1.5, 2.4, "#f9fbff");
    crosswalk += quad(x, x + 1.05, 22.8, 23.8, "#f9fbff");
  }
  const routeX = (z) => (z <= 0 ? 4.8125 : z >= 22 ? -3.4375 : 4.8125 - 8.25 * (z / 22));
  const routeStart = Math.max(near, -40);
  const routePoints = [];
  for (let z = routeStart; z <= Math.min(far, 90); z += 1.5)
    routePoints.push(point(routeX(z), z));
  let crossingFill = "";
  const crossingLeft = [],
    crossingRight = [];
  for (let z = Math.max(near, 0); z <= 22; z += 2) {
    const next = Math.min(22, z + 2);
    crossingFill += `<polygon points="${point(routeX(z) - 1.05, z)} ${point(routeX(z) + 1.05, z)} ${point(routeX(next) + 1.05, next)} ${point(routeX(next) - 1.05, next)}" fill="#4b9ff0" opacity=".22"/>`;
    crossingLeft.push(point(routeX(z) - 1.05, z));
    crossingRight.push(point(routeX(z) + 1.05, z));
    if (next === 22) {
      crossingLeft.push(point(routeX(22) - 1.05, 22));
      crossingRight.push(point(routeX(22) + 1.05, 22));
    }
  }
  const crossingEdges = `<polyline points="${crossingLeft.join(" ")}" fill="none" stroke="#75c8ff" stroke-width="3.5"/><polyline points="${crossingRight.join(" ")}" fill="none" stroke="#75c8ff" stroke-width="3.5"/>`;
  const route = `<polyline points="${routePoints.join(" ")}" fill="none" stroke="#338bf7" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="8 6" opacity=".95"/>`;
  const stop =
    near < 0.8
      ? `${band(-1.375, 2.75, 0, "#fff")}${quad(4.125, 5.65, -0.25, 0.9, nearStopLine() ? "#ff3854" : "#3d9bff", 'opacity=".75" filter="url(#lane-glow)"')}${quad(4.125, 5.55, -0.12, 0.52, nearStopLine() ? "#ff5872" : "#6ebaff", 'opacity=".9"')}${quad(4.125, 5.5, 0, 0.4, "#fff", `stroke="${nearStopLine() ? "#e92746" : "#1687ed"}" stroke-width="${nearStopLine() ? 2.6 : 1.6}"`)}`
      : "";
  const oppositeStop = near < 25 ? `${band(-5.5, -4.125, 25, "#fff")}${band(-2.75, 1.375, 25, "#fff")}` : "";
  const conflict =
    green && state.hazardRemaining > 0
      ? quad(
          -3.2,
          4.2,
          4,
          16,
          "url(#hatch)",
          'data-conflict="true" stroke="#e44357" stroke-width="2.5"',
        )
      : "";
  const [carFromX, carY] = riderProject(-9, 9);
  const [carToX] = riderProject(10, 9);
  const crossingCar =
    green && state.hazardRemaining > 0
      ? `<g class="traffic-car" style="--car-from-x:${carFromX}px;--car-to-x:${carToX}px;--car-y:${carY}px;animation-delay:-${12 - state.hazardRemaining}s" filter="url(#shadow)"><rect x="-17" y="-9" width="34" height="17" rx="5" fill="#1c2635" stroke="#fff" stroke-width="2.5"/><circle cx="-10" cy="9" r="3" fill="#fff" stroke="#1c2635" stroke-width="1.5"/><circle cx="10" cy="9" r="3" fill="#fff" stroke="#1c2635" stroke-width="1.5"/></g>`
      : "";
  const signalLight = green ? "#59ad69" : "#eb3c53";
  const signalHud = `<g filter="url(#shadow)"><rect x="303" y="78" width="7" height="79" rx="3" fill="#65707d"/><rect x="289" y="82" width="34" height="62" rx="9" fill="#171c25" stroke="#fff" stroke-width="3"/>${nearStopLine() && !green ? '<circle cx="306" cy="98" r="14" fill="#f43e59" opacity=".42"/>' : ""}<circle cx="306" cy="98" r="${nearStopLine() && !green ? 9 : 7}" fill="${green ? "#4b5563" : signalLight}"/><circle cx="306" cy="117" r="7" fill="${green ? signalLight : "#4b5563"}"/></g>${!green ? `<g class="signal-countdown" role="img" aria-label="${state.remaining} seconds remaining"><rect x="284" y="159" width="44" height="29" rx="10" fill="#fff" stroke="#d5deeb" stroke-width="2"/><text x="306" y="180" text-anchor="middle" font-size="18" font-weight="800" fill="#1c2634">${state.remaining}</text></g>` : ""}`;
  return `<svg viewBox="0 0 360 430" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Bike-lane camera moving across the highlighted junction markings"><defs><pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="#ffe1e6" opacity=".55"/><path d="M0 0V9" stroke="#e44357" stroke-width="3" opacity=".8"/></pattern><filter id="lane-glow" x="-60%" y="-100%" width="220%" height="300%"><feGaussianBlur stdDeviation="5"/></filter><filter id="shadow"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#111318" flood-opacity=".3"/></filter></defs>
    <rect width="360" height="430" fill="#dce3eb"/>
    ${quad(-7.4, 7.4, near, far, "#c8d0da")}
    ${quad(-5.5, 5.5, -100, 0, "#626f7e")}
    ${quad(-100, 100, 0, 22, "#737f8d")}
    ${quad(-5.5, 5.5, 22, 120, "#626f7e")}
    ${quad(2.75, 5.5, -100, 0, "#3f617e")}
    ${quad(-5.5, -2.75, 22, 120, "#3f617e")}
    ${markings}${crosswalk}
    ${stripe(2.75, -100, 0, laneWidth, "#9bdbff")}${stripe(4.125, -100, 0, 0.1, "#bedaff")}${stripe(5.5, -100, 0, laneWidth, "#9bdbff")}
    ${stripe(-5.5, 22, 120, 0.13, "#77c6ff")}${stripe(-4.125, 22, 120, 0.1, "#bedaff")}${stripe(-2.75, 22, 120, 0.13, "#77c6ff")}
    ${crossingFill}${crossingEdges}${route}${reportedRiderRegions(quad)}${conflict}${crossingCar}${oppositeStop}${stop}${signalHud}
    <path d="M180 391l-11 18h22z" fill="#2783f2" stroke="#fff" stroke-width="2" filter="url(#shadow)"/>
  </svg>`;
}
function riderWaitArt() {
  return riderSceneArt(false);
}
function riderGoArt() {
  return riderSceneArt(true);
}
const DRIVER_TURN_RADIUS = 16.5;
const DRIVER_TURN_LENGTH = (Math.PI * DRIVER_TURN_RADIUS) / 2;
function driverPath(progress) {
  if (progress <= 0) return { x: 2.8125, z: progress, heading: 0 };
  if (progress < DRIVER_TURN_LENGTH) {
    const heading = progress / DRIVER_TURN_RADIUS;
    return {
      x: 19.3125 - 16.5 * Math.cos(heading),
      z: 16.5 * Math.sin(heading),
      heading,
    };
  }
  return {
    x: 19.3125 + progress - DRIVER_TURN_LENGTH,
    z: 16.5,
    heading: Math.PI / 2,
  };
}
function driverCamera() {
  const progress = -(state.visualDistance ?? state.distance);
  const position = driverPath(progress - 5);
  return { ...position, heading: driverPath(progress).heading };
}
function driverLocal(x, z, camera = driverCamera()) {
  const dx = x - camera.x,
    dz = z - camera.z;
  return {
    side: dx * Math.cos(camera.heading) - dz * Math.sin(camera.heading),
    depth: dx * Math.sin(camera.heading) + dz * Math.cos(camera.heading),
  };
}
function driverPoint(local) {
  const depth = Math.max(0.01, local.depth);
  return [260 + (local.side * 175) / (depth + 4), 52 + 1000 / (depth + 4)];
}
function driverPolygon(world, fill, extra = "", camera = driverCamera()) {
  let points = world.map(([x, z]) => driverLocal(x, z, camera));
  const clipped = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      aIn = a.depth >= 0,
      bIn = b.depth >= 0;
    if (aIn) clipped.push(a);
    if (aIn !== bIn) {
      const t = (0 - a.depth) / (b.depth - a.depth);
      clipped.push({ side: a.side + (b.side - a.side) * t, depth: 0 });
    }
  }
  if (clipped.length < 3) return "";
  return `<polygon points="${clipped
    .map((p) =>
      driverPoint(p)
        .map((v) => v.toFixed(1))
        .join(","),
    )
    .join(" ")}" fill="${fill}" ${extra}/>`;
}
function driverSceneArt() {
  const camera = driverCamera(),
    green = state.step === 2;
  const laneWidth = approachLaneFocus() ? 0.28 : 0.15;
  const rect = (x1, z1, x2, z2, fill, extra = "") =>
    driverPolygon(
      [
        [x1, z1],
        [x2, z1],
        [x2, z2],
        [x1, z2],
      ],
      fill,
      extra,
      camera,
    );
  const routePoint = (progress, offset = 0) => {
    const p = driverPath(progress);
    return [
      p.x + Math.cos(p.heading) * offset,
      p.z - Math.sin(p.heading) * offset,
    ];
  };
  const begin = -(state.visualDistance ?? state.distance) - 2;
  const routeA = [],
    routeB = [],
    routeMiddle = [];
  let ribbon = "";
  for (let progress = begin; progress < 110; progress += 1.5) {
    const next = Math.min(110, progress + 1.5);
    const corners = [
      routePoint(progress, -1.65),
      routePoint(progress, 1.65),
      routePoint(next, 1.65),
      routePoint(next, -1.65),
    ];
    ribbon += driverPolygon(corners, "#3b95f1", 'opacity=".26"', camera);
    for (const [offset, list] of [
      [-1.65, routeA],
      [1.65, routeB],
      [0, routeMiddle],
    ]) {
      const [x, z] = routePoint(progress, offset),
        local = driverLocal(x, z, camera);
      if (local.depth >= 0)
        list.push(
          driverPoint(local)
            .map((v) => v.toFixed(1))
            .join(","),
        );
    }
  }
  const routeLines = `<polyline points="${routeA.join(" ")}" fill="none" stroke="#77c8ff" stroke-width="3.5"/><polyline points="${routeB.join(" ")}" fill="none" stroke="#77c8ff" stroke-width="3.5"/><polyline points="${routeMiddle.join(" ")}" fill="none" stroke="#328cf1" stroke-width="2.5" stroke-dasharray="8 6"/>`;
  let roadMarks = "", crosswalk = "";
  for (let z = Math.floor(camera.z / 8) * 8; z < 120; z += 8) {
    if (z < -15) for (const x of [-5.625, 1.125]) roadMarks += rect(x - 0.05, z, x + 0.05, z + 3, "#eef3f8");
    if (z > 37) roadMarks += rect(-1.175, z, -1.075, z + 3, "#eef3f8");
    if (z > 22) roadMarks += rect(5.575, z, 5.675, z + 3, "#eef3f8");
  }
  roadMarks += rect(1.045, -15, 1.205, 0, "#f8fafc");
  roadMarks += rect(-1.205, 22, -1.045, 37, "#f8fafc");
  for (const x of [-2.34, -2.16]) roadMarks += rect(x - 0.04, -110, x + 0.04, 0, "#f4d77a");
  for (const x of [2.16, 2.34]) roadMarks += rect(x - 0.04, 22, x + 0.04, 130, "#f4d77a");
  for (const z of [10.82, 11.18]) {
    roadMarks += rect(-100, z, -9, z + 0.12, "#f4d77a");
    roadMarks += rect(9, z, 170, z + 0.12, "#f4d77a");
  }
  for (let x = -100; x < 170; x += 8) {
    if (x < -20) roadMarks += rect(x, 16.5, Math.min(x + 3, -20), 16.62, "#eef3f8");
    if (x > 20) roadMarks += rect(x, 5.5, x + 3, 5.62, "#eef3f8");
    if (x < -9) roadMarks += rect(x, 5.5, Math.min(x + 3, -9), 5.62, "#eef3f8");
    if (x > 9) roadMarks += rect(x, 16.5, x + 3, 16.62, "#eef3f8");
  }
  roadMarks += rect(-20, 16.5, -9, 16.62, "#f8fafc");
  roadMarks += rect(9, 5.5, 20, 5.62, "#f8fafc");
  for (let x = -9; x < 10; x += 1.65) {
    crosswalk += rect(x, 1.5, x + 1, 2.4, "#f9fcff");
    crosswalk += rect(x, 23, x + 1, 23.9, "#f9fcff");
  }
  for (let z = 0; z < 22; z += 1.7)
    crosswalk += rect(12.5, z, 14, z + 1, "#f9fcff");
  const stop =
    rect(
      -2.35,
      -0.25,
      4.5,
      0.9,
      nearStopLine() ? "#ff3854" : "#378ff1",
      'opacity=".7" filter="url(#driver-glow)"',
    ) +
    rect(
      -2.25,
      0,
      4.5,
      0.55,
      "#fff",
      `stroke="${nearStopLine() ? "#e92746" : "#1784e7"}" stroke-width="${nearStopLine() ? 2.6 : 1.6}"`,
    );
  const conflict =
    green && state.hazardRemaining > 0
      ? rect(
          11.4,
          12,
          18.5,
          21.8,
          "url(#driver-hatch)",
          'data-conflict="true" stroke="#e44357" stroke-width="2"',
        )
      : "";
  const signal = `<g filter="url(#driver-shadow)"><rect x="473" y="46" width="7" height="91" rx="3" fill="#5b6571"/><rect x="457" y="49" width="36" height="68" rx="9" fill="#171c25" stroke="#fff" stroke-width="3"/>${nearStopLine() && !green ? '<circle cx="475" cy="67" r="14" fill="#f43e59" opacity=".45"/>' : ""}<circle cx="475" cy="67" r="${nearStopLine() && !green ? 9 : 7}" fill="${green ? "#48515b" : "#e93950"}"/><circle cx="475" cy="90" r="7" fill="${green ? "#56b36b" : "#48515b"}"/></g>${!green ? `<g class="signal-countdown" role="img" aria-label="${state.remaining} seconds remaining"><rect x="452" y="140" width="46" height="27" rx="9" fill="#fff" stroke="#d5deeb" stroke-width="2"/><text x="475" y="160" text-anchor="middle" font-size="17" font-weight="800" fill="#1c2634">${state.remaining}</text></g>` : ""}`;
  return `<svg viewBox="0 0 520 350" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Car lane camera following the highlighted right turn and exit lane"><defs><filter id="driver-glow" x="-60%" y="-100%" width="220%" height="300%"><feGaussianBlur stdDeviation="5"/></filter><filter id="driver-shadow"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#111318" flood-opacity=".3"/></filter><pattern id="driver-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="#ffe2e7" opacity=".55"/><path d="M0 0V9" stroke="#e44357" stroke-width="3" opacity=".8"/></pattern></defs>
    <rect width="520" height="350" fill="#dce3eb"/>
    ${rect(-100, -110, 170, 150, "#c8d0da")}
    ${rect(-9, -110, 9, 0, "#64717f")}
    ${rect(-100, 0, 170, 22, "#737f8d")}
    ${rect(-9, 22, 9, 130, "#64717f")}
    ${rect(4.5, -110, 9, 0, "#3e607e")}
    ${rect(1.125, -110, 4.5, 0, "#3d78b5", 'opacity=".23"')}
    ${rect(10, 11, 170, 22, "#3d78b5", 'opacity=".2"')}
    ${roadMarks}${crosswalk}
    ${rect(4.5 - laneWidth / 2, -110, 4.5 + laneWidth / 2, 0, "#9bdbff")}${rect(6.75 - laneWidth / 2, -110, 6.75 + laneWidth / 2, 0, "#bedaff")}${rect(9 - laneWidth / 2, -110, 9 + laneWidth / 2, 0, "#9bdbff")}
    ${rect(10, 11, 170, 11.15, "#75c6ff")}${rect(10, 21.85, 170, 22, "#75c6ff")}
    ${ribbon}${routeLines}${reportedDriverRegions(rect)}${conflict}${stop}${signal}
    <path d="M260 315l-12 19h24z" fill="#2783f2" stroke="#fff" stroke-width="2"/>
  </svg>`;
}
const art = {
  map: mapArt,
  riderWait: riderWaitArt,
  riderGo: riderGoArt,
  driverLane: driverSceneArt,
  driverRed: driverSceneArt,
  driverGo: driverSceneArt,
};

function showFeedback(message, type = "info") {
  state.feedback = { message, type };
  renderFeedback();
  clearTimeout(feedbackTimeout);
  feedbackTimeout = setTimeout(() => {
    state.feedback = null;
    renderFeedback();
  }, 3800);
}
function renderFeedback() {
  const toast = $("feedback-toast");
  toast.hidden = !state.feedback;
  if (state.feedback) {
    toast.className = `feedback-toast ${state.feedback.type}`;
    toast.textContent = state.feedback.message;
  }
}
function clearTicker() {
  if (ticker) {
    clearInterval(ticker);
    ticker = null;
  }
}
function clearMotion() {
  if (motionFrame) {
    cancelAnimationFrame(motionFrame);
    motionFrame = null;
  }
  state.visualDistance = null;
}
function riskMarker(kind, x, y, width, height) {
  if (y < 55 || y > height - 8) return "";
  const left = Math.max(6, Math.min(94, (x / width) * 100)),
    top = Math.max(15, Math.min(81, (y / height) * 100 - 9));
  return `<span class="risk-marker ${kind}" style="left:${left}%;top:${top}%" aria-hidden="true">!</span>`;
}
function driverRiskMarker(kind, x, z, offsetX = 0, offsetY = 0) {
  const local = driverLocal(x, z);
  if (local.depth < 0) return "";
  const [screenX, screenY] = driverPoint(local);
  return riskMarker(kind, screenX + offsetX, screenY + offsetY, 520, 350);
}
function riderMapOverlays() {
  return (
    `<button type="button" class="overlay left" data-hint="0" style="top:55%">Motor lane</button><button type="button" class="overlay lane-label right" data-hint="1" style="top:70%">Current bike lane</button><button type="button" class="overlay lane-label left" data-hint="2" style="top:27%">Far-side bike lane</button>` +
    (nearStopLine() ? riskMarker("stop", 222, 284, 360, 430) : "")
  );
}
function riderOverlays() {
  const stopY = riderProject(4.8125, 0)[1];
  const stopVisible = state.distance >= 0 && stopY > 95 && stopY < 425;
  const stopTop = Math.max(12, Math.min(78, (stopY / 430) * 100 - 9));
  const laneBeyond = state.distance <= -22;
  const onCrossing = state.distance < 0 && !laneBeyond;
  const laneDepth = riderCamera().z + 1.7;
  const laneX = laneDepth <= 0 ? 4.125 : laneDepth >= 22 ? -4.125 : 4.8125 - 8.25 * (laneDepth / 22);
  const laneLeft = Math.max(22, Math.min(78, (riderProject(laneX, laneDepth)[0] / 360) * 100));
  const laneText = onCrossing ? "Bike crossing" : "Bike lane";
  return (
    (state.step === 1 && stopVisible
      ? `<button type="button" class="overlay marking-label ${nearStopLine() ? "stop-urgent" : ""}" data-hint="1" style="top:${stopTop}%;left:50%">Stop line</button>`
      : "") +
    (nearConflict()
      ? `<button type="button" class="overlay danger left" data-hint="1" style="top:55%">Conflict zone<small>Yield to turning traffic</small></button>`
      : "") +
    (nearStopLine()
      ? riskMarker("stop", riderProject(4.8125, 0)[0] + 65, riderProject(4.8125, 0)[1] - 10, 360, 430)
      : "") +
    (nearConflict()
      ? riskMarker("conflict", ...riderProject(2.7, 12), 360, 430)
      : "") +
    (state.distance >= 0
      ? `<button type="button" class="overlay left" data-hint="3" style="top:68%">Motor lane</button>`
      : "") +
    `<button type="button" class="overlay lane-label center" data-hint="2" style="top:68%;left:${laneLeft.toFixed(1)}%">${laneText}</button>`
  );
}
function driverOverlays() {
  if (state.step === 0)
    return (
      `<button type="button" class="overlay left" data-hint="0" style="top:65%">Through lane</button><button type="button" class="overlay lane-label center" data-hint="1" style="top:64%;left:50%">Right-turn lane</button><button type="button" class="overlay right" data-hint="2" style="top:73%">Bike lane</button>` +
      (nearStopLine() ? driverRiskMarker("stop", 2.2, 0, 80, -10) : "")
    );
  if (state.step === 1) {
    const y = driverPoint(driverLocal(2.2, 0))[1];
    const top = Math.max(29, Math.min(77, (y / 350) * 100 - 9));
    return (
      (state.distance >= 0
        ? `<button type="button" class="overlay marking-label ${nearStopLine() ? "stop-urgent" : ""}" data-hint="1" style="top:${top}%;left:50%">Stop line</button>`
        : "") +
      (nearStopLine() ? driverRiskMarker("stop", 2.2, 0, 80, -10) : "") +
      `<button type="button" class="overlay right" data-hint="2" style="top:69%">Exit crosswalk</button>`
    );
  }
  return (
    (nearConflict()
      ? `<button type="button" class="overlay danger right" data-hint="1" style="top:52%">Conflict zone<small>Yield at crosswalk</small></button>`
      : "") +
    (nearConflict() ? driverRiskMarker("conflict", 14.5, 16) : "") +
    `<button type="button" class="overlay lane-label center" data-hint="2" style="top:69%;left:50%">${state.distance <= -20 ? "Exit lane" : "Right-turn path"}</button>`
  );
}
function animateCamera(from, to) {
  clearMotion();
  state.visualDistance = from;
  const started = performance.now(),
    duration = 680;
  const frame = (now) => {
    const t = Math.min(1, (now - started) / duration),
      ease = t * t * (3 - 2 * t);
    state.visualDistance = from + (to - from) * ease;
    if (state.step > 0 || state.persona === "driver") {
      $("scene-art").innerHTML = art[journeys[state.persona][state.step].art]();
      $("scene-overlays").innerHTML =
        (state.persona === "driver" ? driverOverlays() : riderOverlays()) + reportedNotice();
    }
    if (t < 1) motionFrame = requestAnimationFrame(frame);
    else {
      motionFrame = null;
      state.visualDistance = null;
      render();
    }
  };
  motionFrame = requestAnimationFrame(frame);
}
function resetJourney(persona = state.persona) {
  clearTicker();
  clearMotion();
  clearTimeout(feedbackTimeout);
  Object.assign(state, createJourneyState(persona));
  $("mode-menu").hidden = true;
  $("mode-button").setAttribute("aria-expanded", "false");
  render();
}
function enterStep(step) {
  clearTicker();
  clearMotion();
  clearTimeout(feedbackTimeout);
  state.feedback = null;
  state.step = step;
  state.summary = false;
  if (step === 1) {
    state.remaining = 20;
  }
  if (step === 2) {
    state.hazardRemaining = 12;
    state.yielded = false;
  }
  render();
  if (step === 2 && state.distance <= -50) {
    state.summary = true;
    render();
    return;
  }
  if (step === 1 || step === 2)
    ticker = setInterval(() => {
      if (state.step === 1) {
        state.remaining--;
        if (state.remaining <= 0) {
          enterStep(2);
          return;
        }
        render();
      } else if (state.step === 2) {
        state.hazardRemaining = Math.max(0, state.hazardRemaining - 1);
        if (!state.reportOpen) render();
        if (state.hazardRemaining === 0) {
          clearTicker();
          showFeedback(
            "Conflict zone clear. Check your surroundings, then proceed.",
            "success",
          );
        }
      }
    }, 1000);
}
function actionPrimary() {
  if (state.step === 0) {
    if (state.persona === "rider") {
      enterStep(1);
      showFeedback(
        "AR is on. Follow the highlighted bike lane and stop for red.",
        "success",
      );
      return;
    }
    showFeedback(
      state.lane === "right"
        ? "Right-turn lane confirmed. Continue toward the stop line."
        : "Select the right-turn lane before the junction.",
      state.lane === "right" ? "success" : "info",
    );
    return;
  }
  if (state.step === 2) {
    demoMove();
    return;
  }
}
function actionSecondary() {
  if (state.step === 0) {
    if (state.persona === "rider") {
      showFeedback(
        "Open AR while approaching. Stop only for the red signal and stop line.",
        "info",
      );
      return;
    }
    showFeedback(
      "For a right turn, select the lane beside the bike lane.",
      "info",
    );
    return;
  }
  if (state.step === 1) {
    showFeedback("The signal is red. The stop line marks the approach to the junction.", "info");
    return;
  }
  if (state.step === 2) {
    state.yielded = true;
    showFeedback(
      state.hazardRemaining > 0
        ? "Good choice. Wait for the crossing to clear."
        : "The crossing is clear. Check once more, then proceed.",
      "success",
    );
  }
}
function demoMove() {
  if (state.summary) return;
  const from = state.distance;
  const next = Math.max(-50, from - 10);
  if (next === from) {
    showFeedback(
      "Journey endpoint reached. Review the crossing feedback.",
      "info",
    );
    return;
  }
  const wasApproach = state.step === 0;
  state.distance = next;
  state.stopped = false;
  if (wasApproach && next <= 0) {
    if (state.persona === "driver" && state.lane !== "right") {
      state.wrongLaneCrossed = true;
      state.errors++;
    }
    enterStep(1);
  }
  if (state.step === 1 && from >= 0 && next < 0 && !state.redCrossed) {
    state.redCrossed = true;
    state.errors++;
  }
  if (
    state.step === 2 &&
    state.hazardRemaining > 0 &&
    from > CONFLICT_DISTANCE[state.persona].crossed &&
    next <= CONFLICT_DISTANCE[state.persona].crossed &&
    !state.conflictCrossed
  ) {
    state.conflictCrossed = true;
    state.errors++;
  }
  render();
  if (state.step > 0 || state.persona === "driver") animateCamera(from, next);
  const warning = riskMessage();
  if (state.wrongLaneCrossed && wasApproach)
    showFeedback(
      `${warning} Lane choice differs from the right-turn route; check adjacent traffic.`,
      "danger",
    );
  else if (warning) {
    showFeedback(warning, "danger");
  } else if (state.step === 0)
    showFeedback(
      `${next} m to the junction. Solid lane boundaries are highlighted.`,
      "info",
    );
  else if (state.step === 2 && state.hazardRemaining === 0)
    showFeedback(
      "Crossing clear. Continue along the highlighted lane.",
      "success",
    );
  if (state.step === 2 && state.distance === -50) {
    setTimeout(() => {
      if (state.step === 2 && state.distance === -50) {
        clearTicker();
        clearMotion();
        state.summary = true;
        render();
      }
    }, 720);
  }
}
function demoStop() {
  state.stopped = !state.stopped;
  render();
  showFeedback(
    state.stopped
      ? "Stopped. Check the signal and surrounding traffic."
      : "Movement resumed.",
    "info",
  );
}
function renderDemoControls() {
  const location =
    state.distance > 0
      ? `${state.distance} m before stop line`
      : state.distance === 0
        ? "At stop line"
        : `${Math.abs(state.distance)} m beyond stop line`;
  const stage =
    state.step === 0
      ? "Approach"
      : state.step === 1
        ? "Red light"
        : "Green light";
  const html = `<div class="demo-head"><span>PRESENTER CONTROLS</span><span class="demo-stage">${stage}</span></div><div class="demo-location">${location} <span>· ${state.stopped ? "Stopped" : "Moving"}</span></div><div class="demo-actions"><button type="button" class="demo-move" data-demo-action="move" ${state.summary ? "disabled" : ""}>Move +10 m <span>→</span></button><button type="button" data-demo-action="stop">${state.stopped ? "Resume" : "Stop"}</button><button type="button" data-demo-action="signal" ${state.step !== 1 ? "disabled" : ""}>Green light</button><button type="button" data-demo-action="reset">Reset</button></div>`;
  $("desktop-demo-console").innerHTML = html;
  $("mobile-demo-console").innerHTML = html;
}
function renderReportPage() {
  const available = state.distance <= -20 || state.summary;
  const entry = $("report-entry");
  entry.hidden = !available || state.reportOpen;
  $("report-edge-button").hidden = state.reportEntryExpanded;
  $("report-entry-action").hidden = !state.reportEntryExpanded;
  $("report-edge-button").setAttribute("aria-expanded", String(state.reportEntryExpanded));
  const page = $("report-page");
  page.hidden = !state.reportOpen;
  if (!state.reportOpen) return;
  const region = reportRegions.find((candidate) => candidate.id === state.reportSelected);
  const draft = page.querySelector("#report-description")?.value || "";
  if (draft) state.reportDraft = draft;
  page.innerHTML = `<div class="report-header"><button type="button" id="report-close" aria-label="Back to journey">←</button><div><span>JUNCTION REVIEW</span><h2>Report a conflict zone</h2></div></div>
    <p class="report-intro">${state.persona === "rider" ? "This run: turning traffic crossed the bike route." : "This run: the right turn passed the exit crosswalk."} Tap an area below to recall and report a conflict.</p>
    <div class="report-map" id="report-map">${mapArt(true)}</div>
    <div class="report-legend"><span><i class="report-legend-dot"></i> Possible conflict area</span><span><i class="report-legend-dot submitted"></i> Reported</span></div>
    ${state.reportSubmitted ? `<div class="report-form report-success" role="status"><strong>Report saved</strong><p>${escapeHtml(region?.label || "Conflict zone")} will appear as a steady yellow warning in the map and AR views on the next run.</p><button type="button" id="report-replay">Run this journey again</button></div>` : region ? `<form id="report-form" class="report-form"><span class="report-form-kicker">SELECTED AREA</span><h3>${escapeHtml(region.label)}</h3><label for="report-description">Briefly describe what happened</label><textarea id="report-description" name="description" maxlength="240" rows="3" placeholder="For example: a turning car passed close to the bike crossing" required>${escapeHtml(state.reportDraft || reports[region.id]?.description || "")}</textarea><button type="submit">Submit report</button></form>` : `<div class="report-prompt">Select one of the highlighted areas above to describe what happened.</div>`}`;
}
function openReport() {
  if (state.distance > -20 && !state.summary) return;
  clearMotion();
  state.reportOpen = true;
  state.reportEntryExpanded = false;
  state.reportSelected = null;
  state.reportDraft = "";
  state.reportSubmitted = false;
  render();
  $("report-close")?.focus();
}
function render() {
  const item = journeys[state.persona][state.step];
  const driver = state.persona === "driver";
  document.body.classList.toggle("driver-mode", driver);
  if (!driver && !state.sheetAutoOpened && (state.step > 0 || state.distance <= 10)) {
    state.sheetExpanded = true;
    state.sheetAutoOpened = true;
  }
  renderSheet();
  document.querySelectorAll(".persona").forEach((btn) => {
    const active = btn.dataset.persona === state.persona;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
  $("stage-list").innerHTML = journeys[state.persona]
    .map(
      (stage, i) =>
        `<button class="stage-item ${i === state.step ? "active" : ""}" data-step="${i}" ${i === state.step ? 'aria-current="step"' : ""}><span class="stage-number">0${i + 1}</span><strong>${stage.stage}</strong></button>`,
    )
    .join("");
  setText(
    "desktop-title",
    driver ? "Driver junction simulator" : "Scooter junction simulator",
  );
  setText("view-label", item.view);
  setText("maneuver-icon", item.icon);
  setText("maneuver-title", item.title);
  renderGuidance(item, driver);
  renderScene(item, driver);
  renderSummary(driver);
  renderDemoControls();
  renderReportPage();
  renderFeedback();
}
function formatApproachDistance() {
  if (state.distance > 0) return `${state.distance} m ahead`;
  if (state.distance === 0) return "At stop line";
  return `${Math.abs(state.distance)} m beyond`;
}
function renderGuidance(item, driver) {
  let distance = item.distance,
    advisory = item.advisory,
    advisoryType = item.advisoryType,
    primary = item.action,
    secondary = "";
  if (state.step === 0) {
    distance = formatApproachDistance();
    if (driver) {
      primary = "Check lane";
      secondary = "Help";
      advisory = nearStopLine()
        ? riskMessage()
        : state.lane === "right"
          ? "Right-turn lane selected. The solid line separates you from the bike lane."
          : state.lane
            ? "Lane choice differs from the right-turn route. Check the highlighted solid boundary."
            : "Check the through, right-turn, and bike lanes before the junction.";
      advisoryType = state.lane && state.lane !== "right" ? "danger" : "";
    } else {
      primary = "Open AR";
      advisory = nearStopLine()
        ? riskMessage()
        : "Open AR while moving to see the labeled lanes and solid boundaries ahead.";
    }
  } else if (state.step === 1) {
    distance = state.distance > 0 ? `${state.distance} m to line` : state.distance === 0 ? "At stop line" : "Past stop line";
    primary = "";
    secondary = driver ? "Why wait?" : "";
    advisory = nearStopLine()
      ? riskMessage()
      : driver
        ? "Red signal ahead. Check the highlighted stop line and crosswalk."
        : "Red signal ahead. Check the highlighted stop line.";
    advisoryType = nearStopLine() ? "danger" : "alert";
    if (state.redCrossed) {
      setText("maneuver-title", "Stop line crossed");
    }
  } else {
    distance =
      state.hazardRemaining > 0
        ? `Occupied · ${state.hazardRemaining}s`
        : "Crossing clear";
    primary = driver ? "Continue driving" : "Continue riding";
    secondary = "Yield";
    advisory = nearConflict()
      ? riskMessage()
      : state.hazardRemaining > 0
        ? driver
          ? "Pedestrian is using the exit crosswalk. Check before turning."
          : "Turning traffic is crossing the bike route. Check ahead."
        : driver
          ? state.distance <= -20
            ? "Continue in the highlighted exit lane."
            : "Crosswalk clear. Check again, then follow the right turn."
          : state.distance <= -22
            ? "Continue in the far-side bike lane."
            : "Conflict area is clear. Check again, then follow the crossing.";
    advisoryType = nearConflict() ? "danger" : "";
    if (!driver && state.distance <= -22) {
      setText("maneuver-title", "Stay in bike lane");
    }
    if (driver && state.distance <= -20) {
      setText("maneuver-title", "Stay in exit lane");
    }
  }
  setText("distance", distance);
  setText("advisory-text", advisory);
  $("advisory").className = `advisory ${advisoryType}`;
  const primaryButton = $("primary-button");
  primaryButton.hidden = !primary;
  primaryButton.innerHTML = primary ? `${primary}<span>↗</span>` : "";
  const secondaryButton = $("secondary-button");
  secondaryButton.hidden = !secondary;
  secondaryButton.textContent = secondary;
  $("sheet-actions").hidden = !primary && !secondary;
  const laneRow = $("choice-row");
  laneRow.hidden = !(driver && state.step === 0);
  if (!laneRow.hidden)
    laneRow.innerHTML = [
      ["left", "Left"],
      ["right", "Right"],
      ["bike", "Bike"],
    ]
      .map(
        ([key, label]) =>
          `<button class="lane-choice ${state.lane === key ? "selected" : ""}" data-lane="${key}" aria-pressed="${state.lane === key}">${label}</button>`,
      )
      .join("");
}
function renderScene(item, driver) {
  $("scene-art").innerHTML = art[item.art]();
  $("scene-art").style.transform = "none";
  const stopRisk = nearStopLine();
  const conflictRisk = nearConflict();
  $("scene").classList.toggle("stop-risk", stopRisk);
  $("scene").classList.toggle("conflict-risk", conflictRisk);
  $("scene")
    .closest(".phone")
    .classList.toggle("risk-active", stopRisk || conflictRisk);
  $("scene").classList.toggle(
    "hazard-cleared",
    state.step === 2 && state.hazardRemaining === 0,
  );
  $("scene-overlays").innerHTML = (driver
    ? driverOverlays()
    : state.step > 0
      ? riderOverlays()
      : riderMapOverlays()) + reportedNotice();
  $("back-button").disabled = state.step === 0;
  $("back-button").style.opacity = state.step === 0 ? ".35" : "1";
}
function renderSummary(driver) {
  $("summary").hidden = !state.summary || state.reportOpen;
  if (state.summary) {
    const first = driver
      ? state.wrongLaneCrossed
        ? "Lane choice prompted a warning"
        : "Selected the right-turn lane"
      : "Followed the bike lane toward the junction";
    const second = state.redCrossed
      ? "Crossed the stop line on red"
      : "Checked the red signal";
    const third = state.conflictCrossed
      ? "Entered an occupied conflict zone"
      : state.yielded
        ? "Yielded at the conflict zone"
        : "Continued after the conflict cleared";
    $("summary").innerHTML =
        `<div class="summary-card" role="dialog" aria-modal="true" aria-labelledby="summary-title"><div class="summary-kicker">JOURNEY COMPLETE</div><h2 id="summary-title">You made it through.</h2><p>Review the feedback from this crossing.</p><div class="summary-line"><span>01</span>${first}</div><div class="summary-line"><span>02</span>${second}</div><div class="summary-line"><span>03</span>${third}</div><div class="summary-note">${state.errors ? `${state.errors} risk alert${state.errors === 1 ? "" : "s"} appeared during this run. Try again to compare.` : "No risk alerts in this run."}</div><button id="report-summary-button">Report a conflict zone</button><button id="replay-button">Replay journey</button><button id="switch-button">Try ${driver ? "scooter rider" : "car driver"} scenario</button></div>`;
  }
}
function renderSheet() {
  const rider = state.persona === "rider";
  const expanded = !rider || state.sheetExpanded;
  $("bottom-sheet").classList.toggle("is-collapsed", rider && !expanded);
  $("sheet-drag-area").setAttribute("aria-expanded", String(expanded));
  $("sheet-drag-area").setAttribute("aria-label", expanded ? "Collapse guidance" : "Expand guidance");
  $("sheet-drag-area").tabIndex = rider ? 0 : -1;
  $("sheet-details").inert = rider && !expanded;
  $("sheet-details").setAttribute("aria-hidden", String(rider && !expanded));
}
const sheetDragArea = $("sheet-drag-area");
const bottomSheet = $("bottom-sheet");
let sheetDrag = null;
let suppressSheetClick = false;
sheetDragArea.addEventListener("pointerdown", (event) => {
  if (state.persona !== "rider" || event.button !== 0) return;
  sheetDrag = { pointerId: event.pointerId, startY: event.clientY, startHeight: bottomSheet.getBoundingClientRect().height, moved: false };
  sheetDragArea.setPointerCapture(event.pointerId);
});
sheetDragArea.addEventListener("pointermove", (event) => {
  if (!sheetDrag || event.pointerId !== sheetDrag.pointerId) return;
  const delta = sheetDrag.startY - event.clientY;
  if (Math.abs(delta) > 5) sheetDrag.moved = true;
  if (!sheetDrag.moved) return;
  bottomSheet.classList.add("is-dragging");
  bottomSheet.style.height = `${Math.max(110, Math.min(252, sheetDrag.startHeight + delta))}px`;
});
function endSheetDrag(event, cancelled = false) {
  if (!sheetDrag || event.pointerId !== sheetDrag.pointerId) return;
  const moved = sheetDrag.moved;
  const height = bottomSheet.getBoundingClientRect().height;
  sheetDrag = null;
  bottomSheet.classList.remove("is-dragging");
  bottomSheet.style.height = "";
  if (moved && !cancelled) {
    state.sheetExpanded = height >= 181;
    suppressSheetClick = true;
    renderSheet();
  }
}
sheetDragArea.addEventListener("pointerup", (event) => endSheetDrag(event));
sheetDragArea.addEventListener("pointercancel", (event) => endSheetDrag(event, true));
sheetDragArea.addEventListener("click", () => {
  if (suppressSheetClick) {
    suppressSheetClick = false;
    return;
  }
  if (state.persona !== "rider") return;
  state.sheetExpanded = !state.sheetExpanded;
  renderSheet();
});
sheetDragArea.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  state.sheetExpanded = !state.sheetExpanded;
  renderSheet();
});
$("primary-button").addEventListener("click", actionPrimary);
document.addEventListener("click", (e) => {
  const button = e.target.closest("[data-demo-action]");
  if (!button) return;
  const action = button.dataset.demoAction;
  if (action === "move") demoMove();
  if (action === "stop") demoStop();
  if (action === "signal" && state.step === 1) enterStep(2);
  if (action === "reset") resetJourney();
});
$("secondary-button").addEventListener("click", actionSecondary);
$("back-button").addEventListener("click", () => {
  if (state.step > 0) enterStep(state.step - 1);
});
$("choice-row").addEventListener("click", (e) => {
  const b = e.target.closest("[data-lane]");
  if (!b) return;
  state.lane = b.dataset.lane;
  render();
  if (state.lane === "right")
    showFeedback(
      "Right-turn lane selected. Continue toward the signal.",
      "success",
    );
  else {
    state.errors++;
    showFeedback(
      state.lane === "bike"
        ? "The bike lane is for riders. Choose the right-turn lane."
        : "The left lane does not serve this right turn.",
      "danger",
    );
  }
});
$("scene-overlays").addEventListener("click", (e) => {
  const b = e.target.closest("[data-hint]");
  if (!b) return;
  const index = Number(b.dataset.hint);
  if (state.step === 0 && state.persona === "driver" && index < 3) {
    state.lane = ["left", "right", "bike"][index];
    render();
    showFeedback(
      state.lane === "right"
        ? "Right-turn lane selected."
        : "Choose the right-turn lane. ",
      state.lane === "right" ? "success" : "danger",
    );
    return;
  }
  if (state.step === 2 && index === 1) {
    showFeedback(
      state.hazardRemaining > 0
        ? "This red zone overlaps your route. Yield until it clears."
        : "The conflict zone has cleared. Check once more before moving.",
      state.hazardRemaining > 0 ? "danger" : "success",
    );
    return;
  }
  showFeedback(
    state.step === 1
      ? index === 0
        ? "Red signal: remain stopped."
        : "This marking shows where to wait or cross."
      : "This label identifies the road area in the AR view.",
  );
});
$("stage-list").addEventListener("click", (e) => {
  const b = e.target.closest("[data-step]");
  if (b) enterStep(Number(b.dataset.step));
});
document
  .querySelectorAll(".persona")
  .forEach((b) =>
    b.addEventListener("click", () => resetJourney(b.dataset.persona)),
  );
document
  .querySelectorAll("[data-menu-persona]")
  .forEach((b) =>
    b.addEventListener("click", () => resetJourney(b.dataset.menuPersona)),
  );
$("mode-button").addEventListener("click", () => {
  const menu = $("mode-menu");
  menu.hidden = !menu.hidden;
  $("mode-button").setAttribute("aria-expanded", String(!menu.hidden));
});
$("summary").addEventListener("click", (e) => {
  if (e.target.id === "report-summary-button") openReport();
  if (e.target.id === "replay-button") resetJourney();
  if (e.target.id === "switch-button")
    resetJourney(state.persona === "rider" ? "driver" : "rider");
});
$("report-edge-button").addEventListener("click", () => {
  state.reportEntryExpanded = !state.reportEntryExpanded;
  renderReportPage();
  $(state.reportEntryExpanded ? "report-entry-action" : "report-edge-button").focus();
});
$("report-entry-action").addEventListener("click", openReport);
$("report-page").addEventListener("click", (event) => {
  if (event.target.closest("#report-close")) {
    state.reportOpen = false;
    render();
    return;
  }
  if (event.target.closest("#report-replay")) {
    resetJourney();
    return;
  }
  const target = event.target.closest("[data-report-region]");
  if (!target) return;
  state.reportSelected = target.dataset.reportRegion;
  state.reportDraft = "";
  state.reportSubmitted = false;
  renderReportPage();
  $("report-description")?.focus();
});
$("report-page").addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const target = event.target.closest("[data-report-region]");
  if (!target) return;
  event.preventDefault();
  target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
$("report-page").addEventListener("submit", (event) => {
  if (event.target.id !== "report-form") return;
  event.preventDefault();
  const description = $("report-description").value.trim();
  if (!description || !state.reportSelected) return;
  reports[state.reportSelected] = { description, reportedAt: new Date().toISOString() };
  try { localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(reports)); } catch (_) {}
  state.reportSubmitted = true;
  state.reportDraft = description;
  renderReportPage();
});
document.addEventListener("click", (e) => {
  if (!e.target.closest("#mode-button") && !e.target.closest("#mode-menu")) {
    $("mode-menu").hidden = true;
    $("mode-button").setAttribute("aria-expanded", "false");
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    $("mode-menu").hidden = true;
    $("mode-button").setAttribute("aria-expanded", "false");
  }
});
render();
