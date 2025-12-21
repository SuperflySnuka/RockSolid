// src/js/yoga.js

const YOGA_BASE = "https://yoga-api-nzy4.onrender.com/v1";
const LEVELS = ["beginner", "intermediate", "expert"];

/**
 * Load yoga poses and normalize them into your universal skill object:
 * { id, name, type:"yoga", category:"Stretching", difficulty, muscles, equipment }
 *
 * Adaptation:
 * - Fetch by level so we can reliably assign difficulty even if poses omit difficulty_level.
 */
export async function loadYogaSkills() {
  // Fetch all levels in parallel
  const results = await Promise.allSettled(
    LEVELS.map((lvl) => fetchLevel(lvl))
  );

  // Collect poses from successful calls
  const all = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
    else console.warn("[yoga.js] Level fetch failed:", r.reason);
  }

  // Deduplicate by pose id (a pose should only appear in one level, but be safe)
  const byId = new Map();
  for (const s of all) byId.set(s.id, s);

  return Array.from(byId.values());
}

async function fetchLevel(level) {
  const url = `${YOGA_BASE}/poses?level=${encodeURIComponent(level)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Yoga API failed (${level}): ${res.status}`);

  const data = await res.json();

  // Common shapes:
  // 1) { id, difficulty_level, poses: [...] }
  // 2) { poses: [...] }
  // 3) [ ... ]
  const wrapperDifficulty =
    data?.difficulty_level ?? data?.difficultyLevel ?? level;

  const poses = Array.isArray(data)
    ? data
    : (Array.isArray(data?.poses) ? data.poses : []);

  if (!Array.isArray(poses)) return [];

  return poses
    .map((p) => normalizeYogaPoseToSkill(p, wrapperDifficulty))
    .filter(Boolean);
}

function normalizeYogaPoseToSkill(p, fallbackLevel) {
  const name = String(p?.english_name ?? p?.name ?? "").trim();
  if (!name) return null;

  // Prefer pose difficulty_level if present; otherwise use wrapper/fallback level
  const difficulty = normalizeYogaDifficulty(
    p?.difficulty_level ?? p?.difficultyLevel ?? p?.level ?? fallbackLevel
  );

  const muscles = inferMusclesFromYogaCategory(p?.category_name);

  return {
    id: `yoga:${p?.id ?? slug(name)}`,
    name,
    type: "yoga",
    category: "Stretching",
    difficulty, // Beginner/Intermediate/Advanced/Unknown
    muscles,
    equipment: "None",
    // Optional: keep extra data for skill card later:
    // meta: { imageUrl: p?.url_png || "", benefits: p?.pose_benefits || "", yogaCategory: p?.category_name || "" }
  };
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

// Still inference-only (API doesn’t reliably provide muscle lists)
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

function slug(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
