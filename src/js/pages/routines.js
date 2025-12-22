// ../js/pages/routines.js
// Minimal routines MVP: create + list + delete (IDs-only items for later)

const ROUTINES_KEY = "rocksolid_routines_v1";

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
      items: [] // later: ["ex:123", "yoga:55"]
    };

    routines.push(routine);
    setRoutines(routines);

    nameInput.value = "";
    renderRoutines();
  });

  // Render on load
  renderRoutines();
});

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

function getRoutines() {
  try {
    const raw = localStorage.getItem(ROUTINES_KEY);
    const data = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(data)) return [];
    return data
      .map(normalizeRoutine)
      .filter(Boolean);
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
    items
  };
}

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
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}
