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
fetch('js/products.json')
    .then(res => res.json())
    .then(data => {
        allData = data;
        renderCategories(allData);
        loader.style.opacity = '0';
        handleDeepLink(); // Check for URL params
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

    // Geri oku göster
    const backArrow = document.getElementById('back-arrow');
    if (backArrow) backArrow.style.display = 'block';

    // Kategori bilgilerini göster
    const categoryInfo = document.getElementById('category-info');
    const categoryTitle = document.getElementById('category-title');
    const categoryCount = document.getElementById('category-count');
    const categoryDesc = document.getElementById('category-desc');
    const categoryDescToggle = document.getElementById('category-desc-toggle');

    if (categoryInfo) categoryInfo.style.display = 'block';
    if (categoryTitle) categoryTitle.textContent = category.name;
    if (categoryCount) categoryCount.textContent = `${category.products?.length || 0} ürün`;
    if (categoryDesc) {
        categoryDesc.textContent = category.description || '';
        categoryDesc.classList.add('category-desc-collapsed');

        // Açıklama uzunsa toggle butonu göster
        if (categoryDescToggle) {
            categoryDescToggle.style.display = (category.description && category.description.length > 100) ? 'inline-block' : 'none';
            categoryDescToggle.textContent = 'Devamını gör';
        }
    }

    renderProductList(category.products);

    // Detail panel'i kapat (yeni kategoriye geçildiğinde)
    closeDetailPanel();

    // Kullanıcı ürün seçene kadar poster göster
    defaultPoster.style.display = 'flex';
    controlsDock.classList.add('hidden-dock');
    loader.style.opacity = '0';
}


// --- GERİ DÖNÜŞ ---
window.goBackToCategories = function () {
    const aboutSection = document.getElementById('about-section');
    if (aboutSection) aboutSection.classList.remove('hidden');

    categoryGrid.style.display = 'flex';
    productView.style.display = 'none';


    // Geri oku gizle
    const backArrow = document.getElementById('back-arrow');
    if (backArrow) backArrow.style.display = 'none';

    // Kategori bilgilerini gizle
    const categoryInfo = document.getElementById('category-info');
    if (categoryInfo) categoryInfo.style.display = 'none';

    // Detail panel'i kapat
    closeDetailPanel();

    // Model-viewer'ı gizle
    viewer.style.display = 'none';

    // Arayüzü gizle, posteri aç (Model arkada kalsın)
    controlsDock.classList.add('hidden-dock');
    defaultPoster.style.display = 'flex';
    loader.style.opacity = '0';
}

window.toggleDesc = function () {
    pDesc.classList.toggle('desc-collapsed');
    descBtn.classList.toggle('rotate-180');
}

// Genel açıklama toggle fonksiyonu (kategori ve ürün açıklaması için)
window.toggleDescription = function (descId, toggleBtnId, collapsedClass) {
    const desc = document.getElementById(descId);
    const toggleBtn = document.getElementById(toggleBtnId);

    console.log('[toggleDescription] desc:', descId, 'found:', !!desc);
    console.log('[toggleDescription] button:', toggleBtnId, 'found:', !!toggleBtn);

    if (desc && toggleBtn) {
        const isCollapsed = desc.classList.contains(collapsedClass);
        console.log('[toggleDescription] isCollapsed:', isCollapsed);

        if (isCollapsed) {
            desc.classList.remove(collapsedClass);
            toggleBtn.textContent = 'Daha az';
        } else {
            desc.classList.add(collapsedClass);
            toggleBtn.textContent = 'Devamını gör';
        }
    }
}

// Wrapper fonksiyonlar (backward compatibility)
window.toggleCategoryDesc = function () {
    toggleDescription('category-desc', 'category-desc-toggle', 'category-desc-collapsed');
}

window.toggleProductDesc = function () {
    toggleDescription('panel-product-description', 'panel-product-desc-toggle', 'panel-product-desc-collapsed');
}


function renderProductList(products) {
    productList.innerHTML = '';
    products.forEach(product => {
        const item = document.createElement('div');
        item.className = 'prod-item';
        // Badge kaldırıldı - sadece thumbnail, başlık ve fiyat
        item.innerHTML = `
            <img src="${product.thumbnail}" class="prod-thumb">
            <div class="prod-info">
                <h4>${product.name}</h4>
                <span class="prod-price">$${product.price}</span>
            </div>
        `;
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

    // Model-viewer'ı göster
    viewer.style.display = 'block';

    // Poster'ı gizle ve loader göster
    defaultPoster.style.display = 'none';
    loader.style.opacity = '1';

    // --- MOBILE LOGIC ---
    // Activate Mobile Product View (Split Screen)
    const mainLayout = document.getElementById('main-layout');
    if (mainLayout) mainLayout.classList.add('mobile-product-active');

    // Ensure Mobile Back Button Exists
    let mobileBackBtn = document.getElementById('mobile-back-btn');
    if (!mobileBackBtn) {
        // Inject into stage wrapper
        const stageWrapper = document.getElementById('stage-wrapper');
        if (stageWrapper) {
            mobileBackBtn = document.createElement('div');
            mobileBackBtn.id = 'mobile-back-btn';
            mobileBackBtn.innerHTML = '↩️'; // Left arrow
            mobileBackBtn.onclick = closeMobileProduct;
            stageWrapper.appendChild(mobileBackBtn);
        }
    }
    if (mobileBackBtn) mobileBackBtn.style.display = 'flex';

    setupVariantTabs(product);

    const masterUrl = product.masterModel ? product.masterModel : `/api/engine?sku=${product.sku}`;
    loadMasterModel(masterUrl);

    populateDetailPanel(product);

    // Generate initial QR
    // Generate initial QR
    setTimeout(() => updateARandQR(null), 500);
}

// NEW: Close Mobile Product View (Return to List)
function closeMobileProduct() {
    const mainLayout = document.getElementById('main-layout');
    if (mainLayout) mainLayout.classList.remove('mobile-product-active');

    // Close detail panel
    closeDetailPanel();

    // On desktop this button is hidden via CSS, but good to be safe
    const mobileBackBtn = document.getElementById('mobile-back-btn');
    if (mobileBackBtn) mobileBackBtn.style.display = 'none';
}

function setupVariantTabs(product) {
    // NEW: Populate right panel variant section instead of old dock
    if (product.variantGroups && product.variantGroups.length > 0) {
        // Show variant section
        const variantSection = document.querySelector('.variant-section');
        if (variantSection) variantSection.style.display = 'block';

        // Show config card
        const configCard = document.querySelector('.config-card');
        if (configCard) configCard.style.display = 'block';

        // Initialize configuration display with variant groups
        initializeConfigDisplay(product.variantGroups);

        // Render variant groups as accordion items (includes all variants)
        renderPartToggles(product.variantGroups);
    } else {
        // NO VARIANTS - Hide and clear variant section
        const variantSection = document.querySelector('.variant-section');
        variantSection.style.display = 'none';

        // Hide config card when no variants
        const configCard = document.querySelector('.config-card');
        configCard.style.display = 'none';

        // Clear accordion container
        const accordionContainer = document.getElementById('variant-accordion-container');
        if (accordionContainer) accordionContainer.innerHTML = '';

        // Clear mobile tabs container (Fix for ghost tabs)
        const mobileTabsContainer = document.getElementById('mobile-variant-tabs');
        if (mobileTabsContainer) mobileTabsContainer.innerHTML = '';

        // Clear configuration display
        const configList = document.querySelector('.config-list');
        if (configList) configList.innerHTML = '';
    }
}

// NEW: Render variant groups as accordion items
function renderPartToggles(variantGroups) {
    const accordionContainer = document.getElementById('variant-accordion-container');
    const mobileTabsContainer = document.getElementById('mobile-variant-tabs');

    if (!accordionContainer) return;

    accordionContainer.innerHTML = '';
    if (mobileTabsContainer) mobileTabsContainer.innerHTML = '';

    variantGroups.forEach((group, index) => {
        // --- 1. Create Mobile Tab ---
        if (mobileTabsContainer) {
            const tabBtn = document.createElement('button');
            tabBtn.className = 'mobile-variant-tab';
            if (index === 0) tabBtn.classList.add('active');
            tabBtn.textContent = group.groupName;

            tabBtn.onclick = () => {
                // Initial Switch Logic
                // 1. Update Tab Active State
                mobileTabsContainer.querySelectorAll('.mobile-variant-tab').forEach(t => t.classList.remove('active'));
                tabBtn.classList.add('active');

                // 2. Open Corresponding Accordion Item (and close others for Tab UX)
                const allItems = accordionContainer.querySelectorAll('.accordion-item');
                allItems.forEach((item, i) => {
                    const content = item.querySelector('.accordion-content');
                    if (i === index) {
                        item.classList.add('open');
                        if (content) content.style.height = 'auto'; // Force visible on mobile
                    } else {
                        item.classList.remove('open');
                        if (content) content.style.height = '0px';
                    }
                });
            };
            mobileTabsContainer.appendChild(tabBtn);
        }

        // --- 2. Create Accordion Item ---
        const accordionItem = document.createElement('div');
        accordionItem.className = 'accordion-item variant-accordion-item';
        if (index === 0) accordionItem.classList.add('open'); // First item open by default

        // Create accordion header
        const accordionHeader = document.createElement('button');
        accordionHeader.className = 'accordion-header';
        accordionHeader.innerHTML = `
            <span>${group.groupName}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
        `;

        // Create accordion content
        const accordionContent = document.createElement('div');
        accordionContent.className = 'accordion-content';

        // Create swatches container for this group
        const swatchesContainer = document.createElement('div');
        swatchesContainer.className = 'color-swatches';

        // Populate swatches
        group.items.forEach((item, itemIndex) => {
            const swatchItem = document.createElement('div');
            swatchItem.className = 'swatch-item';
            if (index === 0 && itemIndex === 0) swatchItem.classList.add('active');

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
                // Remove active from all swatches in this accordion item
                accordionContent.querySelectorAll('.swatch-item').forEach(s => s.classList.remove('active'));
                swatchItem.classList.add('active');
                // Update configuration display
                updateConfigItem(group.groupName, item.name);

                // Wrapper: Apply Texture & Update QR
                // This replaces the direct calls to applyTextureConfig and updateQRCode
                if (item.textureConfig) {
                    updateARandQR(item.textureConfig);
                } else {
                    // Even if no texture config (e.g. just color), update QR
                    updateARandQR(null);
                }
            };

            swatchItem.appendChild(swatch);
            swatchItem.appendChild(label);
            swatchesContainer.appendChild(swatchItem);
        });

        accordionContent.appendChild(swatchesContainer);

        accordionItem.appendChild(accordionHeader);
        accordionItem.appendChild(accordionContent);
        accordionContainer.appendChild(accordionItem);
    });

    // After rendering, set height for initially open accordions
    // This ensures the first accordion displays correctly on initial load
    setTimeout(() => {
        const openItems = accordionContainer.querySelectorAll('.accordion-item.open');
        openItems.forEach(item => {
            const content = item.querySelector('.accordion-content');
            if (content) {
                // Fix: Set to auto to ensure all content (including shadows/borders) is visible
                content.style.height = 'auto';
            }
        });
    }, 0);
}

// NEW: Render color swatches for selected part group
// NOTE: This function is now deprecated in favor of accordion-based rendering
// Kept for backwards compatibility
function renderVariantsInRightPanel(group) {
    // No longer used - variants are rendered directly in accordion items
    // This function is kept for backwards compatibility but does nothing
    return;
}

// Initialize configuration display based on variant groups
function initializeConfigDisplay(variantGroups) {
    const configList = document.querySelector('.config-list');
    if (!configList) return;

    // Clear existing config items
    configList.innerHTML = '';

    // Create config item for each variant group
    if (variantGroups && variantGroups.length > 0) {
        variantGroups.forEach(group => {
            const configItem = document.createElement('div');
            configItem.className = 'config-item';
            configItem.dataset.groupName = group.groupName;

            const keySpan = document.createElement('span');
            keySpan.textContent = group.groupName;

            const valueSpan = document.createElement('span');
            // Set first item as default
            valueSpan.textContent = group.items[0] ? group.items[0].name.split('(')[0].trim() : '-';

            configItem.appendChild(keySpan);
            configItem.appendChild(valueSpan);
            configList.appendChild(configItem);
        });
    }
}

// Update single config item when variant is selected
function updateConfigItem(partName, variantName) {
    const configList = document.querySelector('.config-list');
    if (!configList) return;

    const configItem = configList.querySelector(`[data-group-name="${partName}"]`);
    if (configItem) {
        const valueSpan = configItem.querySelector('span:last-child');
        if (valueSpan) {
            valueSpan.textContent = variantName.split('(')[0].trim();
        }
    }
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
        viewer.addEventListener('load', () => {
            loader.classList.add('hidden');
            // Check if config exists in URL to avoid overwriting user selection with defaults
            const { config } = getUrlParams();
            if (!config && selectedProduct && selectedProduct.variantGroups) {
                selectedProduct.variantGroups.forEach(g => {
                    if (g.items[0] && g.items[0].textureConfig) applyTextureConfig(g.items[0].textureConfig);
                });
            }
        }, { once: true });
    } catch (e) { console.error('Model load error:', e); loader.classList.add('hidden'); }

}

// (file continues...)