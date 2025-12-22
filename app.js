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

// ... üstteki kodlar aynı ...

// AR Butonu Tıklama Olayı
arBtn.addEventListener('click', (event) => {
  // 1. Android Kontrolü
  const isAndroid = /android/i.test(navigator.userAgent);

  if (isAndroid && window.arFileUrl) {
    // Manuel Müdahale Ediyoruz, o yüzden parametreleri biz vermeliyiz!
    event.preventDefault(); // Standart davranışı durdur

    const title = "PlanSmithCo";
    
    // İŞTE SİHİRLİ NOKTA: resizable=false
    // Bu parametre olmazsa, HTML'de ne yazarsa yazsın Android kilidi takmaz.
    const intent = `intent://arvr.google.com/scene-viewer/1.0` +
                   `?file=${encodeURIComponent(window.arFileUrl)}` +
                   `&mode=ar_preferred` +
                   `&resizable=false` +  // <-- KİLİT BURADA
                   `&title=${encodeURIComponent(title)}` +
                   `#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;end;`;

    window.location.href = intent;
  } 
  else if (mv.canActivateAR) {
    // iOS (iPhone) Tarafı
    // iPhone için özel link oluşturamayız, Apple izin vermez.
    // Mecburen kütüphanenin fonksiyonunu çağırıyoruz.
    // Bu fonksiyon HTML'deki ar-scale="fixed" yazısını okur ve uygular.
    mv.activateAR();
  }
});

init();