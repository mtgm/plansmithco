// api/glb.js
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

// Çok basic MIME. GLB için yeterli.
function mimeFor(key) {
  const ext = key.toLowerCase().split(".").pop();
  if (ext === "glb") {
    return "model/gltf-binary";
  }
  // fallback
  return "application/octet-stream";
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const key = (url.searchParams.get("key") || "").trim();
    if (!key) {
      return res.status(400).send("missing key");
    }

    const obj = await r2.send(
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key // örn "SBR-v2.glb"
      })
    );

    res.setHeader("Content-Type", mimeFor(key));
    // Çok kısa cache veriyoruz ki hızlansın ama kopyalanması zor olsun
    res.setHeader("Cache-Control", "public, max-age=600");

    obj.Body.pipe(res);
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e.message
    });
  }
}
