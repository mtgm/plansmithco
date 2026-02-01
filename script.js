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

    setupVariantTabs(product);

    const masterUrl = product.masterModel ? product.masterModel : `/api/engine?sku=${product.sku}`;
    loadMasterModel(masterUrl);

    populateDetailPanel(product);
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
        if (variantSection) variantSection.style.display = 'none';

        // Hide config card when no variants
        const configCard = document.querySelector('.config-card');
        if (configCard) configCard.style.display = 'none';

        // Clear accordion container
        const accordionContainer = document.getElementById('variant-accordion-container');
        if (accordionContainer) accordionContainer.innerHTML = '';

        // Clear configuration display
        const configList = document.querySelector('.config-list');
        if (configList) configList.innerHTML = '';
    }
}

// NEW: Render variant groups as accordion items
function renderPartToggles(variantGroups) {
    const accordionContainer = document.getElementById('variant-accordion-container');
    if (!accordionContainer) return;

    accordionContainer.innerHTML = '';

    variantGroups.forEach((group, index) => {
        // Create accordion item
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

                // Apply texture to model
                if (item.textureConfig) {
                    applyTextureConfig(item.textureConfig);
                }

                // Update configuration display
                updateConfigItem(group.groupName, item.name);
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
    const mainLayout = document.getElementById('main-layout');
    if (panel) panel.classList.add('show');
    if (mainLayout) mainLayout.classList.add('panel-open');
}
function closeDetailPanel() {
    const panel = document.getElementById('detail-panel');
    const mainLayout = document.getElementById('main-layout');
    if (panel) panel.classList.remove('show');
    if (mainLayout) mainLayout.classList.remove('panel-open');
}

// Toggle Panel Collapse/Expand
function togglePanelCollapse() {
    const panel = document.getElementById('detail-panel');
    const btn = document.getElementById('panel-close-btn');
    const mainLayout = document.getElementById('main-layout');

    if (!panel || !btn) return;

    if (panel.classList.contains('collapsed')) {
        // Genişlet
        panel.classList.remove('collapsed');
        btn.innerHTML = '›'; // Sağ ok
        if (mainLayout) mainLayout.classList.add('panel-open');
    } else {
        // Daralt
        panel.classList.add('collapsed');
        btn.innerHTML = '‹'; // Sol ok
        if (mainLayout) mainLayout.classList.remove('panel-open');
    }
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
// Accordion Toggle with smooth scrollHeight animation
document.addEventListener('click', (e) => {
    if (e.target.closest('.accordion-header')) {
        const item = e.target.closest('.accordion-item');
        const content = item.querySelector('.accordion-content');

        if (item.classList.contains('open')) {
            // Closing - set exact height first, then animate to 0
            content.style.height = content.scrollHeight + 'px';
            // Force reflow
            content.offsetHeight;
            content.style.height = '0px';
            item.classList.remove('open');
        } else {
            // Opening - ensure height is 0, then animate to scrollHeight
            item.classList.add('open'); // Add class first to get correct scrollHeight
            content.style.height = '0px'; // Start from 0
            // Force reflow
            content.offsetHeight;
            const height = content.scrollHeight;
            content.style.height = height + 'px';

            // Reset to auto after transition completes
            setTimeout(() => {
                if (item.classList.contains('open')) {
                    content.style.height = 'auto';
                }
            }, 300); // Match CSS transition duration
        }
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
        selectedProduct.variantGroups.forEach((group, groupIndex) => {
            if (group.items[0]) {
                // Apply first texture
                if (group.items[0].textureConfig) {
                    applyTextureConfig(group.items[0].textureConfig);
                }

                // Update config display
                updateConfigItem(group.groupName, group.items[0].name);

                // Update UI - select first swatch in each accordion
                const accordionContainer = document.getElementById('variant-accordion-container');
                if (accordionContainer) {
                    const accordionItems = accordionContainer.querySelectorAll('.variant-accordion-item');
                    if (accordionItems[groupIndex]) {
                        const swatches = accordionItems[groupIndex].querySelectorAll('.swatch-item');
                        swatches.forEach((s, i) => {
                            if (i === 0) {
                                s.classList.add('active');
                            } else {
                                s.classList.remove('active');
                            }
                        });
                    }
                }
            }
        });
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
    const descEl = document.getElementById('panel-product-description');

    if (nameEl) nameEl.textContent = product.name;
    if (priceEl) priceEl.textContent = `$${product.price}`;
    if (buyLink && product.listingUrl) {
        buyLink.href = product.listingUrl;
    }

    // Update product description in Bilgi tab
    if (descEl) {
        descEl.textContent = product.description || '';
        // Don't set inline display style - it overrides CSS display:-webkit-box!
        // Just add/remove the collapsed class
        if (product.description) {
            descEl.classList.add('panel-product-desc-collapsed');
        } else {
            descEl.classList.remove('panel-product-desc-collapsed');
        }

        // Açıklama uzunsa toggle butonu göster
        const toggleBtn = document.getElementById('panel-product-desc-toggle');
        console.log('[DEBUG] Description length:', product.description?.length);
        console.log('[DEBUG] Toggle button found:', !!toggleBtn);

        if (toggleBtn) {
            const shouldShow = (product.description && product.description.length);
            console.log('[DEBUG] Should show button:', shouldShow);
            // Inline style kullan (kategori gibi)
            toggleBtn.style.display = shouldShow ? 'inline-block' : 'none';
            toggleBtn.textContent = 'Devamını gör';
            console.log('[DEBUG] Button display:', toggleBtn.style.display);
        }
    }

    // Show the panel
    showDetailPanel();
}
// Export functions for global use
window.showDetailPanel = showDetailPanel;
window.closeDetailPanel = closeDetailPanel;
window.togglePanelCollapse = togglePanelCollapse;
window.resetVariants = resetVariants;
window.applyRecommended = applyRecommended;
window.shareProduct = shareProduct;
window.populateDetailPanel = populateDetailPanel;