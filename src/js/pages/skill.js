// src/js/pages/skill.js
// Skill Card = fetch full data by ID every time (rehydrate)

const MY_SKILLS_KEY = "rocksolid_my_skills_v1";
const ROUTINES_KEY = "rocksolid_routines_v1";

// Data sources
const EXERCISE_URL = "/src/data/exercises.json";
const YOGA_BASE = "https://yoga-api-nzy4.onrender.com/v1";

document.addEventListener("DOMContentLoaded", async () => {
  const id = new URLSearchParams(location.search).get("id");
  if (!id) return setStatus("Missing skill id in URL.");

  setStatus("Loading skill…");

  try {
    const skill = await fetchSkillById(id);
    if (!skill) {
      setStatus("Skill not found. Try opening it again from Skill Search.");
      return;
    }

    renderSkill(skill);

    // Save / routines buttons
    el("save-skill-btn")?.addEventListener("click", () => {
      saveToMySkills(skill);
      setStatus("Saved to My Skills ✅");
    });

    el("add-to-routine-btn")?.addEventListener("click", () => {
      addSkillToRoutineFlow(skill);
    });

    setStatus("Ready");
  } catch (err) {
    console.error(err);
    setStatus("Failed to load skill. Check console/network.");
  }
});

/* ----------------- Fetch by ID (rehydrate) ----------------- */

async function fetchSkillById(id) {
  // Convention: ex:123 or yoga:456
  if (id.startsWith("ex:")) {
    const exId = id.slice(3);
    return await fetchExerciseSkill(exId);
  }

  if (id.startsWith("yoga:")) {
    const yogaId = id.slice(5);
    return await fetchYogaSkill(yogaId);
  }

  // If someone passed an un-prefixed ID, try both (fallback)
  return (await fetchExerciseSkill(id)) || (await fetchYogaSkill(id));
}

async function fetchExerciseSkill(exId) {
  const res = await fetch(EXERCISE_URL);
  if (!res.ok) throw new Error(`Failed to load exercises.json: ${res.status}`);

  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("exercises.json must be an array");

  // Exercise DB ids might be number or string; compare loosely
  const ex = data.find((x) => String(x?.id) === String(exId));
  if (!ex) return null;

  return normalizeExerciseToSkill(ex);
}

async function fetchYogaSkill(yogaId) {
  const url = `${YOGA_BASE}/poses?id=${encodeURIComponent(yogaId)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Yoga API failed: ${res.status}`);

  const pose = await res.json();
  if (!pose || typeof pose !== "object") return null;

  return normalizeYogaToSkill(pose);
}

/* ----------------- Normalize to your universal skill object ----------------- */
/**
 * Universal skill object:
 * (ID: unique identifier), (Name), (type: yoga/exercise),
 * (category: Strength/Cardio/Stretching), Difficulty, Muscles, equipment
 *
 * For Skill Card display we also support optional: instructions (exercise only)
 */

function normalizeExerciseToSkill(ex) {
  const name = String(ex?.name ?? "").trim();
  if (!name) return null;

  const muscles = [
    ...(Array.isArray(ex.primaryMuscles) ? ex.primaryMuscles : []),
    ...(Array.isArray(ex.secondaryMuscles) ? ex.secondaryMuscles : []),
  ]
    .map((m) => String(m).toLowerCase().trim())
    .filter(Boolean);

  const equipment = String(ex?.equipment ?? "").trim() || "Unknown";

  const category = inferBroadCategoryForExercise(ex);

  return {
    id: `ex:${ex.id}`,
    name,
    type: "exercise",
    category, // Strength/Cardio/Stretching
    difficulty: normalizeExerciseLevel(ex?.level),
    muscles,
    equipment,

    // ✅ Exercise-only (for instructions box)
    instructions: normalizeInstructions(ex?.instructions),
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
    // No instructions for yoga in this schema (leave undefined)
  };
}

/* ----------------- Render ----------------- */

function renderSkill(skill) {
  el("skill-name").textContent = skill.name ?? "Unnamed";
  el("skill-subtitle").textContent = `${skill.type ?? "?"} • ${skill.category ?? "?"}`;

  el("skill-type").textContent = skill.type ?? "—";
  el("skill-category").textContent = skill.category ?? "—";
  el("skill-difficulty").textContent = skill.difficulty ?? "—";
  el("skill-equipment").textContent = skill.equipment ?? "—";

  renderMuscles(skill);
  renderInstructionsBox(skill);
}

