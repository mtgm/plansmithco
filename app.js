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
    // 1. Model Linki
    const modelRes = await fetch(`/api/engine?sku=${sku}`);
    if (!modelRes.ok) throw new Error("Product not found.");
    const modelData = await modelRes.json();
    if (!modelData.ok) throw new Error(modelData.error);

    // 2. HDR (Varsa)
    const envRes = await fetch(`/api/engine?type=env`);
    const envData = await envRes.json();

    // 3. Modeli Yükle
    mv.src = modelData.url;
    window.arFileUrl = modelData.url; // Android Intent için linki sakla

    // 4. HDR Uygula
    if (envData.ok) {
        mv.environmentImage = envData.url;
    }

  } catch (err) {
    console.error(err);
    showError(err.message);
  }
}

mv.addEventListener('load', () => {
  loader.classList.add('hidden');
  arBtn.style.display = 'flex';
});

// --- KRİTİK BÖLGE: AR BUTONU ---
arBtn.addEventListener('click', (event) => {
  // Olayı durdur, kontrolü biz alıyoruz
  event.preventDefault();
  event.stopPropagation();

  const isAndroid = /android/i.test(navigator.userAgent);

  if (isAndroid && window.arFileUrl) {
    // ANDROID: WebXR'ı bypass et. Scene Viewer'ı ZORLA.
    // S.Browser_fallback_url parametresi, eğer SceneViewer açılmazsa geri dönmesini sağlar.
    const intent = `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(window.arFileUrl)}&mode=ar_preferred&resizable=false&title=PlanSmithCo#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(window.location.href)};end;`;
    window.location.href = intent;
  } 
  else if (mv.canActivateAR) {
    // IPHONE (iOS): Apple'ın insafına kalıyoruz (Genelde fixed çalışır)
    mv.activateAR();
  } 
  else {
    alert("Cihazınız AR desteklemiyor.");
  }
});

init();