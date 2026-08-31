/**
 * app.js — all dashboard logic. Pure frontend: schedule is computed from
 * Ghana (Africa/Accra) time on every load/tick; the only thing persisted
 * is user-entered overrides + history notes, in localStorage.
 */

// ---------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------
function readStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* storage unavailable (private mode etc.) — fail silently */
  }
}

function getConfig() {
  return Object.assign({}, DEFAULT_CONFIG, readStore(STORAGE_KEYS.config, {}));
}
function saveConfig(partial) {
  const cfg = Object.assign({}, getConfig(), partial);
  writeStore(STORAGE_KEYS.config, cfg);
  return cfg;
}
function getOverrides() {
  return readStore(STORAGE_KEYS.overrides, {});
}
function saveOverrides(map) {
  writeStore(STORAGE_KEYS.overrides, map);
}
function getHistory() {
  return readStore(STORAGE_KEYS.history, {});
}
function saveHistoryEntry(eventId, entry) {
  const h = getHistory();
  if (entry === null) {
    delete h[eventId];
  } else {
    h[eventId] = entry;
  }
  writeStore(STORAGE_KEYS.history, h);
  return h;
}

// ---------------------------------------------------------------------
// Ghana time + rotation math
// ---------------------------------------------------------------------
function nowMs() {
  return Date.now();
}
function isoDate(ms) {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function startOfUTCDay(ms) {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}
function weekIndexForMs(ms) {
  const dayStart = startOfUTCDay(ms);
  const diffDays = Math.floor((dayStart - ANCHOR_SUNDAY_UTC) / DAY_MS);
  return Math.floor(diffDays / 7);
}
function sundayForWeekIndex(idx) {
  return ANCHOR_SUNDAY_UTC + idx * 7 * DAY_MS;
}
function groupForWeekIndex(idx) {
  const raw = ((ANCHOR_GROUP - 1 + idx) % GROUP_COUNT + GROUP_COUNT) % GROUP_COUNT;
  return raw + 1;
}

function eventsForWeekIndex(idx) {
  const sunday = sundayForWeekIndex(idx);
  const group = groupForWeekIndex(idx);
  const sundayISO = isoDate(sunday);
  const cfg = getConfig();
  const overrides = getOverrides();

  const weekendMs = sunday + cfg.weekendDayOffset * DAY_MS + cfg.weekendHour * 3600000 + cfg.weekendMinute * 60000;

  let mOffset = cfg.midweekDayOffset, mHour = cfg.midweekHour, mMin = cfg.midweekMinute;
  const ov = overrides[sundayISO];
  if (ov) {
    mOffset = ov.dayOffset;
    mHour = ov.hour;
    mMin = ov.minute;
  }
  const midweekMs = sunday + mOffset * DAY_MS + mHour * 3600000 + mMin * 60000;

  const events = [
    { id: sundayISO + "-weekend", type: "weekend", group, datetime: weekendMs, sundayISO, weekIndex: idx, overridden: false },
    { id: sundayISO + "-midweek", type: "midweek", group, datetime: midweekMs, sundayISO, weekIndex: idx, overridden: !!ov }
  ];
  events.sort((a, b) => a.datetime - b.datetime);
  return events;
}

function getEventsRange(fromIdx, toIdx) {
  const out = [];
  for (let i = fromIdx; i <= toIdx; i++) out.push(...eventsForWeekIndex(i));
  out.sort((a, b) => a.datetime - b.datetime);
  return out;
}

// ---------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------
function formatDateLong(ms) {
  const d = new Date(ms);
  return `${WEEKDAY_NAMES[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function formatDateShort(ms) {
  const d = new Date(ms);
  return `${WEEKDAY_SHORT[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)}`;
}
function formatTime(ms) {
  const d = new Date(ms);
  let h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}
function pad2(n) {
  return String(Math.max(0, n)).padStart(2, "0");
}

// ---------------------------------------------------------------------
// State
// ---------------------------------------------------------------------
let allEvents = [];      // wide window, recomputed on any data change
let currentBlockIdx = 0;
let currentGroup = 1;
let nextEvent = null;
let expandedHistoryId = null;

const REFRESH_WINDOW_BEFORE = 14; // weeks of history kept in memory
const REFRESH_WINDOW_AFTER = 14;

function recomputeSchedule() {
  const now = nowMs();
  currentBlockIdx = weekIndexForMs(now);
  currentGroup = groupForWeekIndex(currentBlockIdx);
  allEvents = getEventsRange(currentBlockIdx - REFRESH_WINDOW_BEFORE, currentBlockIdx + REFRESH_WINDOW_AFTER);
  nextEvent = allEvents.find(e => e.datetime > now) || null;
  // keep "Auto" theme in step as the week crosses from weekend -> midweek -> weekend
  if (typeof applyThemeNow === "function") { applyThemeNow(); updateThemeUI(); }
}

// ---------------------------------------------------------------------
// Rendering — clock
// ---------------------------------------------------------------------
function tickClock() {
  const now = nowMs();
  const d = new Date(now);
  const h = pad2(d.getUTCHours());
  const m = pad2(d.getUTCMinutes());
  const s = pad2(d.getUTCSeconds());
  document.getElementById("clockTime").textContent = `${h}:${m}:${s}`;
  document.getElementById("clockDate").textContent =
    `${WEEKDAY_NAMES[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// ---------------------------------------------------------------------
// Rendering — hero / next / countdown
// ---------------------------------------------------------------------
function eventLabel(e) {
  return e.type === "weekend" ? "Weekend Cleaning" : "Midweek Cleaning";
}

// Roster markup shared by the hero card + the group detail modal, tagging
// the Group Leader / Assistant called out on the printed sheet.
function rosterListHTML(g) {
  const leader = GROUP_LEADERS[g], asst = GROUP_ASSISTANTS[g];
  return GROUPS[g].map(n => {
    let tag = "";
    if (n === leader) tag = '<span class="role-tag lead">Leader</span>';
    else if (n === asst) tag = '<span class="role-tag asst">Asst</span>';
    return `<li><span>${n}</span>${tag}</li>`;
  }).join("");
}

// ---------------------------------------------------------------------
// Hero team panel — Leader + Assistant stay pinned; everyone else
// auto-cycles through fixed-size "pages" that slide left and loop
// forever, sized to whatever fits the available height so nothing needs
// scrolling. Hovering (mouse) or tapping (touch) the panel pauses that
// and expands to a plain full list of everyone, over a blurred photo.
// ---------------------------------------------------------------------
const HERO_ROSTER_ROW_H = 30;   // keep in sync with the li sizing in style.css
const HERO_ROSTER_CYCLE_MS = 4500;

function otherMembersHTML(names) {
  return names.map(n => `<li><span>${n}</span></li>`).join("") || `<li><span>—</span></li>`;
}

let heroCycleTimer = null;
let heroCyclePageIdx = 0;
let heroCyclePageCount = 1;

function computeHeroRosterPageSize() {
  const cycle = document.getElementById("heroRosterCycle");
  const h = cycle ? cycle.clientHeight : 0;
  if (h < HERO_ROSTER_ROW_H) return 6; // not laid out yet (or too cramped to measure) — sane fallback
  return Math.max(3, Math.floor(h / HERO_ROSTER_ROW_H));
}
function renderHeroRosterDots(count, active) {
  const dots = document.getElementById("heroRosterDots");
  if (!dots) return;
  dots.innerHTML = count <= 1 ? "" : Array.from({ length: count }, (_, i) =>
    `<span class="${i === active ? "active" : ""}"></span>`).join("");
}
function updateHeroRosterDots(active) {
  document.querySelectorAll("#heroRosterDots span").forEach((d, i) => d.classList.toggle("active", i === active));
}
function stopHeroRosterCycle() {
  if (heroCycleTimer) { clearInterval(heroCycleTimer); heroCycleTimer = null; }
}
function startHeroRosterCycle() {
  stopHeroRosterCycle();
  if (heroCyclePageCount <= 1) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  heroCycleTimer = setInterval(advanceHeroRosterPage, HERO_ROSTER_CYCLE_MS);
}
function advanceHeroRosterPage() {
  const track = document.getElementById("heroRosterTrack");
  if (!track) return;
  heroCyclePageIdx++;
  track.style.transform = `translateX(-${heroCyclePageIdx * 100}%)`;
  updateHeroRosterDots(heroCyclePageIdx % heroCyclePageCount);
  // The last "page" is a clone of the first, appended so the slide can
  // keep going left seamlessly; once we land on it, snap back to the
  // real first page with no transition so the loop is invisible.
  if (heroCyclePageIdx === heroCyclePageCount) {
    track.addEventListener("transitionend", function reset() {
      track.removeEventListener("transitionend", reset);
      track.style.transition = "none";
      heroCyclePageIdx = 0;
      track.style.transform = "translateX(0%)";
      void track.offsetWidth; // force reflow so the "none" transition applies before re-enabling
      track.style.transition = "";
    }, { once: true });
  }
}
function renderHeroRosterCycle(g) {
  const leader = GROUP_LEADERS[g], asst = GROUP_ASSISTANTS[g];
  const others = GROUPS[g].filter(n => n !== leader && n !== asst);

  document.getElementById("heroRosterPinned").innerHTML =
    `<li><span>${leader}</span><span class="role-tag lead">Leader</span></li>` +
    (asst ? `<li><span>${asst}</span><span class="role-tag asst">Asst</span></li>` : "");
  document.getElementById("heroRosterFull").innerHTML = otherMembersHTML(others);

  const pageSize = computeHeroRosterPageSize();
  const pages = [];
  for (let i = 0; i < others.length; i += pageSize) pages.push(others.slice(i, i + pageSize));
  if (!pages.length) pages.push([]);
  heroCyclePageCount = pages.length;
  heroCyclePageIdx = 0;

  const track = document.getElementById("heroRosterTrack");
  const pageHTML = p => `<ul class="roster-list hero-roster-page">${otherMembersHTML(p)}</ul>`;
  track.style.transition = "none";
  track.innerHTML = pages.map(pageHTML).join("") + (pages.length > 1 ? pageHTML(pages[0]) : "");
  track.style.transform = "translateX(0%)";
  void track.offsetWidth;
  track.style.transition = "";

  renderHeroRosterDots(pages.length, 0);
  startHeroRosterCycle();
}
function wireHeroRosterExpand() {
  const panel = document.querySelector(".hero-roster-panel");
  if (!panel) return;
  function setExpanded(on) {
    if (panel.classList.contains("expanded") === on) return;
    panel.classList.toggle("expanded", on);
    if (on) stopHeroRosterCycle(); else startHeroRosterCycle();
  }
  // Real hover only exists on mouse/trackpad devices — touch gets a tap
  // toggle instead, since there's no hover state to drive it from.
  const canHover = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (canHover) {
    panel.addEventListener("mouseenter", () => setExpanded(true));
    panel.addEventListener("mouseleave", () => setExpanded(false));
  } else {
    panel.addEventListener("click", () => setExpanded(!panel.classList.contains("expanded")));
  }

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => renderHeroRosterCycle(currentGroup), 200);
  });
}

let heroNumRenderedFor = null;    // which group the big hero number was last drawn for
let heroRosterRenderedFor = null; // which group the hero team panel was last drawn for

function renderHero() {
  const now = nowMs();
  const blockEvents = eventsForWeekIndex(currentBlockIdx);

  const bigNum = document.getElementById("heroNumDigit");
  if (heroNumRenderedFor !== currentGroup) {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      bigNum.textContent = currentGroup;
    } else {
      countUpNumber(bigNum, currentGroup, 800);
    }
    heroNumRenderedFor = currentGroup;
  }
  document.getElementById("heroLeader").innerHTML = `Led by <strong>${GROUP_LEADERS[currentGroup]}</strong>`;
  if (heroRosterRenderedFor !== currentGroup) {
    renderHeroRosterCycle(currentGroup);
    heroRosterRenderedFor = currentGroup;
  }

  blockEvents.forEach(e => {
    const pillId = e.type === "weekend" ? "weekendPill" : "midweekPill";
    const pill = document.getElementById(pillId);
    const done = e.datetime <= now;
    pill.classList.toggle("pill-done", done);
    pill.classList.toggle("pill-upcoming", !done);
    pill.innerHTML = `
      <span class="pill-icon">${done ? "✓" : "○"}</span>
      <span class="pill-text">
        <strong>${eventLabel(e)}</strong>
        <small>${formatDateShort(e.datetime)} · ${formatTime(e.datetime)}${e.overridden ? " · moved" : ""}</small>
      </span>`;
  });

  // roster
  document.getElementById("currentRoster").innerHTML = rosterListHTML(currentGroup);

  // week progress (how far through this group's Sun–Sat block we are)
  const blockStart = sundayForWeekIndex(currentBlockIdx);
  const pct = Math.min(100, Math.max(0, ((now - blockStart) / (7 * DAY_MS)) * 100));
  document.getElementById("progressFill").style.width = pct + "%";

  const bothDone = blockEvents.every(e => e.datetime <= now);
  document.getElementById("currentCard").classList.toggle("all-done", bothDone);
  document.getElementById("heroStatusNote").textContent = bothDone
    ? "This group's assignment is complete ✅"
    : "Currently on duty";
}

