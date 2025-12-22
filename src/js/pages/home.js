/*idk yet */
// src/js/pages/home.js

// tenor faluire gif
const DEFAULT_GIF_URL = "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExcGV1bTg3eWtjZndvZ2R2bGRqazZ4MTNzaW4zc2hzcmVlOThjZXgxdSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/t9lBEE2FGMzbY9s5IX/giphy.gif";

// 2) tenor query:
const TENOR_QUERY = "man flexing muscles";

// 3) Backend endpoint:
const TENOR_ENDPOINT = "/api/tenor";

document.addEventListener("DOMContentLoaded", () => {
  // If you have a page title element, set it here (optional)
  const titleEl = document.getElementById("project-title");
  if (titleEl) titleEl.textContent = "RockSolid";

  // Load gif (Tenor -> fallback)
  loadFlexGif();
});

async function loadFlexGif() {
  const host = document.getElementById("flex-gif");
  const status = document.getElementById("gif-status");
  if (!host) return;

  // Always show something immediately
  if (DEFAULT_GIF_URL && !DEFAULT_GIF_URL.includes("PASTE_YOUR")) {
    renderGif(host, DEFAULT_GIF_URL, "Default flex gif");
    if (status) status.textContent = "Loaded default gif 💪";
  } else {
    host.innerHTML = `
      <div class="panel">
        <p class="small" style="margin:0;">
          No default GIF URL set yet. Add it in <code>src/js/pages/home.js</code>.
        </p>
      </div>
    `;
    if (status) status.textContent = "Default GIF missing";
  }

  // Try Tenor backend after
  try {
    if (status) status.textContent = "Trying Tenor…";

    const url = `${TENOR_ENDPOINT}?q=${encodeURIComponent(TENOR_QUERY)}&limit=20`;
    const res = await fetch(url);

    // If backend not working yet, this will likely be 404 → handled below
    if (!res.ok) throw new Error(`Backend request failed: ${res.status}`);

    const data = await res.json();
    const gifUrl = data?.gifUrl;

    if (!gifUrl) throw new Error("No gifUrl returned");

    renderGif(host, gifUrl, "Random flex gif");
    if (status) status.textContent = "Flex acquired 💪";
  } catch (err) {
    // Keep default gif and just report fallback
    console.warn("[home.js] Tenor failed, using default GIF:", err);
    if (status) status.textContent = "Using default gif (Tenor unavailable)";
  }
}

function renderGif(host, url, alt) {
  host.innerHTML = `<img src="${escapeAttr(url)}" alt="${escapeAttr(alt)}">`;
}

// Very small safety: prevent quotes from breaking attributes
function escapeAttr(s) {
  return String(s).replace(/"/g, "&quot;");
}
