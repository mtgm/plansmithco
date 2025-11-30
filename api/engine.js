export default function handler(req, res) {
  // 1. Ortam Değişkenleri Yüklü mü Kontrol Et
  const envCheck = {
    ACCOUNT_ID: process.env.R2_ACCOUNT_ID ? "YÜKLÜ ✅" : "EKSİK ❌",
    ACCESS_KEY: process.env.R2_ACCESS_KEY_ID ? "YÜKLÜ ✅" : "EKSİK ❌",
    SECRET_KEY: process.env.R2_SECRET_ACCESS_KEY ? "YÜKLÜ ✅" : "EKSİK ❌",
    BUCKET: process.env.R2_BUCKET ? "YÜKLÜ ✅" : "EKSİK ❌",
  };

  // 2. Basit bir cevap dön
  return res.status(200).json({
    ok: true,
    message: "Motor çalışıyor!",
    env_durumu: envCheck,
    sku_istenen: req.query.sku || "Yok"
  });
}