function renderNextCard() {
  if (!nextEvent) return;
  document.getElementById("nextGroupName").textContent = `Group ${nextEvent.group}`;
  document.getElementById("nextGroupType").textContent = eventLabel(nextEvent);
  document.getElementById("nextGroupDate").textContent =
    `${formatDateLong(nextEvent.datetime)} · ${formatTime(nextEvent.datetime)}`;

  const dots = document.getElementById("cycleDots");
  dots.innerHTML = "";
  for (let g = 1; g <= GROUP_COUNT; g++) {
    const dot = document.createElement("span");
    dot.className = "cycle-dot" + (g === currentGroup ? " active" : "") + (g === nextEvent.group && nextEvent.group !== currentGroup ? " next" : "");
    dot.title = `Group ${g}`;
    dot.textContent = g;
    dots.appendChild(dot);
  }
}

function tickCountdown() {
  if (!nextEvent) return;
  const diff = nextEvent.datetime - nowMs();
  if (diff <= 0) {
    recomputeSchedule();
    renderAll();
    return;
  }
  const days = Math.floor(diff / DAY_MS);
  const hours = Math.floor((diff % DAY_MS) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  document.getElementById("cdDays").textContent = pad2(days);
  document.getElementById("cdHours").textContent = pad2(hours);
  document.getElementById("cdMins").textContent = pad2(mins);
  document.getElementById("cdSecs").textContent = pad2(secs);
  document.getElementById("countdownLabel").textContent =
    `Next: ${eventLabel(nextEvent)} — Group ${nextEvent.group}`;
}

// ---------------------------------------------------------------------
// Rendering — timeline (upcoming)
// ---------------------------------------------------------------------
function renderTimeline() {
  const now = nowMs();
  const upcoming = allEvents.filter(e => e.datetime > now).slice(0, 8);
  const el = document.getElementById("timeline");
  el.innerHTML = upcoming.map((e, i) => {
    const daysAway = Math.ceil((e.datetime - now) / DAY_MS);
    return `
      <div class="timeline-card" style="--i:${i}">
        <div class="tl-type ${e.type}">${e.type === "weekend" ? "Weekend" : "Midweek"}</div>
        <div class="tl-group">Group ${e.group}</div>
        <div class="tl-date">${formatDateShort(e.datetime)}</div>
        <div class="tl-time">${formatTime(e.datetime)}${e.overridden ? " · moved" : ""}</div>
        <div class="tl-away">${daysAway <= 0 ? "Today" : daysAway === 1 ? "Tomorrow" : "in " + daysAway + " days"}</div>
      </div>`;
  }).join("");
}

// ---------------------------------------------------------------------
// Rendering — group directory
// ---------------------------------------------------------------------
let groupGridCountUpDone = false; // only tick the numbers up on first paint

function countUpNumber(el, target, duration) {
  const start = performance.now();
  function frame(t) {
    const p = Math.min(1, (t - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
    const val = Math.round(eased * target);
    el.textContent = val === 0 && p < 1 ? "" : val;
    if (p < 1) requestAnimationFrame(frame);
    else el.textContent = target;
  }
  requestAnimationFrame(frame);
}

function renderGroupGrid() {
  const el = document.getElementById("groupGrid");
  el.innerHTML = "";
  for (let g = 1; g <= GROUP_COUNT; g++) {
    const members = GROUPS[g];
    const card = document.createElement("div");
    card.className = "group-card" + (g === currentGroup ? " active" : "");
    card.style.setProperty("--i", g - 1);
    card.innerHTML = `
      ${g === currentGroup ? '<div class="ribbon">ON DUTY</div>' : ""}
      <div class="group-num">
        <span class="num-word">Group</span>
        <span class="num-digit" data-target="${g}"></span>
      </div>
      <div class="group-leader">
        <span class="leader-tag">Group Leader</span>
        <span class="leader-name">${GROUP_LEADERS[g]}</span>
        ${GROUP_ASSISTANTS[g] ? `<span class="assistant-name">Asst: ${GROUP_ASSISTANTS[g]}</span>` : ""}
      </div>
      <p class="group-count">${members.length} publishers · tap for full team</p>`;
    card.addEventListener("click", () => openGroupModal(g));
    el.appendChild(card);
  }

  const numEls = el.querySelectorAll(".group-num .num-digit");
  if (groupGridCountUpDone || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
    numEls.forEach(n => { n.textContent = n.dataset.target; });
  } else {
    numEls.forEach((n, i) => {
      // stagger to match each card's own entrance delay
      setTimeout(() => countUpNumber(n, Number(n.dataset.target), 550), i * 80 + 150);
    });
    groupGridCountUpDone = true;
  }
}

function openGroupModal(g) {
  document.getElementById("groupModalTitle").textContent = `Group ${g}${g === currentGroup ? " — on duty this week" : ""}`;
  document.getElementById("groupModalRoster").innerHTML = rosterListHTML(g);
  showOverlay("groupOverlay");
}

// ---------------------------------------------------------------------
// Rendering — history
// ---------------------------------------------------------------------
function currentHistoryFilter() {
  const active = document.querySelector("#historyFilters .tab.active");
  return active ? active.dataset.filter : "all";
}

function renderHistory() {
  const now = nowMs();
  const history = getHistory();
  const filter = currentHistoryFilter();
  const past = allEvents.filter(e => e.datetime <= now).sort((a, b) => b.datetime - a.datetime).slice(0, 24);

  const rows = past.filter(e => {
    const status = history[e.id]?.status || "pending";
    if (filter === "all") return true;
    return status === filter;
  });

  const el = document.getElementById("historyList");
  if (rows.length === 0) {
    el.innerHTML = `<p class="empty-note">Nothing here yet.</p>`;
    return;
  }

  el.innerHTML = rows.map(e => {
    const entry = history[e.id];
    const status = entry?.status || "pending";
    const expanded = expandedHistoryId === e.id;
    return `
      <div class="history-row status-${status}${expanded ? " expanded" : ""}" data-id="${e.id}">
        <div class="hr-main">
          <span class="hr-type ${e.type}">${e.type === "weekend" ? "Weekend" : "Midweek"}</span>
          <span class="hr-group">Group ${e.group}</span>
          <span class="hr-date">${formatDateShort(e.datetime)} · ${formatTime(e.datetime)}</span>
          <span class="hr-status">${status === "done" ? "✓ Completed" : status === "missed" ? "✕ Missed" : "Unconfirmed"}</span>
        </div>
        ${expanded ? `
        <div class="hr-detail">
          <textarea class="hr-note" placeholder="Optional note (who supervised, anything to flag)...">${entry?.note || ""}</textarea>
          <div class="hr-actions">
            <button class="btn btn-sm btn-done" data-action="done">Mark Completed</button>
            <button class="btn btn-sm btn-missed" data-action="missed">Mark Missed</button>
            <button class="btn btn-sm btn-ghost" data-action="clear">Clear</button>
          </div>
        </div>` : ""}
      </div>`;
  }).join("");

  el.querySelectorAll(".history-row").forEach(row => {
    const id = row.dataset.id;
    row.querySelector(".hr-main").addEventListener("click", () => {
      expandedHistoryId = expandedHistoryId === id ? null : id;
      renderHistory();
    });
    row.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const action = btn.dataset.action;
        const note = row.querySelector(".hr-note")?.value || "";
        if (action === "clear") {
          saveHistoryEntry(id, null);
        } else {
          saveHistoryEntry(id, { status: action, note, savedAt: nowMs() });
        }
        toast(action === "clear" ? "Cleared" : "Saved");
        renderHistory();
      });
    });
  });
}

