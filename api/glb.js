// api/glb.js
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { pipeline } = require("stream");
const { promisify } = require("util");
const pump = promisify(pipeline);

const s3 = new S3Client({
  region: "auto",
  endpoint: "https://pub-c09e063308e5459cb4c5727415475d43.r2.dev",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true, // R2 için gerekli
});

module.exports = async (req, res) => {
  try {
    // Çoklu model: /api/glb?key=dosya.glb
    const url = new URL(req.url, `https://${req.headers.host}`);
    const Key = url.searchParams.get("key") || process.env.R2_KEY || "model.glb";
    const Bucket = process.env.R2_BUCKET;

    // R2'den OBJeyi çek
    const obj = await s3.send(new GetObjectCommand({ Bucket, Key }));

    // İçerik tipini düzgün ayarla (GLB)
    res.setHeader("Content-Type", obj.ContentType || "model/gltf-binary");
    if (obj.ContentLength) res.setHeader("Content-Length", String(obj.ContentLength));
    // İstersen önbelleği kapat
    res.setHeader("Cache-Control", "no-store");

    // Body bir stream; doğrudan kullanıcıya akıt
    await pump(obj.Body, res);
  } catch (e) {
    console.error("R2 proxy error:", e);
    // Hata türüne göre basit cevaplar:
    if (e.$metadata?.httpStatusCode === 404) return res.status(404).send("Not Found");
    return res.status(500).send("GLB stream failed");
  }
};
