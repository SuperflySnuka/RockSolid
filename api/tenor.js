export default async function handler(request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "man flexing muscles";
    const limit = clampInt(url.searchParams.get("limit"), 1, 30, 20);

    const key = process.env.TENOR_KEY;
    if (!key) {
      return Response.json({ error: "Missing TENOR_KEY" }, { status: 500 });
    }

    const tenorUrl =
      `https://tenor.googleapis.com/v2/search` +
      `?q=${encodeURIComponent(q)}` +
      `&key=${encodeURIComponent(key)}` +
      `&limit=${limit}` +
      `&media_filter=gif`;

    const r = await fetch(tenorUrl);
    if (!r.ok) {
      return Response.json({ error: "Tenor request failed" }, { status: 502 });
    }

    const data = await r.json();
    const results = Array.isArray(data.results) ? data.results : [];
    if (!results.length) {
      return Response.json({ gifUrl: null }, { status: 200 });
    }

    const pick = results[Math.floor(Math.random() * results.length)];
    const gifUrl = pick?.media_formats?.gif?.url || null;

    return new Response(JSON.stringify({ gifUrl }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
