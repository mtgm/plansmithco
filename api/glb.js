// api/glb.js
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { NodeHttpHandler } = require("@aws-sdk/node-http-handler");
const https = require("https");
const { pipeline } = require("stream");
const { promisify } = require("util");
const pump = promisify(pipeline);

// --- S3 (R2) istemcisi ---
// Not: Burada S3 API endpoint'i kullanıyoruz. r2.dev adresi tarayıcı içindir;
// SDK ile imzalı istekler için doğru uç nokta budur.
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  requestHandler: new NodeHttpHandler({
    httpsAgent: new https.Agent({
      keepAlive: true,
      maxSockets: 50,
      // Bazı bölgelerde TLS negotiation sorunlarını kesmek için:
      minVersion: "TLSv1.2",
    }),
  }),
});

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const Bucket = process.env.R2_BUCKET; // web-ar-test (birebir!)
    const Key = url.searchParams.get("key") || process.env.R2_KEY || "SBR-v2.glb";

    const obj = await s3.send(new GetObjectCommand({ Bucket, Key }));

    res.setHeader("Content-Type", obj.ContentType || "model/gltf-binary");
    if (obj.ContentLength) res.setHeader("Content-Length", String(obj.ContentLength));
    res.setHeader("Cache-Control", "no-store");

    await pump(obj.Body, res);
  } catch (e) {
    // Geçici: hata ayrıntısını görmemiz için geri döndürüyorum
    res.status(500).json({
      ok: false,
      name: e.name,
      code: e.Code || e.code,
      message: e.message,
      hint:
        "R2_BUCKET (web-ar-test) birebir mi? key tam adıyla SBR-v2.glb mı? " +
        "CF_ACCOUNT_ID, R2_ACCESS_KEY_ID/SECRET_ACCESS_KEY doğru mu?",
    });
  }
};
