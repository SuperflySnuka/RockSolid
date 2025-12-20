// src/js/pages/skill-search.js

const EXERCISE_URL = "/src/data/exercises.json";
const SKILLS_CACHE_KEY = "rocksolid_skills_cache_v1";

let ALL_SKILLS = [];

document.addEventListener("DOMContentLoaded", async () => {
  console.log("SKILL SEARCH JS CONNECTED ✅");

  const host = document.getElementById("results-grid");
  const status = document.getElementById("search-status");
  const count = document.getElementById("results-count");

  const form = document.getElementById("search-form");
  const clearBtn = document.getElementById("clear-btn");

  const queryEl = document.getElementById("query");
  const typeEl = document.getElementById("filter-type"); // Strength/Balance/Flexibility in your UI (we map below)
  const diffEl = document.getElementById("filter-difficulty");
  const muscleEl = document.getElementById("filter-muscle");

  if (!host || !status || !form || !queryEl || !typeEl || !diffEl || !muscleEl) {
    console.error("Missing required DOM elements on Skill Search page.");
    return;
  }

  host.innerHTML = `<div class="panel"><p class="small">Loading skills…</p></div>`;
  status.textContent = "Loading…";

  try {
    const exercises = await loadExerciseDb();
    const exerciseSkills = exercises.map(normalizeExerciseToSkill).filter(Boolean);

    // Future: yogaSkills gets merged here too
    // const yogaSkills = await loadYogaSkills();
    // ALL_SKILLS = [...exerciseSkills, ...yogaSkills];

    ALL_SKILLS = [...exerciseSkills];

    // Cache for Skill Card page
    sessionStorage.setItem(SKILLS_CACHE_KEY, JSON.stringify(ALL_SKILLS));

    status.textContent = `Loaded ${ALL_SKILLS.length} skills`;
    runSearch();
  } catch (e) {
    console.error(e);
    status.textContent = "Failed to load skills";
    host.innerHTML = `
      <div class="panel">
        <p class="small">
          Could not load <code>${EXERCISE_URL}</code>.
          Check Live Server + Network tab (should be 200).
        </p>
      </div>
    `;
    return;
  }

  // Events
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    runSearch();
  });

  clearBtn?.addEventListener("click", () => {
    queryEl.value = "";
    typeEl.value = "";
    diffEl.value = "";
    muscleEl.value = "";
    runSearch();
  });

  queryEl.addEventListener("input", debounce(runSearch, 150));
  typeEl.addEventListener("change", runSearch);
  diffEl.addEventListener("change", runSearch);
  muscleEl.addEventListener("change", runSearch);

  function runSearch() {
    const q = queryEl.value.trim().toLowerCase();
    const uiType = typeEl.value.trim().toLowerCase();      // strength/balance/flexibility (your UI)
    const difficulty = normalizeDifficulty(diffEl.value);  // Beginner/Intermediate/Advanced/Unknown
    const muscle = muscleEl.value.trim().toLowerCase();

    status.textContent = "Filtering…";

    const filtered = ALL_SKILLS
      .filter((s) => matchesQuerySkill(s, q))
      .filter((s) => matchesUiType(s, uiType))
      .filter((s) => matchesDifficultySkill(s, difficulty))
      .filter((s) => matchesMuscleSkill(s, muscle));

    filtered.sort((a, b) => safeStr(a.name).localeCompare(safeStr(b.name)));

    renderTable(host, filtered.slice(0, 200));

    status.textContent = "Ready";
    if (count) {
      count.textContent = `${filtered.length} result(s)${filtered.length > 200 ? " (showing first 200)" : ""}`;
    }
  }
});

/* ----------------- load + normalize ----------------- */

async function loadExerciseDb() {
  const res = await fetch(EXERCISE_URL);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("exercises.json must be an array");
  return data;
}

/**
 * Universal skill object:
 * (id, name, type, category, difficulty, muscles, equipment)
 */
