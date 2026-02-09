/**
 * productDetail.js
 * Logic for the Product Detail Page
 */

const ProductDetail = {
    // Elements
    titleEl: document.querySelector('.p-title'),
    priceEl: document.querySelector('.p-price'),
    descEl: document.getElementById('product-description'), // Needs to be added to HTML
    viewer: document.querySelector('model-viewer'),
    qrContainer: document.getElementById('qr-container'), // Needs to be added to HTML

    // State
    currentProduct: null,

    init: async () => {
        await window.dataManager.init();
        const productId = Utils.getQueryParam('id');

        if (!productId) {
            alert('Ürün bulunamadı!');
            window.location.href = 'Warm Sun Edition_Product_List.html';
            return;
        }

        const product = window.dataManager.getProductById(productId);
        if (!product) {
            alert('Ürün bulunamadı!');
            return;
        }

        ProductDetail.currentProduct = product;
        ProductDetail.renderProduct(product);
    },

    renderProduct: (product) => {
        // Basic Info
        if (ProductDetail.titleEl) ProductDetail.titleEl.textContent = product.name;

        // Find display product (first variant or self)
        const displayProduct = product.products && product.products.length > 0 ? product.products[0] : product;

        if (ProductDetail.priceEl) {
            ProductDetail.priceEl.textContent = displayProduct.price ? Utils.formatCurrency(displayProduct.price) : 'Fiyat Sorunuz';
        }

        if (ProductDetail.descEl) {
            ProductDetail.descEl.textContent = product.description || 'Açıklama bulunmuyor.';
        }

        // Model
        if (ProductDetail.viewer && displayProduct.masterModel) {
            ProductDetail.viewer.src = displayProduct.masterModel;
            // Optional: Poster setup
            // ProductDetail.viewer.poster = product.thumbnail || '';
        }

        // QR Code Generation
        ProductDetail.generateQRCode(product.id);
    },

    generateQRCode: (productId) => {
        if (!ProductDetail.qrContainer) return;

        // URL for the card page
        const cardUrl = `${window.location.origin}/themes/01_warm sun edition/Warm Sun Edition_Mobile_Product_Card.html?id=${productId}`;

        // Using a simple QR code API (e.g., goqr.me or similar) or a local library if available
        // For now, using a reliable public API for demonstration. 
        // ideally we should include a library like qrcode.js locally.
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(cardUrl)}`;

        ProductDetail.qrContainer.innerHTML = `
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(0,0,0,0.05);">
                <label class="section-label">Mobilde Görüntüle (AR)</label>
                <img src="${qrApiUrl}" alt="QR Code" style="border-radius: 12px; mix-blend-mode: multiply;">
                <p style="font-size: 12px; color: var(--text-muted); margin-top: 8px;">Bu kodu telefonunuzla taratın.</p>
            </div>
        `;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    ProductDetail.init();
});
