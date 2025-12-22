// src/js/pages/my-skills.js
// signed export file. IDs-only storage. Rehydrate for display.

const MY_SKILLS_KEY = "rocksolid_my_skills_v1";
const SIGNATURE_MY_SKILLS = "RockSolidMySkills/v1";

// Data sources
const EXERCISE_URL = "/src/data/exercises.json";
const YOGA_BASE = "https://yoga-api-nzy4.onrender.com/v1";

document.addEventListener("DOMContentLoaded", () => {
  const grid = el("my-skills-grid");
  if (!grid) return;

  el("export-btn")?.addEventListener("click", exportMySkills);
  el("clear-btn")?.addEventListener("click", clearAll);
  el("import-file")?.addEventListener("change", onImportFile);

  render();
});

async function render() {
  const grid = el("my-skills-grid");
  const ids = getMySkillIds();

  if (!ids.length) {
    grid.innerHTML = `<div class="panel"><p class="small">No saved skills yet.</p></div>`;
    setStatus(`Tip: open Skill Search → click a skill → "Save to My Skills".`);
    return;
  }

  setStatus("Loading saved skills…");

  const settled = await Promise.allSettled(ids.map(fetchSkillById));
  const skills = settled
    .filter(r => r.status === "fulfilled" && r.value)
    .map(r => r.value);

  const failedCount = ids.length - skills.length;
  setStatus(
    failedCount > 0
      ? `Loaded ${skills.length}/${ids.length}. (${failedCount} failed to load)`
      : `Loaded ${skills.length} skills.`
  );

  skills.sort((a, b) => safeStr(a.name).localeCompare(safeStr(b.name)));
  grid.innerHTML = skills.map(renderCard).join("");

  // actions (remove)
  grid.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    if (btn.dataset.action === "remove") {
      removeId(btn.dataset.id);
      render();
    }
  }, { once: true });
}

/* ---------- Export / Import ---------- */

function exportMySkills() {
  const ids = getMySkillIds();

  const payload = {
    rocksolid: SIGNATURE_MY_SKILLS,
    exportedAt: new Date().toISOString(),
    data: { items: ids },
  };

  downloadJson(payload, `my-skills-${yyyyMMdd(new Date())}.rocksolid.json`);
  setStatus(`Exported ${ids.length} skill id(s).`);
}

async function onImportFile(evt) {
  const file = evt.target.files?.[0];
  if (!file) return;

  try {
    const payload = JSON.parse(await file.text());

    if (!payload || payload.rocksolid !== SIGNATURE_MY_SKILLS) {
      throw new Error("Not a RockSolid My Skills file (signature mismatch).");
    }

    const items = payload?.data?.items;
    if (!Array.isArray(items) || !items.every(x => typeof x === "string")) {
      throw new Error("Invalid file: data.items must be an array of strings.");
    }

    const cleaned = items.map(s => s.trim()).filter(Boolean).filter(isValidSkillId);
    if (!cleaned.length) throw new Error("File contained no valid skill ids.");

    const merged = dedupe([...getMySkillIds(), ...cleaned]);
    setMySkillIds(merged);

    setStatus(`Imported ${cleaned.length} id(s). Total now: ${merged.length}.`);
    evt.target.value = "";
    render();
  } catch (err) {
    console.error(err);
    setStatus(`Import failed: ${err.message}`);
    evt.target.value = "";
  }
}

/* ---------- Local storage ---------- */

function getMySkillIds() {
  const ids = safeParse(localStorage.getItem(MY_SKILLS_KEY), []);
  return Array.isArray(ids) ? ids.filter(isValidSkillId) : [];
}

function setMySkillIds(ids) {
  localStorage.setItem(MY_SKILLS_KEY, JSON.stringify(dedupe(ids)));
}

function removeId(id) {
  const next = getMySkillIds().filter(x => x !== id);
  setMySkillIds(next);
  setStatus("Removed.");
}

