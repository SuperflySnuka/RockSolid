export default async function handler(req, res) {
  // CORS (safe even if same-origin)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const key = process.env.TENOR_KEY;
    if (!key) return res.status(500).json({ error: "Missing TENOR_KEY env var" });

    const q = (req.query?.q || "man flexing muscles").toString();
    const limit = clampInt(req.query?.limit, 1, 30, 20);

    const url =
      `https://tenor.googleapis.com/v2/search` +
      `?q=${encodeURIComponent(q)}` +
      `&key=${encodeURIComponent(key)}` +
      `&limit=${limit}` +
      `&media_filter=gif`;

    // ---- HARD TIMEOUT so it never spins forever ----
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    let r;
    try {
      r = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    if (!r.ok) {
      const text = await safeText(r);
      return res.status(502).json({
        error: "Tenor request failed",
        status: r.status,
        details: text?.slice(0, 300) || null
      });
    }

    const data = await r.json();
    const results = Array.isArray(data.results) ? data.results : [];
    if (!results.length) {
      return res.status(200).json({ gifUrl: null });
    }

    const pick = results[Math.floor(Math.random() * results.length)];
    const gifUrl = pick?.media_formats?.gif?.url || null;

    // cache a bit
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ gifUrl });
  } catch (e) {
    // AbortError will land here if Tenor stalls
    const msg = e?.name === "AbortError" ? "Tenor timeout" : "Server error";
    return res.status(500).json({ error: msg });
  }
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

async function safeText(resp) {
  try {
    return await resp.text();
  } catch {
    return null;
  }
}