// ---------------------------------------------------------------------
// Settings modal
// ---------------------------------------------------------------------
function populateDaySelect(select, includeSunday) {
  select.innerHTML = "";
  WEEKDAY_NAMES.forEach((name, idx) => {
    if (idx === 0 && !includeSunday) return;
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = name;
    select.appendChild(opt);
  });
}

function openSettings() {
  const cfg = getConfig();
  populateDaySelect(document.getElementById("defaultMidweekDay"), false);
  document.getElementById("defaultMidweekDay").value = cfg.midweekDayOffset;
  document.getElementById("defaultMidweekTime").value = `${pad2(cfg.midweekHour)}:${pad2(cfg.midweekMinute)}`;
  document.getElementById("defaultWeekendTime").value = `${pad2(cfg.weekendHour)}:${pad2(cfg.weekendMinute)}`;

  populateDaySelect(document.getElementById("overrideDay"), false);

  const weekSelect = document.getElementById("overrideWeekSelect");
  weekSelect.innerHTML = "";
  for (let i = 0; i <= 16; i++) {
    const idx = currentBlockIdx + i;
    const sunday = sundayForWeekIndex(idx);
    const opt = document.createElement("option");
    opt.value = isoDate(sunday);
    opt.textContent = `${formatDateShort(sunday)} ${new Date(sunday).getUTCFullYear()} — Group ${groupForWeekIndex(idx)}`;
    weekSelect.appendChild(opt);
  }

  renderOverrideList();
  showOverlay("settingsOverlay");
}

