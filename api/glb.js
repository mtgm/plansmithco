// api/glb.js
export default async function handler(req, res) {
  try {
    // ----------------------------------------------------------------
    // 1) HOTLINK ENGELİ: sadece bu domain(ler)den gelen isteklere izin ver
    // ----------------------------------------------------------------
    const allowedHosts = [
      "plansmithco.vercel.app",     // yeni domainin
      // "localhost:3000",           // yerelde test ediyorsan aç
      // "sbr-neutral.vercel.app",   // eski domaini geçici desteklemek istersen aç
    ];
    const ref = req.headers.referer || "";
    const origin = req.headers.origin || "";
    const hostOk =
      allowedHosts.some(h => ref.includes(h)) ||
      allowedHosts.some(h => origin.includes(h));
    if (!hostOk) {
      return res.status(403).send("Forbidden"); // farklı siteden hotlink denemesi
    }

    // ------------------------------------------------------------
    // 2) DOĞRUDAN GEZİNMEYİ ENGELLE: indirme penceresini kes
    // (adres çubuğunda /api/glb?key=... açılırsa 404 dön)
    // ------------------------------------------------------------
    const accept = req.headers.accept || "";
    if (accept.includes("text/html")) {
      return res.status(404).send("Not Found");
    }

    // ------------------------------------------------------------
    // 3) Hangi GLB?
    // ?key=... yoksa varsayılanı kullan
    // ------------------------------------------------------------
    const url = new URL(req.url, `https://${req.headers.host}`);
    const key = url.searchParams.get("key") || "SBR-v2.glb";

    // ------------------------------------------------------------
    // 4) R2 public endpoint (tarayıcıya gösterilmiyor; server-side fetch)
    //    KENDİ r2.dev adresini burada kullan
    // ------------------------------------------------------------
    const r2PublicBase = "https://pub-c09e063308e5459cb4c5727415475d43.r2.dev";
    const fileUrl = `${r2PublicBase}/${encodeURIComponent(key)}`;

    const r = await fetch(fileUrl);
    if (!r.ok) {
      return res.status(r.status).send("Fetch failed");
    }

    // ------------------------------------------------------------
    // 5) Binary olarak döndür (model-viewer için doğru Content-Type)
    // ------------------------------------------------------------
    res.setHeader("Content-Type", "model/gltf-binary");
    res.setHeader("Cache-Control", "no-store");
    const buf = Buffer.from(await r.arrayBuffer());
    res.end(buf);
  } catch (e) {
    console.error("GLB proxy error:", e);
    res.status(500).send("GLB stream failed");
  }
}
