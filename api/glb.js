const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true, // R2 requires path-style
});

module.exports = async (req, res) => {
  try {
    // Optional: allow only your site to call this
    if (process.env.ALLOWED_ORIGIN) {
      const ref = req.headers.referer || "";
      if (!ref.includes(process.env.ALLOWED_ORIGIN)) {
        res.status(403).send("Forbidden");
        return;
      }
    }

    // Optional: per-request key e.g. /api/glb?key=assets/x.glb
    const url = new URL(req.url, `https://${req.headers.host}`);
    const keyParam = url.searchParams.get("key");

    const Bucket = process.env.R2_BUCKET;
    const Key = keyParam || process.env.R2_KEY || "model.glb";

    const cmd = new GetObjectCommand({ Bucket, Key });
    const signed = await getSignedUrl(s3, cmd, { expiresIn: 600 }); // 10 minutes

    res.status(302).setHeader("Location", signed).end();
  } catch (e) {
    console.error("Signed URL error:", e);
    res.status(500).send("GLB link could not be generated");
  }
};