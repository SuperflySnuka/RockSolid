// src/js/pages/skill-search.js
// Requires Fuse.js to be loaded globally via CDN (window.Fuse)

import { loadYogaSkills } from "../yoga.js";

const EXERCISE_URL = "/src/data/exercises.json";
const SKILLS_CACHE_KEY = "rocksolid_skills_cache_v1";

let ALL_SKILLS = [];
let fuse = null;

document.addEventListener("DOMContentLoaded", async () => {
  console.log("SKILL SEARCH JS CONNECTED ✅");

  // DOM
  const host = document.getElementById("results-grid");
  const status = document.getElementById("search-status");
  const count = document.getElementById("results-count");

  const queryEl = document.getElementById("query");
  const typeEl = document.getElementById("filter-type");         // strength | balance | flexibility
  const diffEl = document.getElementById("filter-difficulty");    // beginner | intermediate | advanced
  const muscleEl = document.getElementById("filter-muscle");     // legs | core | etc.
  const searchBtn = document.getElementById("search-btn");

  if (!host || !status || !queryEl || !typeEl || !diffEl || !muscleEl) {
    console.error("Skill Search: Missing required DOM elements.");
    return;
  }

  host.innerHTML = `<div class="panel"><p class="small">Loading skills…</p></div>`;
  status.textContent = "Loading…";

  // Load data
  try {
    const exercisesRaw = await loadExerciseDb();
    const exerciseSkills = exercisesRaw.map(normalizeExerciseToSkill).filter(Boolean);

    let yogaSkills = [];
    try {
      const yogaRaw = await loadYogaSkills();
      yogaSkills = Array.isArray(yogaRaw) ? yogaRaw.map(normalizeYogaToSkill).filter(Boolean) : [];
    } catch (e) {
      console.warn("Yoga load failed (continuing without yoga):", e);
    }

    ALL_SKILLS = [...exerciseSkills, ...yogaSkills];

    sessionStorage.setItem(SKILLS_CACHE_KEY, JSON.stringify(ALL_SKILLS));

    // Build Fuse index
    buildFuseIndex();

    status.textContent = `Loaded ${ALL_SKILLS.length} skills`;
    runSearch(); // initial render
  } catch (e) {
    console.error(e);
    status.textContent = "Failed to load skills";
    host.innerHTML = `
      <div class="panel">
        <p class="small">
          Failed to load skill data. Check the Network tab for 200 responses.
        </p>
      </div>
    `;
    return;
  }

  // Events
  queryEl.addEventListener("input", debounce(runSearch, 150));
  typeEl.addEventListener("change", runSearch);
  diffEl.addEventListener("change", runSearch);
  muscleEl.addEventListener("change", runSearch);
  searchBtn?.addEventListener("click", runSearch);

  function runSearch() {
    const q = queryEl.value.trim();
    const uiType = typeEl.value.trim().toLowerCase();           // strength|balance|flexibility
    const difficulty = normalizeDifficulty(diffEl.value);        // beginner|intermediate|advanced|""
    const muscle = muscleEl.value.trim().toLowerCase();          // can be "" or "legs" etc.

    status.textContent = "Searching…";

    // 1) Use Fuse for query text (if any), otherwise start with ALL_SKILLS
    let list = ALL_SKILLS;

    if (q) {
      if (!fuse) buildFuseIndex();
      const results = fuse.search(q);
      list = results.map(r => r.item);
    }

    // 2) Apply dropdown filters AFTER fuzzy search
    list = list
      .filter(s => matchesUiType(s, uiType))
      .filter(s => matchesDifficultySkill(s, difficulty))
      .filter(s => matchesMuscleSkill(s, muscle));

    // 3) Sort
    list.sort((a, b) => safeStr(a.name).localeCompare(safeStr(b.name)));

    // 4) Render
    renderTable(host, list.slice(0, 200));

    status.textContent = "Ready";
    if (count) {
      count.textContent = `${list.length} result(s)${list.length > 200 ? " (showing first 200)" : ""}`;
    }
  }
});

/* ----------------- load ----------------- */

async function loadExerciseDb() {
  const res = await fetch(EXERCISE_URL);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("exercises.json must be an array");
  return data;
}

/* ----------------- normalization (universal skill) ----------------- */
/**
 * Universal skill object:
 * id: "ex:123" | "yoga:55"
 * name
 * type: "exercise" | "yoga"
 * category: "Strength" | "Cardio" | "Stretching"
 * difficulty: "beginner"|"intermediate"|"advanced"|"" (unknown -> "")
 * muscles: string[]
 * equipment: string
 * (optional) instructions: string[]
 */

function normalizeExerciseToSkill(ex) {
  const name = String(ex?.name ?? "").trim();
  const rawId = ex?.id;
  if (!name || rawId === undefined || rawId === null) return null;

  const muscles = [
    ...(Array.isArray(ex.primaryMuscles) ? ex.primaryMuscles : []),
    ...(Array.isArray(ex.secondaryMuscles) ? ex.secondaryMuscles : []),
    ex.target,
    ex.bodyPart,
  ]
    .map(v => String(v).toLowerCase().trim())
    .filter(Boolean);

  const equipment = String(ex?.equipment ?? "Unknown").trim();

  // exercises DB uses `level` for difficulty
  const difficulty = normalizeDifficulty(ex?.level ?? ex?.difficulty ?? "");

  const category = inferBroadCategoryForExercise(ex);

  // Some DBs include instructions; keep if present
  const instructions = Array.isArray(ex?.instructions)
    ? ex.instructions.map(s => String(s).trim()).filter(Boolean)
    : [];

  return {
    id: `ex:${rawId}`,
    name,
    type: "exercise",
    category,          // "Strength"|"Cardio"|"Stretching"
    difficulty,        // normalized lowercase or ""
    muscles,
    equipment,
    instructions,
  };
}

