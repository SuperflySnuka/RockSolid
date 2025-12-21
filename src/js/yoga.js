// src/js/yoga.js

const YOGA_BASE = "https://yoga-api-nzy4.onrender.com/v1";

export async function loadYogaSkills() {
  // Pull all poses
  const res = await fetch(`${YOGA_BASE}/poses`);
  if (!res.ok) throw new Error(`Yoga API failed: ${res.status}`);

  const poses = await res.json();
  if (!Array.isArray(poses)) return [];

  return poses.map(normalizeYogaPoseToSkill).filter(Boolean);
}

function normalizeYogaPoseToSkill(p) {
  const name = String(p?.english_name ?? "").trim();
  if (!name) return null;

  const difficulty = normalizeYogaDifficulty(p?.difficulty_level);
  const muscles = inferMusclesFromYogaCategory(p?.category_name);

  return {
    id: `yoga:${p.id}`,                 // unique
    name,
    type: "yoga",
    category: "Stretching",             // your broad buckets: Strength/Cardio/Stretching
    difficulty,                         // Beginner/Intermediate/Advanced/Unknown
    muscles,
    equipment: "None",                  // yoga poses generally none
    // optional extras if you want later:
    // image: p?.url_png || "",
    // benefits: p?.pose_benefits || "",
    // yogaCategory: p?.category_name || "",
  };
}

function normalizeYogaDifficulty(v) {
  const s = String(v ?? "").toLowerCase().trim();
  // API uses Beginner/Intermediate + "Expert" in docs :contentReference[oaicite:4]{index=4}
  if (s.includes("begin")) return "Beginner";
  if (s.includes("inter")) return "Intermediate";
  if (s.includes("expert")) return "Advanced";
  return "Unknown";
}

// Yoga API doesn’t provide muscles directly in the README examples :contentReference[oaicite:5]{index=5}
// So we infer a few common ones from category_name.
// You can expand this any time.
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
