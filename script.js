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
let currentCategoryProducts = [];
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
        card.innerHTML = `
            <img src="${cat.thumbnail}" class="cat-thumb" alt="${cat.name}">
            <div class="cat-info">
                <div class="cat-title">${cat.name}</div>
                <div class="cat-count">${cat.products?.length || 0} ürün</div>
            </div>
        `;
        card.onclick = () => openCategory(cat);
        categoryGrid.appendChild(card);
    });
}

function openCategory(category) {
    currentCategoryProducts = category.products;
    const aboutSection = document.getElementById('about-section');
    if (aboutSection) aboutSection.classList.add('hidden');
    categoryGrid.style.display = 'none';
    productView.style.display = 'flex';
    backBtn.style.display = 'flex';
    renderProductList(category.products);

    if (category.products.length > 0) selectProduct(category.products[0]);
}

// --- GERİ DÖNÜŞ ---
window.goBackToCategories = function () {
    const aboutSection = document.getElementById('about-section');
    if (aboutSection) aboutSection.classList.remove('hidden');

    categoryGrid.style.display = 'flex';
    productView.style.display = 'none';
    backBtn.style.display = 'none';

    // Arayüzü gizle, posteri aç (Model arkada kalsın)
    controlsDock.classList.add('hidden-dock');
    defaultPoster.style.display = 'flex';
    loader.style.opacity = '0';

    pDesc.classList.add('desc-collapsed');
    descBtn.classList.remove('rotate-180');
}

window.toggleDesc = function () {
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


function filterProducts() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    const query = searchInput.value.toLowerCase().trim();

    // KATEGORİ GÖRÜNÜMÜNDE ARAMA
    if (categoryGrid.style.display !== 'none') {
        if (!query) {
            renderCategories(allData);
            return;
        }
        const filteredCategories = allData.filter(cat =>
            cat.name?.toLowerCase().includes(query)
        );
        renderCategories(filteredCategories);
    }

    // ÜRÜN GÖRÜNÜMÜNDE ARAMA
    if (productView.style.display === 'flex') {
        if (!query) {
            renderProductList(currentCategoryProducts);
            return;
        }
        const filtered = currentCategoryProducts.filter(p =>
            p.name?.toLowerCase().includes(query) ||
            p.description?.toLowerCase().includes(query) ||
            p.sku?.toLowerCase().includes(query)
        );
        renderProductList(filtered);
    }
}

function selectProduct(product) {
    selectedProduct = product;

    document.getElementById('p-title').textContent = product.name;
    pDesc.textContent = product.description || "";
    document.getElementById('p-price').textContent = `$${product.price}`;

    pDesc.classList.add('desc-collapsed');
    descBtn.classList.remove('rotate-180');

    const buyLink = document.getElementById('buy-link');
    if (product.listingUrl) { buyLink.href = product.listingUrl; buyLink.style.display = 'flex'; }
    else { buyLink.style.display = 'none'; }

    setupVariantTabs(product);

    const masterUrl = product.masterModel ? product.masterModel : `/api/engine?sku=${product.sku}`;
    loadMasterModel(masterUrl);

    populateDetailPanel(product);
}

function setupVariantTabs(product) {
    // NEW: Populate right panel variant section instead of old dock
    if (product.variantGroups && product.variantGroups.length > 0) {
        // Render part toggles (e.g., Çerçeve, Üst Panel, Kutu Kapakaları)
        renderPartToggles(product.variantGroups);

        // Render first group's variants by default
        if (product.variantGroups[0]) {
            window.currentVariantGroup = product.variantGroups[0];
            renderVariantsInRightPanel(product.variantGroups[0]);
        }
    }
}

// NEW: Render part toggles (variant groups) in right panel
function renderPartToggles(variantGroups) {
    const partTogglesContainer = document.querySelector('.part-toggles');
    if (!partTogglesContainer) return;

    partTogglesContainer.innerHTML = '';
    variantGroups.forEach((group, index) => {
        const btn = document.createElement('button');
        btn.className = 'part-toggle';
        if (index === 0) btn.classList.add('active');
        btn.dataset.part = group.groupName;
        btn.textContent = group.groupName;

        btn.onclick = () => {
            document.querySelectorAll('.part-toggle').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            window.currentVariantGroup = group;
            renderVariantsInRightPanel(group);
        };

        partTogglesContainer.appendChild(btn);
    });
}

