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
    // 1. Linki Al
    const res = await fetch(`/api/engine?sku=${sku}`);
    if (!res.ok) throw new Error("Product not found.");
    
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    // 2. Modeli Yükle
    mv.src = data.url;
    
    // Android Fallback için linki sakla
    window.arFileUrl = data.url;

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
    const intent = `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(window.arFileUrl)}&mode=ar_preferred&resizable=false#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;end;`;
    window.location.href = intent;
  } else {
    alert("AR not supported.");
  }
});

init();