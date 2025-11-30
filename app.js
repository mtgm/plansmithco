// app.js - UI ve Logic

const mv = document.getElementById('mv');
const loader = document.getElementById('loader-container');
const arBtn = document.getElementById('ar-btn');
const errorToast = document.getElementById('error-toast');

// Hata Gösterici
function showError(msg) {
  errorToast.textContent = msg;
  errorToast.style.display = 'block';
  // Loader varsa onu da gizle ki hatayı görelim
  if(loader) loader.style.display = 'none';
}

async function init() {
  const url = new URL(window.location.href);
  let sku = url.searchParams.get('sku');
  const match = url.pathname.match(/\/m\/([^\/]+)/);
  if (match) sku = match[1];

  if (!sku) return showError("Error: Product SKU missing.");

  try {
    // 1. Motor'dan Linki Al
    const res = await fetch(`/api/engine?sku=${sku}`);
    if (!res.ok) throw new Error("Product not found or access denied.");
    
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    // 2. Modeli Yükle
    mv.src = data.url;
    window.arFileUrl = data.url;

    // 3. Texture Varsa Uygula
    const tex = url.searchParams.get('tex');
    if (tex) {
      mv.addEventListener('load', async () => {
         // Burası texture kodu, şimdilik basit tutuyoruz
         console.log("Texture requested:", tex);
      }, { once: true });
    }

  } catch (err) {
    console.error(err);
    showError(err.message);
  }
}

// MODEL YÜKLENİNCE NE OLACAK?
// Model-viewer 'load' eventini tetiklediğinde Loader'ı kaldır.
mv.addEventListener('load', () => {
  // 1. Loader'ı yavaşça yok et (CSS transition ile)
  loader.classList.add('hidden');
  
  // 2. AR Butonunu göster
  arBtn.style.display = 'flex';
  
  console.log("Model loaded successfully.");
});

// AR BUTONUNA TIKLANINCA
arBtn.addEventListener('click', () => {
  if (mv.canActivateAR) {
    mv.activateAR();
  } else if (window.arFileUrl) {
    // Android Fallback
    const intent = `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(window.arFileUrl)}&mode=ar_preferred#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;end;`;
    window.location.href = intent;
  } else {
    alert("AR is not supported on this device.");
  }
});

// Başlat
init();