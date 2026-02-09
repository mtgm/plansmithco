/**
 * productCard.js
 * Logic for the QR/AR Card Page
 */

const ProductCard = {
    viewer: document.querySelector('model-viewer'),

    init: async () => {
        await window.dataManager.init();
        const productId = Utils.getQueryParam('id');

        if (productId) {
            const product = window.dataManager.getProductById(productId);
            if (product) {
                ProductCard.renderProduct(product);
            }
        }

        // Handle Back Button
        const backBtn = document.querySelector('.btn-back');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                // If opened directly, maybe redirect to list?
                if (document.referrer) {
                    window.history.back();
                } else {
                    window.location.href = 'Warm Sun Edition_Product_List.html';
                }
            });
        }
    },

    renderProduct: (product) => {
        // Find display product (first variant or self)
        const displayProduct = product.products && product.products.length > 0 ? product.products[0] : product;

        if (ProductCard.viewer && displayProduct.masterModel) {
            ProductCard.viewer.src = displayProduct.masterModel;
            ProductCard.viewer.iosSrc = displayProduct.masterModel.replace('.glb', '.usdz'); // Simple assumption if exists
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    ProductCard.init();
});
