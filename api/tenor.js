export default async function handler(req, res) {
  // CORS (harmless if same-origin, useful if you ever host frontend elsewhere)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const key = process.env.TENOR_KEY;
    if (!key) return res.status(500).json({ error: "Missing TENOR_KEY" });

    const q = req.query.q || "man flexing muscles";
    const limit = clampInt(req.query.limit, 1, 30, 20);

    const url =
      `https://tenor.googleapis.com/v2/search` +
      `?q=${encodeURIComponent(q)}` +
      `&key=${encodeURIComponent(key)}` +
      `&limit=${limit}` +
      `&media_filter=gif`;

    const r = await fetch(url);
    if (!r.ok) return res.status(502).json({ error: "Tenor request failed" });

    const data = await r.json();
    const results = Array.isArray(data.results) ? data.results : [];
    if (!results.length) return res.status(200).json({ gifUrl: null });

    const pick = results[Math.floor(Math.random() * results.length)];
    const gifUrl = pick?.media_formats?.gif?.url || null;

    // Cache a bit to reduce API hits
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ gifUrl });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
