document.addEventListener('DOMContentLoaded', async () => {
  const host = document.getElementById('flex-gif');
  const status = document.getElementById('gif-status');
  if (!host) return;

  // 1) Put your Tenor API key here
  // Get one from Tenor/Google Cloud and paste it in.
  const TENOR_KEY = "PASTE_YOUR_TENOR_KEY_HERE";

  // If you haven't added a key yet, fail gracefully:
  if (!TENOR_KEY || TENOR_KEY.includes("PASTE_YOUR")) {
    status.textContent = "Tenor key missing (add it in home.js)";
    host.innerHTML = `<p class="small" style="padding:12px; margin:0;">
      Add your Tenor API key in <code>src/js/pages/home.js</code> to load a random flex GIF.
    </p>`;
    return;
  }

  try {
    status.textContent = "Finding the strongest gif...";
    const q = encodeURIComponent("man flexing muscles");
    const url = `https://tenor.googleapis.com/v2/search?q=${q}&key=${TENOR_KEY}&limit=20&media_filter=gif`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Tenor request failed: ${res.status}`);
    const data = await res.json();

    const results = data.results || [];
    if (!results.length) throw new Error("No gifs returned");

    // Pick random gif from results
    const pick = results[Math.floor(Math.random() * results.length)];
    const gifUrl = pick.media_formats?.gif?.url;

    if (!gifUrl) throw new Error("No gif URL found");

    host.innerHTML = `<img src="${gifUrl}" alt="Random flexing gif">`;
    status.textContent = "Flex acquired 💪";
  } catch (err) {
    console.error(err);
    status.textContent = "Couldn’t load gif";
    host.innerHTML = `<p class="small" style="padding:12px; margin:0;">
      Failed to load GIF. Check console for details.
    </p>`;
  }
});
