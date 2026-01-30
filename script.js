const viewer = document.getElementById('mv');
const categoryGrid = document.getElementById('category-grid');
const productView = document.getElementById('product-view');
const productList = document.getElementById('product-list');
const controlsDock = document.getElementById('controls-dock');
const tabsContainer = document.getElementById('tabs-container');
const variantsContainer = document.getElementById('active-variants-container');
const loader = document.getElementById('loader-overlay');
const backBtn = document.getElementById('back-btn');
const defaultPoster = document.getElementById('default-poster');
const pDesc = document.getElementById('p-desc');
const descBtn = document.getElementById('desc-toggle-btn');

let allData = [];
let selectedProduct = null;
let currentMasterUrl = null; 

// 1. Verileri Çek
fetch('products.json')
  .then(res => res.json())
  .then(data => {
    allData = data;
    renderCategories(allData);
    loader.style.opacity = '0';
  });

function renderCategories(categories) {
  categoryGrid.innerHTML = '';
  categories.forEach(cat => {
      const card = document.createElement('div');
      card.className = 'cat-card';
      card.innerHTML = `<img src="${cat.thumbnail}" class="cat-thumb"><div class="cat-title">${cat.name}</div>`;
      card.onclick = () => openCategory(cat);
      categoryGrid.appendChild(card);
  });
}

function openCategory(category) {
    categoryGrid.style.display = 'none';
    productView.style.display = 'flex';
    backBtn.style.display = 'flex';
    renderProductList(category.products);
    
    if(category.products.length > 0) selectProduct(category.products[0]);
}

// --- GERİ DÖNÜŞ ---
window.goBackToCategories = function() {
    categoryGrid.style.display = 'grid';
    productView.style.display = 'none';
    backBtn.style.display = 'none';
    
    // Arayüzü gizle, posteri aç (Model arkada kalsın)
    controlsDock.classList.add('hidden-dock');
    defaultPoster.style.display = 'flex';
    loader.style.opacity = '0';
    
    pDesc.classList.add('desc-collapsed');
    descBtn.classList.remove('rotate-180');
}

window.toggleDesc = function() {
    pDesc.classList.toggle('desc-collapsed');
    descBtn.classList.toggle('rotate-180');
}

function renderProductList(products) {
    productList.innerHTML = '';
    products.forEach(product => {
        const item = document.createElement('div');
        item.className = 'prod-item';
        item.innerHTML = `<img src="${product.thumbnail}" class="prod-thumb"><div class="prod-info"><h4>${product.name}</h4><span>${product.sku}</span></div>`;
        item.onclick = () => {
            document.querySelectorAll('.prod-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            selectProduct(product);
        }
        productList.appendChild(item);
    });
}

function selectProduct(product) {
    selectedProduct = product;
    
    document.getElementById('p-title').textContent = product.name;
    pDesc.textContent = product.description || "";
    document.getElementById('p-price').textContent = `$${product.price}`;
    
    pDesc.classList.add('desc-collapsed');
    descBtn.classList.remove('rotate-180');
    
    const buyLink = document.getElementById('buy-link');
    if(product.listingUrl) { buyLink.href = product.listingUrl; buyLink.style.display = 'flex'; } 
    else { buyLink.style.display = 'none'; }

    setupVariantTabs(product);

    const masterUrl = product.masterModel ? product.masterModel : `/api/engine?sku=${product.sku}`;
    loadMasterModel(masterUrl);
}

function setupVariantTabs(product) {
    tabsContainer.innerHTML = '';
    variantsContainer.innerHTML = '';

    if (product.variantGroups && product.variantGroups.length > 0) {
        controlsDock.classList.remove('hidden-dock');

        product.variantGroups.forEach((group, index) => {
            const tabBtn = document.createElement('button');
            tabBtn.className = 'tab-btn';
            tabBtn.innerText = group.groupName;
            
            tabBtn.onclick = () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                tabBtn.classList.add('active');
                renderVariantsForGroup(group);
            };

            tabsContainer.appendChild(tabBtn);
            if (index === 0) tabBtn.click(); 
        });
    } else {
        controlsDock.classList.add('hidden-dock');
    }
}

function renderVariantsForGroup(group) {
    variantsContainer.innerHTML = '';
    group.items.forEach((item, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'variant-item';

        const btn = document.createElement('div');
        btn.className = 'v-btn';
        if(item.type === 'color') btn.style.backgroundColor = item.value;
        else btn.style.backgroundImage = `url('${item.value}')`;

        const label = document.createElement('span');
        label.className = 'v-label';
        label.innerText = item.name.split('(')[0];

        wrapper.onclick = () => {
            variantsContainer.querySelectorAll('.variant-item').forEach(b => b.classList.remove('selected'));
            wrapper.classList.add('selected');
            if(item.textureConfig) applyTextureConfig(item.textureConfig);
        };

        if(index === 0) wrapper.classList.add('selected');

        wrapper.appendChild(btn);
        wrapper.appendChild(label);
        variantsContainer.appendChild(wrapper);
    });
}

// --- FİNAL YÜKLEME MOTORU (RESET ÖZELLİKLİ) ---
async function loadMasterModel(url) {
    
    // Yardımcı Fonksiyon: Dokuları Varsayılana Sıfırla
    const resetToDefaults = () => {
        if(selectedProduct.variantGroups) {
            selectedProduct.variantGroups.forEach(g => {
                // Her grubun 0. elemanının (İlk seçenek) dokusunu uygula
                if(g.items[0] && g.items[0].textureConfig) {
                    applyTextureConfig(g.items[0].textureConfig);
                }
            });
        }
    };

    // DURUM 1: Model zaten hafızada (Cache Hit)
    if (currentMasterUrl === url) {
        console.log("Cache Hit. Model hazır, dokular sıfırlanıyor...");
        loader.style.opacity = '0';
        defaultPoster.style.display = 'none'; 
        
        // ==> KRİTİK EKLEME: Model değişmese bile dokuları sıfırla!
        resetToDefaults(); 
        
        return; 
    }

    // DURUM 2: Yeni Model İndiriliyor
    loader.style.opacity = '1';
    defaultPoster.style.display = 'none';

    try {
        let finalUrl = url;
        if(url.includes('/api/engine')) {
            const res = await fetch(url);
            const data = await res.json();
            if(data.ok) finalUrl = data.url;
        }

        viewer.src = finalUrl;
        currentMasterUrl = url;

        viewer.addEventListener('load', () => {
            loader.style.opacity = '0';
            defaultPoster.style.display = 'none';
            
            // İlk yüklemede varsayılanları uygula
            resetToDefaults(); 
            
        }, { once: true });

    } catch (e) {
        console.error(e);
        loader.style.opacity = '0';
        defaultPoster.style.display = 'flex';
    }
}

function activateAR() { if(viewer.canActivateAR) viewer.activateAR(); }

async function applyTextureConfig(configs) {
    if (!viewer.model) return;
    const configList = Array.isArray(configs) ? configs : [configs];

    for (const cfg of configList) {
        const material = viewer.model.materials.find(m => m.name === cfg.materialName);
        if (!material) continue;

        if (cfg.baseColor) {
            const texture = await viewer.createTexture(cfg.baseColor);
            material.pbrMetallicRoughness.baseColorTexture.setTexture(texture);
        }
        if (cfg.normal) {
            const texture = await viewer.createTexture(cfg.normal);
            material.normalTexture.setTexture(texture);
        }
        if (cfg.orm) {
            const texture = await viewer.createTexture(cfg.orm);
            material.pbrMetallicRoughness.metallicRoughnessTexture.setTexture(texture);
        }
    }
}