import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const MODEL_DB = {
  "SBRV2": "SBR-v2.glb",
  "CHAIRV1": "chair-v1.glb",
  "PLANTERV1": "planter.glb"
  // Diğer modellerin...
};

// Varsayılan HDR Sahnesi
const DEFAULT_ENV = "environments/studio.jpg"; 

const client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const sku = url.searchParams.get("sku")?.toUpperCase();
    const type = url.searchParams.get("type"); // 'env' isteği için

    // A. ORTAM (HDR) İSTEĞİ
    if (type === 'env') {
      const command = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: DEFAULT_ENV
      });
      // HDR dosyaları büyük olabilir, link 1 saat geçerli olsun
      const signedUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
      return res.status(200).json({ ok: true, url: signedUrl });
    }

    // B. MODEL İSTEĞİ
    if (!sku || !MODEL_DB[sku]) {
      return res.status(404).json({ ok: false, error: "Model Not Found" });
    }

    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: MODEL_DB[sku],
    });

    const signedUrl = await getSignedUrl(client, command, { expiresIn: 3600 });

    return res.status(200).json({ ok: true, url: signedUrl });

  } catch (error) {
    console.error("Engine Error:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}