function renderMuscles(skill) {
  const host = el("skill-muscles");
  if (!host) return;

  host.innerHTML = "";
  const muscles = Array.isArray(skill.muscles) ? skill.muscles : [];

  if (!muscles.length) {
    host.innerHTML = `<span class="chip">None listed</span>`;
    return;
  }

  muscles.forEach((m) => {
    const span = document.createElement("span");
    span.className = "chip";
    span.textContent = String(m);
    host.appendChild(span);
  });
}

function renderInstructionsBox(skill) {
  const section = el("instructions-section");
  const list = el("instructions-list");
  const fallback = el("instructions-fallback");
  if (!section || !list || !fallback) return;

  const type = String(skill.type ?? "").toLowerCase();
  if (type !== "exercise") {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";
  list.innerHTML = "";
  fallback.style.display = "none";

  const steps = Array.isArray(skill.instructions) ? skill.instructions : [];
  const cleaned = steps.map((s) => String(s).trim()).filter(Boolean);

  if (!cleaned.length) {
    fallback.style.display = "block";
    return;
  }

  cleaned.forEach((step) => {
    const li = document.createElement("li");
    li.textContent = step;
    list.appendChild(li);
  });
}

/* ----------------- My Skills ----------------- */

function saveToMySkills(skill) {
  const list = safeParse(localStorage.getItem(MY_SKILLS_KEY), []);
  if (!list.some((s) => s?.id === skill.id)) list.push(skill);
  localStorage.setItem(MY_SKILLS_KEY, JSON.stringify(list));
}

/* ----------------- Routines ----------------- */

function addSkillToRoutineFlow(skill) {
  const routines = safeParse(localStorage.getItem(ROUTINES_KEY), []);

  if (!routines.length) {
    const newRoutine = {
      id: `routine:${Date.now()}`,
      name: "My Routine",
      createdAt: new Date().toISOString(),
      items: [skill],
    };
    localStorage.setItem(ROUTINES_KEY, JSON.stringify([newRoutine]));
    setStatus(`Created "My Routine" and added skill ✅`);
    return;
  }

  const names = routines.map((r, i) => `${i + 1}: ${r.name}`).join("\n");
  const pick = prompt(`Add to which routine?\n${names}\n\nEnter a number:`);

  const idx = Number.parseInt(pick, 10) - 1;
  if (Number.isNaN(idx) || idx < 0 || idx >= routines.length) {
    setStatus("Cancelled (no routine selected).");
    return;
  }

  const r = routines[idx];
  r.items = Array.isArray(r.items) ? r.items : [];
  if (!r.items.some((s) => s?.id === skill.id)) r.items.push(skill);

  routines[idx] = r;
  localStorage.setItem(ROUTINES_KEY, JSON.stringify(routines));
  setStatus(`Added to "${r.name}" ✅`);
}

/* ----------------- Helpers ----------------- */

function inferBroadCategoryForExercise(ex) {
  const name = safeStr(ex?.name);
  const cat = safeStr(ex?.category);

  const cardioHints = ["run", "sprint", "jump rope", "burpee", "row", "bike", "cycling", "cardio"];
  if (cardioHints.some((k) => name.includes(k) || cat.includes(k))) return "Cardio";

  const stretchHints = ["stretch", "mobility", "flexibility"];
  if (stretchHints.some((k) => name.includes(k) || cat.includes(k))) return "Stretching";

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

function normalizeInstructions(v) {
  if (!v) return [];

  if (Array.isArray(v)) {
    return v.map((s) => String(s).trim()).filter(Boolean);
  }

  const s = String(v).trim();
  if (!s) return [];

  const byLines = s.split(/\r?\n+/).map(x => x.trim()).filter(Boolean);
  if (byLines.length > 1) return byLines;

  const bySentences = s.split(/\. +/).map(x => x.trim()).filter(Boolean);
  return bySentences.length > 1 ? bySentences : [s];
}

function el(id) {
  return document.getElementById(id);
}

function setStatus(msg) {
  const status = el("skill-status");
  if (status) status.textContent = msg;
}

function safeParse(raw, fallback) {
  try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}

function safeStr(v) {
  return (typeof v === "string" ? v : String(v ?? "")).toLowerCase();
}
