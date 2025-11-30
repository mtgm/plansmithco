// script.js

const mv = document.getElementById('mv');
const statusBox = document.getElementById('status-msg');
const arBtn = document.getElementById('ar-btn');

// Yardımcı: Mesaj Göster
function showStatus(msg, isError = false) {
  statusBox.textContent = msg;
  statusBox.style.display = 'block';
  
  if (isError) {
    statusBox.classList.add('error-msg');
  } else {
    statusBox.classList.remove('error-msg');
    // Hata değilse 2 sn sonra gizle
    setTimeout(() => { statusBox.style.display = 'none'; }, 2000);
  }
}

// Ana Başlatıcı
async function init() {
  const url = new URL(window.location.href);
  
  // 1. SKU Bulma (/m/MODEL veya ?sku=MODEL)
  let sku = url.searchParams.get('sku');
  const pathMatch = url.pathname.match(/\/m\/([^\/]+)/);
  if (pathMatch) sku = pathMatch[1];

  if (!sku) {
    return showStatus("HATA: Ürün kodu (SKU) bulunamadı.", true);
  }

  showStatus("Ürün yükleniyor...");

  try {
    // 2. Güvenli API'den Link İste
    const apiResponse = await fetch(`/api/engine?sku=${sku}`);
    const data = await apiResponse.json();

    if (!data.ok) {
      throw new Error(data.error || "Sunucu hatası");
    }

    // 3. Modeli Yükle (İmzalı URL)
    const safeUrl = data.url;
    mv.src = safeUrl;
    
    // Android AR için linki sakla
    window.arFileUrl = safeUrl;

    // Yükleme tamamlanınca butonu göster
    mv.addEventListener('load', () => {
      arBtn.style.display = 'block';
      showStatus("Hazır!");
    }, { once: true });

  } catch (err) {
    console.error(err);
    showStatus(err.message, true);
  }
}

// AR Butonu Olayı
arBtn.addEventListener('click', () => {
  if (mv.canActivateAR) {
    mv.activateAR();
  } else if (window.arFileUrl) {
    // Android Fallback
    const intent = `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(window.arFileUrl)}&mode=ar_preferred#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;end;`;
    window.location.href = intent;
  } else {
    alert("Cihazınız AR desteklemiyor.");
  }
});

// Başlat
init();