// NEW: Render color swatches for selected part group
function renderVariantsInRightPanel(group) {
    const swatchesContainer = document.querySelector('.color-swatches');
    const titleEl = document.querySelector('.variant-section-title');
    const countEl = document.querySelector('.option-count');

    if (!swatchesContainer) return;

    // Update section title
    if (titleEl) titleEl.textContent = `${group.groupName.toUpperCase()} RENKLERİ`;
    if (countEl) countEl.textContent = `${group.items.length} seçenek`;

    swatchesContainer.innerHTML = '';
    group.items.forEach((item, index) => {
        // Create swatch item container
        const swatchItem = document.createElement('div');
        swatchItem.className = 'swatch-item';
        if (index === 0) swatchItem.classList.add('active');

        // Create swatch circle
        const swatch = document.createElement('div');
        swatch.className = 'swatch';

        // Set color or texture
        if (item.type === 'color') {
            swatch.style.backgroundColor = item.value;
        } else {
            swatch.style.backgroundImage = `url('${item.value}')`;
            swatch.style.backgroundSize = 'cover';
        }

        // Add border for white colors
        if (item.value === '#ffffff' || item.value === '#fff' || item.name.toLowerCase().includes('beyaz')) {
            swatch.style.border = '1px solid #ddd';
        }

        // Add checkmark SVG
        swatch.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="3">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        `;

        // Create label
        const label = document.createElement('span');
        label.textContent = item.name.split('(')[0].trim();

        // Click handler - apply texture
        swatchItem.onclick = () => {
            // Remove active from all swatches
            swatchesContainer.querySelectorAll('.swatch-item').forEach(s => s.classList.remove('active'));
            swatchItem.classList.add('active');

            // Apply texture to model
            if (item.textureConfig) {
                applyTextureConfig(item.textureConfig);
            }

            // Update configuration display
            updateConfigDisplay(group.groupName, item.name);
        };

        swatchItem.appendChild(swatch);
        swatchItem.appendChild(label);
        swatchesContainer.appendChild(swatchItem);
    });
}

// Update configuration display
function updateConfigDisplay(partName, variantName) {
    const configList = document.querySelector('.config-list');
    if (!configList) return;

    const configItems = configList.querySelectorAll('.config-item');
    configItems.forEach(item => {
        const key = item.querySelector('span:first-child').textContent;
        if (key === partName) {
            item.querySelector('span:last-child').textContent = variantName.split('(')[0].trim();
        }
    });
}

// --- FİNAL YÜKLEME MOTORU (RESET ÖZELLİKLİ) ---
async function loadMasterModel(url) {

    // Yardımcı Fonksiyon: Dokuları Varsayılana Sıfırla
    const resetToDefaults = () => {
        if (selectedProduct.variantGroups) {
            selectedProduct.variantGroups.forEach(g => {
                // Her grubun 0. elemanının (İlk seçenek) dokusunu uygula
                if (g.items[0] && g.items[0].textureConfig) {
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
        if (url.includes('/api/engine')) {
            const res = await fetch(url);
            const data = await res.json();
            if (data.ok) finalUrl = data.url;
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

function activateAR() { if (viewer.canActivateAR) viewer.activateAR(); }

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

// ========================================
// DETAIL PANEL JAVASCRIPT
// ========================================
// Panel Control
function showDetailPanel() {
    const panel = document.getElementById('detail-panel');
    if (panel) panel.classList.add('show');
}
function closeDetailPanel() {
    const panel = document.getElementById('detail-panel');
    if (panel) panel.classList.remove('show');
}
// Tab Switching
document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.panel-tab');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            // Remove active from all tabs and content
            document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            // Add active to clicked tab and its content
            btn.classList.add('active');
            document.getElementById(`tab-${tabName}`).classList.add('active');
        });
    });
});
// Accordion Toggle
document.addEventListener('click', (e) => {
    if (e.target.closest('.accordion-header')) {
        const item = e.target.closest('.accordion-item');
        item.classList.toggle('open');
    }
});
// Part Toggle Selection
document.addEventListener('click', (e) => {
    if (e.target.closest('.part-toggle')) {
        const btn = e.target.closest('.part-toggle');
        document.querySelectorAll('.part-toggle').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        // TODO: Load colors for selected part
        const partType = btn.dataset.part;
        console.log('Selected part:', partType);
    }
});
// Color Swatch Selection
document.addEventListener('click', (e) => {
    if (e.target.closest('.swatch-item')) {
        const swatch = e.target.closest('.swatch-item');
        const swatchContainer = swatch.parentElement;
        swatchContainer.querySelectorAll('.swatch-item').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        // TODO: Apply color to model
        const colorName = swatch.querySelector('span').textContent;
        console.log('Selected color:', colorName);
    }
});
// Variant Actions
function resetVariants() {
    console.log('Resetting to default variants');

    // Reset to first variant in each group
    if (selectedProduct && selectedProduct.variantGroups) {
        selectedProduct.variantGroups.forEach(group => {
            if (group.items[0]) {
                // Apply first texture
                if (group.items[0].textureConfig) {
                    applyTextureConfig(group.items[0].textureConfig);
                }

                // Update config display
                updateConfigDisplay(group.groupName, group.items[0].name);
            }
        });

        // Reset UI - select first variant in current group
        if (window.currentVariantGroup) {
            renderVariantsInRightPanel(window.currentVariantGroup);
        }
    }
}

function applyRecommended() {
    console.log('Applying recommended configuration');
    // Same as reset for now - apply first variants
    resetVariants();
}
// Share Product
function shareProduct() {
    if (navigator.share) {
        navigator.share({
            title: document.getElementById('panel-product-name').textContent,
            text: 'Check out this product!',
            url: window.location.href
        }).catch(err => console.log('Share failed:', err));
    } else {
        // Fallback: Copy link to clipboard
        navigator.clipboard.writeText(window.location.href)
            .then(() => alert('Link copied to clipboard!'))
            .catch(err => console.log('Copy failed:', err));
    }
}
// Populate Panel with Product Data
function populateDetailPanel(product) {
    // Update product name and price
    const nameEl = document.getElementById('panel-product-name');
    const priceEl = document.getElementById('panel-product-price');
    const buyLink = document.getElementById('panel-buy-link');
    if (nameEl) nameEl.textContent = product.name;
    if (priceEl) priceEl.textContent = `$${product.price}`;
    if (buyLink && product.listingUrl) {
        buyLink.href = product.listingUrl;
    }
    // Show the panel
    showDetailPanel();
}
// Export functions for global use
window.showDetailPanel = showDetailPanel;
window.closeDetailPanel = closeDetailPanel;
window.resetVariants = resetVariants;
window.applyRecommended = applyRecommended;
window.shareProduct = shareProduct;
window.populateDetailPanel = populateDetailPanel;