function renderOverrideList() {
  const overrides = getOverrides();
  const keys = Object.keys(overrides).sort();
  const el = document.getElementById("overrideList");
  if (keys.length === 0) {
    el.innerHTML = `<li class="empty-note">No one-off changes yet.</li>`;
    return;
  }
  el.innerHTML = keys.map(k => {
    const ov = overrides[k];
    return `<li>
      <span>Week of ${k} → <strong>${WEEKDAY_NAMES[ov.dayOffset]}</strong> at ${pad2(ov.hour)}:${pad2(ov.minute)}</span>
      <button class="icon-btn sm" data-key="${k}" aria-label="Remove override">✕</button>
    </li>`;
  }).join("");
  el.querySelectorAll("button[data-key]").forEach(btn => {
    btn.addEventListener("click", () => {
      const map = getOverrides();
      delete map[btn.dataset.key];
      saveOverrides(map);
      renderOverrideList();
      recomputeSchedule();
      renderAll();
      toast("Removed");
    });
  });
}

function wireSettings() {
  document.getElementById("settingsBtn").addEventListener("click", openSettings);
  document.getElementById("closeSettings").addEventListener("click", () => hideOverlay("settingsOverlay"));

  document.getElementById("defaultMidweekDay").addEventListener("change", (e) => {
    saveConfig({ midweekDayOffset: Number(e.target.value) });
    recomputeSchedule(); renderAll(); toast("Saved");
  });
  document.getElementById("defaultMidweekTime").addEventListener("change", (e) => {
    const [h, m] = e.target.value.split(":").map(Number);
    saveConfig({ midweekHour: h, midweekMinute: m });
    recomputeSchedule(); renderAll(); toast("Saved");
  });
  document.getElementById("defaultWeekendTime").addEventListener("change", (e) => {
    const [h, m] = e.target.value.split(":").map(Number);
    saveConfig({ weekendHour: h, weekendMinute: m });
    recomputeSchedule(); renderAll(); toast("Saved");
  });

  document.getElementById("addOverrideBtn").addEventListener("click", () => {
    const sundayISO = document.getElementById("overrideWeekSelect").value;
    const dayOffset = Number(document.getElementById("overrideDay").value);
    const timeVal = document.getElementById("overrideTime").value;
    if (!timeVal) { toast("Pick a time first"); return; }
    const [h, m] = timeVal.split(":").map(Number);
    const map = getOverrides();
    map[sundayISO] = { dayOffset, hour: h, minute: m };
    saveOverrides(map);
    renderOverrideList();
    recomputeSchedule();
    renderAll();
    toast("One-off change added");
  });

  document.getElementById("resetDataBtn").addEventListener("click", () => {
    if (!confirm("Reset all locally saved settings and history? This can't be undone.")) return;
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
    recomputeSchedule();
    renderAll();
    hideOverlay("settingsOverlay");
    toast("Reset complete");
  });
}

