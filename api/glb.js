// CommonJS
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

/**
 * Cloudflare R2'ye PATH-STYLE ile bağlan (TLS/SNI sorunsuz).
 */
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  },
  forcePathStyle: true
});

function mimeFor(key) {
  return key.toLowerCase().endsWith(".glb")
    ? "model/gltf-binary"
    : "application/octet-stream";
}

/**
 * GET /api/glb?key=SBR-v2.glb
 * R2’den stream eder; dosya adı GitHub/R2’de görünmez.
 */
module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const key = (url.searchParams.get("key") || "").trim();
    if (!key) return res.status(400).send("missing key");

    const obj = await r2.send(new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key
    }));

    res.setHeader("Content-Type", mimeFor(key));
    res.setHeader("Cache-Control", "public, max-age=600");
    obj.Body.pipe(res);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
