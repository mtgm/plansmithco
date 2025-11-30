module.exports = (req, res) => {
  // VERİTABANI BURADA (Burayı kendi dosya adlarına göre doldur)
  const models = {
    "SBRV2": "SBR-v2.glb",
    "CHAIRV1": "chair-v1.glb",
    "PLANTERV1": "planter.glb"
  };

  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const skuParam = (url.searchParams.get("sku") || "").trim();

    if (!skuParam) {
      return res.status(400).json({ ok: false, error: "SKU Eksik" });
    }

    const sku = skuParam.toUpperCase();
    const key = models[sku];

    if (!key) {
      // Hata varsa 404 dönüyoruz, frontend bunu anlayacak
      return res.status(404).json({ ok: false, error: "Model Bulunamadı", sku: sku });
    }

    return res.status(200).json({ ok: true, key: key });

  } catch (err) {
    return res.status(500).json({ ok: false, error: "Sunucu Hatası", msg: err.message });
  }
};