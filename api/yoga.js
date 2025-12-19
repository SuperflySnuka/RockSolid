const YOGA_BASE = "https://yoga-api-nzy4.onrender.com/v1";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    // route=poses | categories
    const route = (req.query.route || "poses").toLowerCase();
    const allowed = new Set(["poses", "categories"]);
    if (!allowed.has(route)) {
      return res.status(400).json({ error: "Invalid route. Use poses or categories." });
    }

    const url = new URL(`${YOGA_BASE}/${route}`);

    // pass-through filters supported by the public API
    // common ones: name, level, id (varies; harmless to forward)
    for (const key of ["name", "level", "id", "category"]) {
      if (req.query[key]) url.searchParams.set(key, String(req.query[key]));
    }

    const r = await fetch(url.toString());
    if (!r.ok) return res.status(502).json({ error: "Yoga API request failed" });

    const data = await r.json();

    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=600");
    return res.status(200).json(data);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}
