// Paste this whole file into the browser console while on https://izzy-shen.vercel.app
// (the browser you edited the site in). It downloads portfolio-export.json containing
// every saved page (localStorage "portfolio-*" keys) plus every uploaded image/video
// (IndexedDB "portfolio-media"), so the content can be baked into the site's code.
(async () => {
  const text = {};
  for (const k of Object.keys(localStorage)) if (k.startsWith("portfolio-")) text[k] = localStorage.getItem(k);
  const media = {};
  try {
    const db = await new Promise((res, rej) => { const r = indexedDB.open("portfolio-media", 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const store = db.transaction("blobs", "readonly").objectStore("blobs");
    const keys = await new Promise((res, rej) => { const r = store.getAllKeys(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const vals = await new Promise((res, rej) => { const r = store.getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    for (let i = 0; i < keys.length; i++) {
      const blob = vals[i];
      media[keys[i]] = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
    }
  } catch (e) { console.warn("media export skipped:", e); }
  const out = JSON.stringify({ exportedAt: new Date().toISOString(), origin: location.origin, text, media });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([out], { type: "application/json" }));
  a.download = "portfolio-export.json";
  a.click();
  console.log(`exported ${Object.keys(text).length} pages and ${Object.keys(media).length} media files (${(out.length / 1e6).toFixed(1)} MB)`);
})();
