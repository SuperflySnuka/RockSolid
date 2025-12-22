// ../js/pages/routine.js
// Routine detail page: add/remove items by ID, rehydrate, export (Option A).

const ROUTINES_KEY = "rocksolid_routines_v1";
const SIGNATURE_ROUTINE_ONE = "RockSolidRoutine/v1";

// Data sources
const EXERCISE_URL = "../data/exercises.json";
const YOGA_BASE = "https://yoga-api-nzy4.onrender.com/v1";

let routineId = null;
let _exerciseCache = null;

document.addEventListener("DOMContentLoaded", () => {
  routineId = getQueryParam("id");
  if (!routineId || !routineId.startsWith("routine:")) {
    setStatus("Missing routine id in URL.");
    renderNotFound();
    return;
  }

  // wire controls
  document.getElementById("add-btn")?.addEventListener("click", addItem);
  document.getElementById("add-id")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addItem();
  });

  document.getElementById("rename-btn")?.addEventListener("click", renameRoutine);
  document.getElementById("delete-btn")?.addEventListener("click", deleteRoutine);
  document.getElementById("export-btn")?.addEventListener("click", exportRoutine);

  render();
});

async function render() {
  const routine = getRoutineById(routineId);
  if (!routine) {
    setStatus("Routine not found.");
    renderNotFound();
    return;
  }

  // header
  document.getElementById("routine-title").textContent = routine.name;
  document.getElementById("routine-subtitle").textContent =
    `${routine.items.length} item(s) • ${routine.id}`;

  // items
  const grid = document.getElementById("items-grid");
  if (!routine.items.length) {
    grid.innerHTML = `<div class="panel"><p class="small">No items yet. Add one above.</p></div>`;
    setStatus("Ready.");
    return;
  }

  setStatus("Loading items…");

  const settled = await Promise.allSettled(routine.items.map(fetchSkillById));
  const skills = settled
    .filter(r => r.status === "fulfilled" && r.value)
    .map(r => r.value);

  const failed = routine.items.length - skills.length;
  setStatus(
    failed
      ? `Loaded ${skills.length}/${routine.items.length}. (${failed} failed)`
      : `Loaded ${skills.length} item(s).`
  );

  // sort
  skills.sort((a, b) => safeStr(a.name).localeCompare(safeStr(b.name)));

  grid.innerHTML = skills.map(renderSkillCard).join("");

  // remove handler (delegated)
  grid.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action='remove']");
    if (!btn) return;
    const skillId = btn.dataset.skillId;
    removeItem(skillId);
  });
}

/* -------------------- Actions -------------------- */

function addItem() {
  const input = document.getElementById("add-id");
  const raw = String(input?.value || "").trim();
  if (!raw) {
    setStatus("Enter an id (ex:123 / yoga:55) or an exercise name.");
    return;
  }

  // Accept a few input styles:
  // - "ex:123" / "yoga:55" (explicit)
  // - "123" (assume exercise id)
  // - "push up" (assume exercise name)
  const normalized = normalizeUserEnteredSkillRef(raw);

  if (!normalized) {
    setStatus("Invalid input. Use ex:123, yoga:55, 123, or an exercise name.");
    return;
  }

  const routine = getRoutineById(routineId);
  if (!routine) return;

  // Store either:
  // - "ex:123" / "yoga:55" OR
  // - "exname:push up" (temporary reference that we resolve when rendering)
  if (!routine.items.includes(normalized)) routine.items.push(normalized);
  saveRoutine(routine);

  input.value = "";
  setStatus("Added.");
  render();
}

function normalizeUserEnteredSkillRef(raw) {
  const s = raw.trim();

  // already valid
  if (isValidSkillId(s)) return s;

  // pure number -> exercise id
  if (/^\d+$/.test(s)) return `ex:${s}`;

  // allow user to type "ex 123" or "ex-123" casually
  const exLoose = s.match(/^ex\D*(\d+)$/i);
  if (exLoose) return `ex:${exLoose[1]}`;

  const yogaLoose = s.match(/^yoga\D*(\d+)$/i);
  if (yogaLoose) return `yoga:${yogaLoose[1]}`;

  // otherwise treat as an exercise NAME reference (we resolve when rendering)
  // we prefix so it doesn't collide with real ids
  return `exname:${s.toLowerCase()}`;
}

function removeItem(skillId) {
  const routine = getRoutineById(routineId);
  if (!routine) return;

  routine.items = routine.items.filter(x => x !== skillId);
  saveRoutine(routine);

  setStatus("Removed.");
  render();
}

function renameRoutine() {
  const routine = getRoutineById(routineId);
  if (!routine) return;

  const next = prompt("New routine name:", routine.name);
  if (!next) return;

  routine.name = next.trim();
  saveRoutine(routine);

  setStatus("Renamed.");
  render();
}

