import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
// JSON'ı 'import' ile alıyoruz, böylece Vercel dosyayı kesinlikle paketler.
import models from '../models.json'; 

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
    // 1. GÜVENLİK: Referer Kontrolü (Hırsızlık Önlemi)
    // İsteğin nereden geldiğine bakar. Sadece senin sitene izin verir.
    const referer = req.headers.referer || req.headers.origin || "";
    const allowedDomain = "plansmithco.vercel.app";
    
    // Localhost geliştirme aşamasında sorun çıkarmasın diye 'localhost'a izin veriyoruz.
    // Canlıya alırken istersen localhost kısmını silebilirsin.
    if (!referer.includes(allowedDomain) && !referer.includes("localhost")) {
      return res.status(403).json({ ok: false, error: "Erişim Reddedildi. Kaynak: " + referer });
    }

    // 2. SKU Kontrolü
    const url = new URL(req.url, `https://${req.headers.host}`);
    const sku = url.searchParams.get("sku")?.toUpperCase();
    
    if (!sku || !models[sku]) {
      return res.status(404).json({ ok: false, error: "Model Bulunamadı" });
    }

    const fileKey = models[sku];

    // 3. İmzalı Link Oluşturma (Signed URL)
    // Bu link sadece 60 saniye çalışır. 
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: fileKey,
    });

    // expiresIn: 60 -> Link 1 dakika sonra patlar.
    const signedUrl = await getSignedUrl(client, command, { expiresIn: 60 });

    // Frontend'e sadece güvenli linki dönüyoruz
    return res.status(200).json({ ok: true, url: signedUrl });

  } catch (error) {
    console.error("Engine Hatası:", error);
    return res.status(500).json({ ok: false, error: "Sunucu Hatası" });
  }
}