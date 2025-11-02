// api/glb.js
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://pub-c09e063308e5459cb4c5727415475d43.r2.dev`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

module.exports = async (req, res) => {
  try {
    // Çoklu model: /api/glb?key=dosya.glb
    const url = new URL(req.url, `https://${req.headers.host}`);
    const keyParam = url.searchParams.get("key");

    const Bucket = process.env.R2_BUCKET;
    const Key = keyParam || process.env.R2_KEY || "model.glb";

    const cmd = new GetObjectCommand({ Bucket, Key });
    const signed = await getSignedUrl(s3, cmd, { expiresIn: 600 });

    res.status(302).setHeader("Location", signed).end();
  } catch (e) {
    console.error("Signed URL error:", e);
    res.status(500).send("GLB link could not be generated");
  }
};