function deleteRoutine() {
  const routine = getRoutineById(routineId);
  if (!routine) return;

  const ok = confirm(`Delete routine "${routine.name}"?`);
  if (!ok) return;

  const routines = getRoutines().filter(r => r.id !== routine.id);
  setRoutines(routines);

  // go back to routines list
  window.location.href = "routines.html";
}

function exportRoutine() {
  const routine = getRoutineById(routineId);
  if (!routine) return;

  const payload = {
    rocksolid: SIGNATURE_ROUTINE_ONE,
    exportedAt: new Date().toISOString(),
    data: routine
  };

  downloadJson(payload, `${slugify(routine.name)}.rocksolid.json`);
  setStatus("Exported.");
}

/* -------------------- Storage -------------------- */

function getRoutines() {
  try {
    const raw = localStorage.getItem(ROUTINES_KEY);
    const data = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(data)) return [];
    return data.map(normalizeRoutine).filter(Boolean);
  } catch {
    return [];
  }
}

function setRoutines(routines) {
  localStorage.setItem(ROUTINES_KEY, JSON.stringify(routines));
}

function getRoutineById(id) {
  return getRoutines().find(r => r.id === id) || null;
}

function saveRoutine(routine) {
  const routines = getRoutines();
  const idx = routines.findIndex(r => r.id === routine.id);
  if (idx >= 0) routines[idx] = normalizeRoutine(routine);
  else routines.push(normalizeRoutine(routine));
  setRoutines(routines);
}

function normalizeRoutine(r) {
  if (!r || typeof r !== "object") return null;

  const id = String(r.id || "").trim();
  const name = String(r.name || "").trim();
  if (!id.startsWith("routine:") || !name) return null;

  // NOTE: allow:
  // - ex:123 / yoga:55
  // - exname:push up (resolved when rendering)
  const items = Array.isArray(r.items)
    ? r.items.map(String).map(s => s.trim()).filter(isValidRoutineItemRef)
    : [];

  return {
    id,
    name,
    createdAt: r.createdAt || new Date().toISOString(),
    items: Array.from(new Set(items))
  };
}

function isValidRoutineItemRef(ref) {
  return isValidSkillId(ref) || (typeof ref === "string" && ref.startsWith("exname:") && ref.length > 7);
}

/* -------------------- Rehydrate skills -------------------- */

async function fetchSkillById(id) {
  if (id.startsWith("ex:")) return await fetchExerciseSkill(id.slice(3));
  if (id.startsWith("yoga:")) return await fetchYogaSkill(id.slice(5));
  if (id.startsWith("exname:")) return await fetchExerciseSkillByName(id.slice(7));
  return null;
}

async function loadExerciseCache() {
  if (_exerciseCache) return;

  const res = await fetch(EXERCISE_URL);
  if (!res.ok) throw new Error(`Failed to load exercises.json: ${res.status}`);
  const data = await res.json();

  if (!Array.isArray(data)) throw new Error("exercises.json must be an array");
  _exerciseCache = data;
}

async function fetchExerciseSkill(exId) {
  await loadExerciseCache();

  // Most common: by numeric id
  let ex = _exerciseCache.find(x => String(x?.id) === String(exId));

  // If someone typed "ex:push up" accidentally, try name fallback
  if (!ex && typeof exId === "string" && /[a-z]/i.test(exId)) {
    ex = findExerciseByName(exId);
  }

  if (!ex) return null;
  return normalizeExerciseToSkill(ex);
}

async function fetchExerciseSkillByName(name) {
  await loadExerciseCache();
  const ex = findExerciseByName(name);
  if (!ex) return null;
  return normalizeExerciseToSkill(ex);
}

function findExerciseByName(name) {
  const q = String(name || "").toLowerCase().trim();
  if (!q) return null;

  // exact match first
  let ex = _exerciseCache.find(x => String(x?.name || "").toLowerCase().trim() === q);
  if (ex) return ex;

  // contains match next
  ex = _exerciseCache.find(x => String(x?.name || "").toLowerCase().includes(q));
  return ex || null;
}

async function fetchYogaSkill(yogaId) {
  const url = `${YOGA_BASE}/poses?id=${encodeURIComponent(yogaId)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Yoga API failed: ${res.status}`);
  const pose = await res.json();
  if (!pose || typeof pose !== "object") return null;
  return normalizeYogaToSkill(pose);
}

/* -------------------- Normalize universal skill object -------------------- */

function normalizeExerciseToSkill(ex) {
  const name = String(ex?.name ?? "").trim();
  if (!name) return null;

  const muscles = [
    ...(Array.isArray(ex.primaryMuscles) ? ex.primaryMuscles : []),
    ...(Array.isArray(ex.secondaryMuscles) ? ex.secondaryMuscles : []),
  ].map(m => String(m).toLowerCase().trim()).filter(Boolean);

  return {
    id: `ex:${ex.id}`,
    name,
    type: "exercise",
    category: inferBroadCategoryForExercise(ex),
    difficulty: normalizeExerciseLevel(ex?.level),
    muscles,
    equipment: String(ex?.equipment ?? "").trim() || "Unknown",
  };
}

