// ../js/pages/routines.js
// Minimal routines MVP: create + list + delete (IDs-only items for later)
// + OPTIONAL Supabase Cloud Sync buttons (Load from Cloud / Save to Cloud)

const ROUTINES_KEY = "rocksolid_routines_v1";

/* -------------------- Supabase API helpers (Vercel) -------------------- */
/**
 * Requires you to have a Vercel Serverless Function at:
 *   /api/routines  (GET returns array, POST saves one)
 *
 * Buttons expected in routines.html (optional):
 *   #load-cloud-btn
 *   #save-cloud-btn
 */
async function loadRoutinesFromCloud() {
  const res = await fetch("/api/routines");
  if (!res.ok) throw new Error(`Cloud load failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function saveRoutineToCloud(routine) {
  const res = await fetch("/api/routines", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: routine.name,
      items: Array.isArray(routine.items) ? routine.items : [],
    }),
  });

  if (!res.ok) throw new Error(`Cloud save failed: ${res.status}`);
  return await res.json();
}

/* -------------------- Page bootstrap -------------------- */

document.addEventListener("DOMContentLoaded", () => {
  const createBtn = document.getElementById("create-routine-btn");
  const nameInput = document.getElementById("routine-name");

  if (!createBtn || !nameInput) {
    console.error("Routines: Missing #create-routine-btn or #routine-name in HTML.");
    return;
  }

  createBtn.addEventListener("click", () => {
    const name = String(nameInput.value || "").trim();
    if (!name) {
      alert("Please enter a routine name.");
      return;
    }

    const routines = getRoutines();

    const routine = {
      id: `routine:${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      items: [], // later: ["ex:123", "yoga:55"]
    };

    routines.push(routine);
    setRoutines(routines);

    nameInput.value = "";
    renderRoutines();
  });

  // OPTIONAL: Cloud Sync buttons (won't break if they don't exist)
  document.getElementById("load-cloud-btn")?.addEventListener("click", async () => {
    try {
      const cloud = await loadRoutinesFromCloud();

      // Normalize cloud rows into the local format
      const normalized = cloud
        .map((r) => ({
          id: `routine:${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: String(r?.name || "").trim() || "Untitled Routine",
          createdAt: r?.created_at || new Date().toISOString(),
          items: Array.isArray(r?.items) ? r.items : [],
        }))
        .map(normalizeRoutine)
        .filter(Boolean);

      setRoutines(normalized);
      renderRoutines();
      alert("Loaded routines from cloud ✅");
    } catch (e) {
      console.error(e);
      alert("Failed to load routines from cloud.");
    }
  });

  document.getElementById("save-cloud-btn")?.addEventListener("click", async () => {
    try {
      const routines = getRoutines();
      if (!routines.length) {
        alert("No routines to save.");
        return;
      }

      // Save the newest routine (simple + safe)
      const newest = routines
        .slice()
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0];

      await saveRoutineToCloud(newest);
      alert(`Saved "${newest.name}" to cloud ✅`);
    } catch (e) {
      console.error(e);
      alert("Failed to save routine to cloud.");
    }
  });

  // Render on load
  renderRoutines();
});

/* -------------------- Render -------------------- */

function renderRoutines() {
  const host = document.getElementById("saved-routines");
  if (!host) {
    console.error("Routines: Missing #saved-routines in HTML.");
    return;
  }

  const routines = getRoutines();

  if (!routines.length) {
    host.innerHTML = `<p class="small">No routines yet. Create one on the left.</p>`;
    return;
  }

  // newest first
  routines.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  host.innerHTML = routines
    .map((r) => {
      const count = Array.isArray(r.items) ? r.items.length : 0;

      return `
        <div class="panel" style="margin-bottom:12px;">
          <h3 style="margin:0;">${escapeHtml(r.name)}</h3>
          <p class="small" style="margin:6px 0 0 0; opacity:.85;">
            ${count} item(s) • ${escapeHtml(formatDate(r.createdAt))}
          </p>

          <div class="row wrap" style="margin-top:12px;">
            <a class="btn primary" href="routine.html?id=${encodeURIComponent(r.id)}">Open</a>
            <button class="btn danger" data-action="delete" data-id="${escapeHtml(r.id)}">Delete</button>
          </div>
        </div>
      `;
    })
    .join("");

  // button handlers (delete)
  host.querySelectorAll('button[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const routinesNow = getRoutines();
      const routine = routinesNow.find((x) => x.id === id);

      if (!routine) return;

      const ok = confirm(`Delete routine "${routine.name}"?`);
      if (!ok) return;

      setRoutines(routinesNow.filter((x) => x.id !== id));
      renderRoutines();
    });
  });
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

function normalizeRoutine(r) {
  if (!r || typeof r !== "object") return null;

  const id = String(r.id || "").trim();
  const name = String(r.name || "").trim();
  if (!id.startsWith("routine:") || !name) return null;

  const items = Array.isArray(r.items) ? r.items.filter((x) => typeof x === "string") : [];

  return {
    id,
    name,
    createdAt: r.createdAt || new Date().toISOString(),
    items,
  };
}

/* -------------------- Helpers -------------------- */

function formatDate(iso) {
  if (!iso) return "Unknown date";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return "Unknown date";
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[m])
  );
}
