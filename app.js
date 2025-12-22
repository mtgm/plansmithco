const mv = document.getElementById('mv');
const loader = document.getElementById('loader-container');
const arBtn = document.getElementById('ar-btn');
const errorToast = document.getElementById('error-toast');

function showError(msg) {
  if(loader) loader.style.display = 'none';
  errorToast.textContent = msg;
  errorToast.style.display = 'block';
}

async function init() {
  const url = new URL(window.location.href);
  let sku = url.searchParams.get('sku');
  const match = url.pathname.match(/\/m\/([^\/]+)/);
  if (match) sku = match[1];

  if (!sku) return showError("SKU Missing.");

  try {
    // 1. Motor'dan MODEL Linkini Al
    const modelRes = await fetch(`/api/engine?sku=${sku}`);
    if (!modelRes.ok) throw new Error("Product not found.");
    const modelData = await modelRes.json();
    if (!modelData.ok) throw new Error(modelData.error);

    // 2. Motor'dan HDR SAHNE Linkini Al (YENİ KISIM)
    const envRes = await fetch(`/api/engine?type=env`);
    const envData = await envRes.json();

    // 3. Modeli Yükle
    mv.src = modelData.url;
    window.arFileUrl = modelData.url;

    // 4. HDR Varsa Uygula (YENİ KISIM)
    if (envData.ok) {
        // environmentImage: Işıklandırmayı değiştirir
        mv.environmentImage = envData.url;
        // Eğer arka planda da resmi görmek istersen şu satırın başındaki // işaretini kaldır:
        // mv.skyboxImage = envData.url;
    }

  } catch (err) {
    console.error(err);
    showError(err.message);
  }
}

// Model yüklendiği an loader'ı kaldır
mv.addEventListener('load', () => {
  loader.classList.add('hidden');
  arBtn.style.display = 'flex';
});

// AR Butonu
arBtn.addEventListener('click', () => {
  if (mv.canActivateAR) {
    mv.activateAR();
  } else if (window.arFileUrl) {
    // ANDROID INTENT (Güncellendi: resizable=false eklendi)
    // Bu kod Android'de de ölçeği 1:1 kilitler.
    const intent = `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(window.arFileUrl)}&mode=ar_preferred&resizable=false&title=PlanSmithCo#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;end;`;
    window.location.href = intent;
  } else {
    alert("AR not supported.");
  }
});

init();