function normalizeYogaToSkill(p) {
  const name = String(p?.english_name ?? p?.name ?? "").trim();
  if (!name) return null;

  return {
    id: `yoga:${p?.id}`,
    name,
    type: "yoga",
    category: "Stretching",
    difficulty: normalizeYogaDifficulty(p?.difficulty_level ?? p?.level),
    muscles: inferMusclesFromYogaCategory(p?.category_name),
    equipment: "None",
  };
}

function inferBroadCategoryForExercise(ex) {
  const name = safeStr(ex?.name);
  const cat = safeStr(ex?.category);

  const cardioHints = ["run", "sprint", "jump rope", "burpee", "row", "bike", "cycling", "cardio"];
  if (cardioHints.some(k => name.includes(k) || cat.includes(k))) return "Cardio";

  const stretchHints = ["stretch", "mobility", "flexibility"];
  if (stretchHints.some(k => name.includes(k) || cat.includes(k))) return "Stretching";

  return "Strength";
}

function normalizeExerciseLevel(level) {
  if (!level) return "Unknown";
  const v = String(level).toLowerCase();
  if (v.includes("begin")) return "Beginner";
  if (v.includes("inter")) return "Intermediate";
  if (v.includes("adv")) return "Advanced";
  return "Unknown";
}

function normalizeYogaDifficulty(v) {
  const s = String(v ?? "").toLowerCase().trim();
  if (!s) return "Unknown";
  if (s.includes("begin")) return "Beginner";
  if (s.includes("inter")) return "Intermediate";
  if (s.includes("expert")) return "Advanced";
  if (s.includes("adv")) return "Advanced";
  return "Unknown";
}

function inferMusclesFromYogaCategory(categoryName) {
  const c = String(categoryName ?? "").toLowerCase();
  const muscles = new Set();

  if (c.includes("core")) ["abdominals", "obliques"].forEach(m => muscles.add(m));
  if (c.includes("hip")) ["hip flexors", "glutes"].forEach(m => muscles.add(m));
  if (c.includes("hamstring")) muscles.add("hamstrings");
  if (c.includes("backbend") || c.includes("back")) ["lower back", "spinal erectors"].forEach(m => muscles.add(m));
  if (c.includes("chest")) ["chest", "shoulders"].forEach(m => muscles.add(m));
  if (c.includes("shoulder")) muscles.add("shoulders");
  if (c.includes("twist")) ["obliques", "spine"].forEach(m => muscles.add(m));
  if (c.includes("balance")) ["core", "feet"].forEach(m => muscles.add(m));

  return Array.from(muscles);
}

/* -------------------- UI -------------------- */

function renderSkillCard(s) {
  const muscles = Array.isArray(s.muscles) ? s.muscles.slice(0, 4) : [];
  const chips = (muscles.length ? muscles : ["—"])
    .map(m => `<span class="chip">${escapeHtml(m)}</span>`)
    .join("");

  const idEnc = encodeURIComponent(s.id);

  return `
    <div class="panel">
      <h3 style="margin-top:0;">${escapeHtml(s.name ?? "Unnamed")}</h3>
      <p class="small skill-meta">
        ${escapeHtml(s.type)} • ${escapeHtml(s.category)} • ${escapeHtml(s.difficulty)}
      </p>
      <p class="small skill-meta">Equipment: ${escapeHtml(s.equipment)}</p>

      <div class="chips">${chips}</div>

      <div class="row wrap" style="margin-top:12px;">
        <a class="btn primary" href="skill.html?id=${idEnc}">View</a>
        <button class="btn danger" data-action="remove" data-skill-id="${escapeHtml(s.id)}">Remove</button>
      </div>
    </div>
  `;
}

function renderNotFound() {
  document.getElementById("routine-title").textContent = "Routine not found";
  document.getElementById("routine-subtitle").textContent = "Go back to Routines and create one.";
  document.getElementById("items-grid").innerHTML =
    `<div class="panel"><a class="btn primary" href="routines.html">Back to Routines</a></div>`;
}

/* -------------------- Helpers -------------------- */

function getQueryParam(key) {
  const url = new URL(window.location.href);
  return url.searchParams.get(key);
}

function isValidSkillId(id) {
  return typeof id === "string" && (id.startsWith("ex:") || id.startsWith("yoga:"));
}

function setStatus(msg) {
  const s = document.getElementById("status");
  if (s) s.textContent = msg;
}

function downloadJson(obj, filename) {
  const json = JSON.stringify(obj, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function slugify(s) {
  return String(s ?? "routine")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "routine";
}

function safeStr(v) {
  return (typeof v === "string" ? v : String(v ?? "")).toLowerCase();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}
