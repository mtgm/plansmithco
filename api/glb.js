const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// --- R2 ayarları env'den gelir
const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET
} = process.env;

// Tek bir S3 Client (R2 endpoint'ine)
const client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY
  }
});

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const key = url.searchParams.get("key");
    if (!key) return res.status(400).json({ ok: false, error: "Missing key" });

    // 10 dakika imzalı URL
    const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
    const signed = await getSignedUrl(client, command, { expiresIn: 600 });

    // İmzalı URL'den dosyayı çek ve istemciye aktar (R2 linki gözükmez)
    const upstream = await fetch(signed);
    if (!upstream.ok) {
      return res.status(upstream.status).json({ ok: false, error: "UpstreamError" });
    }

    // İçerik tipini koru (GLB)
    const ct = upstream.headers.get("content-type") || "model/gltf-binary";
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "no-store");
    // İstersen indirmeyi engellemek için:
    res.setHeader("Content-Disposition", `inline; filename="${key}"`);

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.status(200).send(buf);
  } catch (err) {
    res.status(500).json({ ok: false, error: "ProxyFailed", message: err.message });
  }
};
