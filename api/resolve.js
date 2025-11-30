const fs = require("fs");
const path = require("path");

module.exports = (req, res) => {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const skuParam = (url.searchParams.get("sku") || "").trim();

    if (!skuParam) {
      return res.status(400).json({ ok: false, error: "Missing SKU" });
    }

    const sku = skuParam.toUpperCase();

    // Vercel ortamında dosya yolunu bulmak için en güvenli yöntem:
    // process.cwd() projenin kök dizinini verir.
    const jsonPath = path.join(process.cwd(), "data", "models.json");

    // Debug için: Eğer dosya yoksa hatayı detaylı görelim
    if (!fs.existsSync(jsonPath)) {
      console.error(`Dosya bulunamadı! Aranan yol: ${jsonPath}`);
      // Dizin içeriğini listeleyip ne var ne yok bakalım (Loglarda görünür)
      console.log("Root dizin içeriği:", fs.readdirSync(process.cwd()));
      return res.status(500).json({ ok: false, error: "DatabaseFileMissing", path: jsonPath });
    }

    const raw = fs.readFileSync(jsonPath, "utf8");
    const models = JSON.parse(raw);

    const key = models[sku];

    if (!key) {
      return res.status(404).json({ ok: false, error: "ModelNotFound", requestedSku: sku });
    }

    return res.status(200).json({ ok: true, key });

  } catch (err) {
    console.error("Resolve API Error:", err);
    return res.status(500).json({ ok: false, error: "ServerException", msg: err.message });
  }
};
