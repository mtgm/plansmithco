// CommonJS
const fs = require("fs");
const path = require("path");

/**
 * GET /api/resolve?sku=SBRV2
 * -> { ok:true, sku:"SBRV2", key:"SBR-v2.glb" }
 */
module.exports = (req, res) => {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const rawSku = (url.searchParams.get("sku") || "").trim();
    if (!rawSku) return res.status(400).json({ ok: false, error: "Missing sku" });

    const sku = rawSku.toUpperCase();
    const file = path.join(process.cwd(), "data", "models.json");
    const map = JSON.parse(fs.readFileSync(file, "utf8"));

    const key = map[sku];
    if (!key) return res.status(404).json({ ok: false, error: "NotFound", sku });

    return res.status(200).json({ ok: true, sku, key });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