function normalizeExerciseToSkill(ex) {
  const name = (ex?.name ?? "").trim();
  if (!name) return null;

  const muscles = [
    ...(Array.isArray(ex.primaryMuscles) ? ex.primaryMuscles : []),
    ...(Array.isArray(ex.secondaryMuscles) ? ex.secondaryMuscles : []),
  ]
    .map((m) => String(m).toLowerCase().trim())
    .filter(Boolean);

  const equipment = (ex?.equipment ?? "").toString().trim() || "Unknown";

  // Your broad buckets: Strength/Cardio/Stretching
  // Exercise DB doesn’t always give enough to perfectly classify.
  // We default to Strength with a tiny heuristic for cardio.
  const category = inferBroadCategoryForExercise(ex);

  return {
    id: `ex:${ex.id ?? slug(name)}`,
    name,
    type: "exercise",
    category,                 // Strength/Cardio/Stretching
    difficulty: normalizeExerciseLevel(ex.level),
    muscles,
    equipment,
  };
}

function normalizeExerciseLevel(level) {
  if (!level) return "Unknown";

  const v = String(level).toLowerCase();

  if (v.includes("begin")) return "Beginner";
  if (v.includes("inter")) return "Intermediate";
  if (v.includes("adv")) return "Advanced";

  return "Unknown";
}

function inferBroadCategoryForExercise(ex) {
  const name = safeStr(ex?.name);
  const cat = safeStr(ex?.category);

  // Heuristic cardio keywords (adjust later if needed)
  const cardioHints = ["run", "sprint", "jump rope", "burpee", "row", "bike", "cycling", "cardio"];
  if (cardioHints.some((k) => name.includes(k) || cat.includes(k))) return "Cardio";

  // If category suggests stretching
  const stretchHints = ["stretch", "mobility", "flexibility"];
  if (stretchHints.some((k) => name.includes(k) || cat.includes(k))) return "Stretching";

  return "Strength";
}

/* ----------------- filtering on universal skill ----------------- */

function matchesQuerySkill(skill, q) {
  if (!q) return true;
  const hay = [
    skill.name,
    skill.type,
    skill.category,
    skill.difficulty,
    skill.equipment,
    ...(Array.isArray(skill.muscles) ? skill.muscles : []),
  ]
    .map((v) => safeStr(v))
    .join(" | ");

  return hay.includes(q);
}

// Your UI "Type" dropdown is strength/balance/flexibility, but your universal object uses category Strength/Cardio/Stretching.
// We map UI values to what we can match.
function matchesUiType(skill, uiType) {
  if (!uiType) return true;

  const broad = safeStr(skill.category); // strength/cardio/stretching

  if (uiType === "strength") return broad === "strength";
  if (uiType === "flexibility") return broad === "stretching";

  // Balance isn't a broad category we store; approximate by name keywords for now
  if (uiType === "balance") {
    const n = safeStr(skill.name);
    return n.includes("balance") || n.includes("stand") || n.includes("pose") || n.includes("handstand");
  }

  return true;
}

function normalizeDifficulty(v) {
  const s = (v ?? "").toString().trim().toLowerCase();
  if (!s) return ""; // Any

  if (s === "beginner") return "beginner";
  if (s === "intermediate") return "intermediate";
  if (s === "advanced") return "advanced";

  return s;
}

function matchesDifficultySkill(skill, difficulty) {
  if (!difficulty) return true;
  return safeStr(skill.difficulty) === difficulty;
}

function matchesMuscleSkill(skill, muscleFilter) {
  if (!muscleFilter) return true;
  const muscles = Array.isArray(skill.muscles) ? skill.muscles.map(safeStr) : [];
  return muscles.some((m) => m.includes(muscleFilter));
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
      const difficulty = escapeHtml(s.difficulty ?? "Unknown");

      return `
        <tr>
          <td><a href="/src/pages/skill.html?id=${id}"><strong>${name}</strong></a></td>
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
      <p class="small" style="margin-top:10px; opacity:0.85;">
        Click a skill name to open the Skill Card.
      </p>
    </div>
  `;
}

/* ----------------- utilities ----------------- */

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

function slug(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
