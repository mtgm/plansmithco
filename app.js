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
    // 1. Model ve HDR Linklerini Al
    const modelRes = await fetch(`/api/engine?sku=${sku}`);
    if (!modelRes.ok) throw new Error("Product not found.");
    const modelData = await modelRes.json();
    
    const envRes = await fetch(`/api/engine?type=env`);
    const envData = await envRes.json();

    // 2. Modeli Yükle
    mv.src = modelData.url;
    
    // 3. HDR Varsa Uygula
    if (envData.ok) {
        mv.environmentImage = envData.url;
    }

  } catch (err) {
    console.error(err);
    showError(err.message);
  }
}

// Sadece model yüklendiğinde butonu görünür yapıyoruz.
// Tıklama olayını (Click Event) ARTIK YAZMIYORUZ. Kütüphane kendi halledecek.
mv.addEventListener('load', () => {
  loader.classList.add('hidden');
  arBtn.style.display = 'flex'; // Butonu görünür yap
});

init();