// ---------------------------------------------------------------------
// Theme (light / dark) — "Auto" follows the cleaning schedule itself:
// dark Monday 12am through Saturday 12am (the midweek stretch), light
// Saturday 12am through Monday 12am (the weekend stretch — Saturday
// through Sunday, covering the run-up to Sunday's cleaning as well as
// the cleaning itself). Ghana has no DST and sits at UTC+0 year-round,
// so a UTC day boundary IS the Ghana midnight boundary.
//
// Two ways to override Auto:
//  - The header toggle is a TEMPORARY lock — it flips the theme, but
//    only for 2 hours, after which it reverts to whatever the real
//    setting is (Auto by default). Good for "leave it alone for now"
//    without committing to anything.
//  - Settings sets a PERMANENT choice (Auto/Light/Dark) that sticks
//    until changed there again, and immediately cancels any temporary
//    lock in place.
// ---------------------------------------------------------------------
const TEMP_THEME_MS = 2 * 60 * 60 * 1000; // 2 hours

function getStoredThemeChoice() {
  try { return localStorage.getItem("khct.theme"); } catch (e) { return null; }
}
function setStoredThemeChoice(v) {
  try {
    if (v === null) localStorage.removeItem("khct.theme");
    else localStorage.setItem("khct.theme", v);
  } catch (e) {}
}
function getTempThemeOverride() {
  try {
    const raw = localStorage.getItem("khct.themeTemp");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const valid = parsed && (parsed.choice === "light" || parsed.choice === "dark") && parsed.expiresAt > nowMs();
    if (!valid) { localStorage.removeItem("khct.themeTemp"); return null; }
    return parsed;
  } catch (e) { return null; }
}
function setTempThemeOverride(choice) {
  try { localStorage.setItem("khct.themeTemp", JSON.stringify({ choice, expiresAt: nowMs() + TEMP_THEME_MS })); } catch (e) {}
}
function clearTempThemeOverride() {
  try { localStorage.removeItem("khct.themeTemp"); } catch (e) {}
}
function scheduleTheme() {
  const day = new Date(nowMs()).getUTCDay(); // 0=Sun .. 6=Sat
  return day >= 1 && day <= 5 ? "dark" : "light"; // Mon-Fri = midweek stretch, Sat/Sun = weekend stretch
}
// The permanent setting, exactly as chosen in Settings — "auto" unless locked there.
function permanentThemeChoice() {
  const stored = getStoredThemeChoice();
  return stored === "light" || stored === "dark" ? stored : "auto";
}
// What's actually in effect right now: an unexpired temporary lock wins, else the permanent setting.
function themeChoice() {
  const temp = getTempThemeOverride();
  return temp ? temp.choice : permanentThemeChoice();
}
function resolvedTheme() {
  const choice = themeChoice();
  return choice === "auto" ? scheduleTheme() : choice;
}
function applyThemeNow() {
  document.documentElement.setAttribute("data-theme", resolvedTheme());
}
function updateThemeUI() {
  const temp = getTempThemeOverride();
  const permanent = permanentThemeChoice();
  const resolved = resolvedTheme();
  const btn = document.getElementById("themeToggle");
  if (btn) {
    btn.classList.toggle("show-sun", resolved === "dark");
    btn.classList.toggle("show-moon", resolved !== "dark");
    if (temp) {
      const mins = Math.max(1, Math.round((temp.expiresAt - nowMs()) / 60000));
      btn.title = `Locked to ${temp.choice} for ~${mins} more min, then back to ${permanent === "auto" ? "Auto" : permanent}. Click to switch. Set a permanent theme in Settings.`;
    } else {
      btn.title = permanent === "auto"
        ? `Auto (currently ${resolved} — following the cleaning schedule). Click to lock ${resolved === "dark" ? "light" : "dark"} for 2 hours.`
        : `Locked to ${permanent} (set in Settings). Click to switch for 2 hours.`;
    }
  }
  document.querySelectorAll("#themeChoice .theme-opt").forEach(b => {
    b.classList.toggle("active", b.dataset.themeChoice === permanent);
  });
}
function setTheme(choice) {
  // Settings only — sets the permanent choice and cancels any temporary lock.
  clearTempThemeOverride();
  setStoredThemeChoice(choice === "auto" ? null : choice);
  applyThemeNow();
  updateThemeUI();
}
function wireTheme() {
  document.getElementById("themeToggle").addEventListener("click", () => {
    setTempThemeOverride(resolvedTheme() === "dark" ? "light" : "dark");
    applyThemeNow();
    updateThemeUI();
  });
  document.querySelectorAll("#themeChoice .theme-opt").forEach(b => {
    b.addEventListener("click", () => setTheme(b.dataset.themeChoice));
  });
  updateThemeUI();
}
// Applied synchronously as soon as this script runs (before the
// DOMContentLoaded-driven init/render), so there's minimal flash even
// though "Auto" needs the schedule computed rather than a static flag.
applyThemeNow();
updateThemeUI();