function normalizeYogaToSkill(y) {
  // handle both already-normalized and raw yoga-api objects
  if (y && typeof y === "object" && typeof y.id === "string" && (y.id.startsWith("yoga:") || y.type === "yoga")) {
    return {
      id: String(y.id || "").startsWith("yoga:") ? String(y.id) : `yoga:${String(y.id || "").replace("yoga:", "")}`,
      name: String(y.name ?? "").trim(),
      type: "yoga",
      category: normalizeYogaCategory(y.category),
      difficulty: normalizeDifficulty(y.difficulty ?? y.level ?? ""),
      muscles: Array.isArray(y.muscles) ? y.muscles.map(m => String(m).toLowerCase().trim()).filter(Boolean) : [],
      equipment: String(y.equipment ?? "None").trim(),
    };
  }

  const name = String(y?.english_name ?? y?.name ?? "").trim();
  const rawId = y?.id;
  if (!name || rawId === undefined || rawId === null) return null;

  return {
    id: `yoga:${rawId}`,
    name,
    type: "yoga",
    category: "Stretching",
    difficulty: normalizeDifficulty(y?.difficulty ?? y?.level ?? ""),
    muscles: [],
    equipment: "None",
  };
}

function normalizeYogaCategory(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "Stretching";
  if (s.includes("strength")) return "Strength";
  if (s.includes("cardio")) return "Cardio";
  return "Stretching";
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

/* ----------------- Fuse ----------------- */

function buildFuseIndex() {
  if (!window.Fuse) {
    console.warn("Fuse.js not found. Did you include the CDN script tag?");
    fuse = null;
    return;
  }

  fuse = new window.Fuse(ALL_SKILLS, {
    includeScore: true,
    threshold: 0.35, // lower = stricter, higher = fuzzier
    ignoreLocation: true,
    minMatchCharLength: 2,
    keys: [
      { name: "name", weight: 0.5 },
      { name: "muscles", weight: 0.2 },
      { name: "equipment", weight: 0.1 },
      { name: "category", weight: 0.1 },
      { name: "difficulty", weight: 0.05 },
      { name: "type", weight: 0.05 },
    ],
  });
}

/* ----------------- filtering ----------------- */

function matchesUiType(skill, uiType) {
  if (!uiType) return true;

  const cat = safeStr(skill.category); // "strength"|"cardio"|"stretching"
  const name = safeStr(skill.name);

  if (uiType === "strength") return cat === "strength";
  if (uiType === "flexibility") return cat === "stretching";

  if (uiType === "balance") {
    // approximate balance by name keywords
    return (
      name.includes("balance") ||
      name.includes("stand") ||
      name.includes("handstand") ||
      name.includes("pose") ||
      name.includes("one-leg")
    );
  }

  return true;
}

function normalizeDifficulty(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return ""; // Any / Unknown

  if (s === "beginner") return "beginner";
  if (s === "intermediate") return "intermediate";
  if (s === "advanced") return "advanced";

  // common variants
  if (s.includes("begin")) return "beginner";
  if (s.includes("inter")) return "intermediate";
  if (s.includes("adv")) return "advanced";

  return ""; // treat weird values as unknown
}

function matchesDifficultySkill(skill, difficulty) {
  if (!difficulty) return true;
  return safeStr(skill.difficulty) === difficulty;
}

function matchesMuscleSkill(skill, muscleFilter) {
  if (!muscleFilter) return true;

  const muscles = Array.isArray(skill.muscles) ? skill.muscles.map(safeStr) : [];

  // If your dropdown uses broad groups like "legs", let it match sub-muscles
  if (muscleFilter === "legs") {
    const legHints = ["quadriceps", "hamstrings", "calves", "glutes", "adductors", "abductors", "legs", "thigh"];
    return muscles.some(m => legHints.some(h => m.includes(h)));
  }

  if (muscleFilter === "core") {
    const coreHints = ["abdominals", "abs", "core", "obliques", "rectus abdominis", "transverse"];
    return muscles.some(m => coreHints.some(h => m.includes(h)));
  }

  return muscles.some(m => m.includes(muscleFilter));
}

/* ----------------- render table ----------------- */

function renderTable(host, list) {
  if (!list.length) {
    host.innerHTML = `<div class="panel"><p class="small">No results. Try another search.</p></div>`;
    return;
  }

  const rows = list
    .map((s) => {
      const name = escapeHtml(s.name ?? "Unnamed");
      const id = encodeURIComponent(s.id);
      const muscles = escapeHtml((s.muscles || []).slice(0, 4).join(", "));
      const equipment = escapeHtml(s.equipment ?? "Unknown");
      const category = escapeHtml(s.category ?? "Strength");
      const type = escapeHtml(s.type ?? "exercise");
      const difficulty = escapeHtml(s.difficulty || "unknown");

      // IMPORTANT: use relative link so Live Server + Vercel both behave
      return `
        <tr>
          <td><a href="./skill.html?id=${id}"><strong>${name}</strong></a></td>
          <td>${type}</td>
          <td>${category}</td>
          <td>${difficulty}</td>
          <td>${muscles}</td>
          <td>${equipment}</td>
        </tr>
      `;
    })
    .join("");

  host.innerHTML = `
    <div class="panel" style="overflow:auto;">
      <table class="results-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Category</th>
            <th>Difficulty</th>
            <th>Muscles</th>
            <th>Equipment</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

/* ----------------- utils ----------------- */

function safeStr(v) {
  return (typeof v === "string" ? v : String(v ?? "")).toLowerCase();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m]));
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
