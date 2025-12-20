const q = encodeURIComponent("man flexing muscles");
const res = await fetch(`/api/tenor?q=${q}&limit=20`);
if (!res.ok) throw new Error(`Backend request failed: ${res.status}`);
const { gifUrl } = await res.json();
