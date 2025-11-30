import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// --- VERİTABANI BURADA (Harici dosya yok, hata riski yok) ---
const MODEL_DB = {
  "SBRV2": "SBR-v2.glb",
  "CHAIRV1": "chair-v1.glb",
  "PLANTERV1": "planter.glb"
};

// R2 Ayarları
const R2_CONFIG = {
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
};

const client = new S3Client(R2_CONFIG);

export default async function handler(req, res) {
  try {
    // 1. GÜVENLİK: Referer Kontrolü
    const referer = req.headers.referer || req.headers.origin || "";
    // Sadece senin sitene ve localhost'a izin ver
    const isAllowed = referer.includes("mtgm-plansmithco.vercel.app") || referer.includes("localhost");
    
    // Güvenlik şimdilik kapalı kalsın ki test ederken sorun yaşamayalım. 
    // İstersen sonra aşağıdaki yorumu açabilirsin:
    /*
    if (!isAllowed) {
      return res.status(403).json({ ok: false, error: "Erişim Reddedildi." });
    }
    */

    // 2. SKU Kontrolü
    const url = new URL(req.url, `https://${req.headers.host}`);
    const sku = url.searchParams.get("sku")?.toUpperCase();
    
    // Veriyi artık direkt içeriden okuyoruz
    if (!sku || !MODEL_DB[sku]) {
      return res.status(404).json({ ok: false, error: "Model Bulunamadı", requested: sku });
    }

    const fileKey = MODEL_DB[sku];

    // 3. İmzalı Link Oluşturma
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: fileKey,
    });

    const signedUrl = await getSignedUrl(client, command, { expiresIn: 60 });

    return res.status(200).json({ ok: true, url: signedUrl });

  } catch (error) {
    console.error("Engine Hatası:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}