// ---------------------------------------------------------------------
// Overlays / toast
// ---------------------------------------------------------------------
function showOverlay(id) {
  const el = document.getElementById(id);
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add("open"));
}
function hideOverlay(id) {
  const el = document.getElementById(id);
  el.classList.remove("open");
  setTimeout(() => { el.hidden = true; }, 200);
}

let toastTimer = null;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

// ---------------------------------------------------------------------
// Wiring + init
// ---------------------------------------------------------------------
function renderAll() {
  renderHero();
  renderNextCard();
  renderTimeline();
  renderGroupGrid();
  renderHistory();
}

function wireMisc() {
  document.getElementById("toggleRosterBtn").addEventListener("click", () => {
    const list = document.getElementById("currentRoster");
    const btn = document.getElementById("toggleRosterBtn");
    const willShow = list.hidden;
    list.hidden = !willShow;
    btn.textContent = willShow ? "Hide this week's team ▴" : "View this week's team ▾";
  });

  document.getElementById("closeGroupModal").addEventListener("click", () => hideOverlay("groupOverlay"));

  document.querySelectorAll(".modal-overlay").forEach(ov => {
    ov.addEventListener("click", (e) => {
      if (e.target === ov) hideOverlay(ov.id);
    });
  });

  document.querySelectorAll("#historyFilters .tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll("#historyFilters .tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      expandedHistoryId = null;
      renderHistory();
    });
  });

  document.getElementById("congName").textContent = CONGREGATION_NAME;
  document.getElementById("year").textContent = new Date().getUTCFullYear();
}

function init() {
  recomputeSchedule();
  wireMisc();
  wireSettings();
  wireTheme();
  wireHeroRosterExpand();
  renderAll();
  tickClock();
  tickCountdown();
  setInterval(tickClock, 1000);
  setInterval(tickCountdown, 1000);
  // re-check the schedule window periodically in case the tab stays open across midnight
  setInterval(() => { recomputeSchedule(); renderAll(); }, 5 * 60 * 1000);

  document.body.classList.add("ready");
}

document.addEventListener("DOMContentLoaded", init);