function clearAll() {
  localStorage.removeItem(MY_SKILLS_KEY);
  setStatus("Cleared My Skills.");
  render();
}

/* ---------- Rehydrate by id ---------- */
//matches ids to skill objects
async function fetchSkillById(id) {
  if (id.startsWith("ex:")) return await fetchExerciseSkill(id.slice(3));
  if (id.startsWith("yoga:")) return await fetchYogaSkill(id.slice(5));
  return (await fetchExerciseSkill(id)) || (await fetchYogaSkill(id));
}

let _exerciseCache = null;

async function fetchExerciseSkill(exId) {
  if (!_exerciseCache) {
    const res = await fetch(EXERCISE_URL);
    if (!res.ok) throw new Error(`Failed to load exercises.json: ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("exercises.json must be an array");
    _exerciseCache = data;
  }

  const ex = _exerciseCache.find(x => String(x?.id) === String(exId));
  if (!ex) return null;
  return normalizeExerciseToSkill(ex);
}

async function fetchYogaSkill(yogaId) {
  const url = `https://yoga-api-nzy4.onrender.com/v1/poses?id=${encodeURIComponent(yogaId)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Yoga API failed: ${res.status}`);
  const pose = await res.json();
  if (!pose || typeof pose !== "object") return null;
  return normalizeYogaToSkill(pose);
}

/* ---------- Normalize (universal skill object) ---------- */

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

function normalizeYogaToSkill(skillInfo) {
  const name = String(skillInfo?.english_name ?? skillInfo?.name ?? "").trim();
  if (!name) return null;

  return {
    id: `yoga:${skillInfo?.id}`,
    name,
    type: "yoga",
    category: "Stretching",
    difficulty: normalizeYogaDifficulty(skillInfo?.difficulty_level ?? skillInfo?.level),
    muscles: inferMusclesFromYogaCategory(skillInfo?.category_name),
    equipment: "None",
  };
}
//this doesnt wark but was fun to try
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

function normalizeYogaDifficulty(level) {
  const s = String(level ?? "").toLowerCase().trim();
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

/* ---------- Rendering ---------- */

function renderCard(skillInfo) {
  const idEnc = encodeURIComponent(skillInfo.id);
  const muscles = Array.isArray(skillInfo.muscles) ? skillInfo.muscles.slice(0, 4) : [];
  const chips = (muscles.length ? muscles : ["—"])
    .map(m => `<span class="chip">${escapeHtml(m)}</span>`)
    .join("");

  return `
    <div class="panel">
      <h3 style="margin-top:0;">${escapeHtml(skillInfo.name ?? "Unnamed")}</h3>
      <p class="small skill-meta">
        ${escapeHtml(skillInfo.type ?? "?")} • ${escapeHtml(skillInfo.category ?? "?")} • ${escapeHtml(skillInfo.difficulty ?? "Unknown")}
      </p>
      <p class="small skill-meta">Equipment: ${escapeHtml(skillInfo.equipment ?? "Unknown")}</p>

      <div class="chips">${chips}</div>

      <div class="row wrap" style="margin-top:12px;">
        <a class="btn primary" href="/src/pages/skill.html?id=${idEnc}">View</a>
        <button class="btn" data-action="remove" data-id="${escapeHtml(skillInfo.id)}">Remove</button>
      </div>
    </div>
  `;
}

/* ---------- Utilities ---------- */
//basically just ripped from the internet
function isValidSkillId(id) {
  return typeof id === "string" && (id.startsWith("ex:") || id.startsWith("yoga:"));
}

function dedupe(arr) {
  return Array.from(new Set(arr));
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

function yyyyMMdd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function safeParse(raw, fallback) {
  try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}

function safeStr(v) {
  return (typeof v === "string" ? v : String(v ?? "")).toLowerCase();
}

function el(id) {
  return document.getElementById(id);
}

function setStatus(msg) {
  const s = el("status");
  if (s) s.textContent = msg;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}
