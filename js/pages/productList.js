/**
 * productList.js
 * Logic for the Product List Page
 */

const ProductList = {
    container: document.querySelector('.product-grid'),

    init: async () => {
        await window.dataManager.init();
        ProductList.renderProducts();
        ProductList.setupFilters();
    },

    renderProducts: (filterFn = null) => {
        const products = window.dataManager.getAllProducts();
        const filteredProducts = filterFn ? products.filter(filterFn) : products;

        ProductList.container.innerHTML = '';

        if (filteredProducts.length === 0) {
            ProductList.container.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Ürün bulunamadı.</p>';
            return;
        }

        filteredProducts.forEach(product => {
            const card = ProductList.createProductCard(product);
            ProductList.container.appendChild(card);
        });
    },

    createProductCard: (product) => {
        // Create card element. Using anchor tag for entire card clickability
        const card = document.createElement('a');
        card.className = 'product-card';
        // Navigate to product detail page with ID
        card.href = `Warm Sun Edition_Mobile_Product_Page.html?id=${product.id}`;

        // Find the first variant product if exists, or use the main product itself
        const displayProduct = product.products && product.products.length > 0 ? product.products[0] : product;

        const price = displayProduct.price ? Utils.formatCurrency(displayProduct.price) : 'Fiyat Sorunuz';
        const image = product.thumbnail || 'https://via.placeholder.com/300x300/F3F3F3/aaaaaa?text=No+Image';

        card.innerHTML = `
            <span class="tag-new">YENİ</span>
            <div class="p-img-box">
                <img src="${image}" class="p-img" alt="${product.name}">
                <button class="btn-quick"><i class="ph-bold ph-plus"></i></button>
            </div>
            <div class="p-info">
                <span class="p-cat">${product.categoryName || 'Kategori'}</span>
                <h3 class="p-title">${product.name}</h3>
                <div class="p-price">
                    <span>${price}</span>
                    <div class="p-colors">
                        <!-- Renk ikonları buraya dinamik eklenebilir -->
                    </div>
                </div>
            </div>
        `;

        return card;
    },

    setupFilters: () => {
        // Simple example: Search functionality locally since we have all data
        // This can be expanded based on the filter panel in the HTML
        const searchIcon = document.querySelector('.ph-magnifying-glass');
        if (searchIcon) {
            searchIcon.parentElement.addEventListener('click', () => {
                const query = prompt("Ürün ara:");
                if (query !== null) {
                    const results = window.dataManager.searchProducts(query);
                    ProductList.renderProducts(p => results.includes(p));
                }
            });
        }
    }
};

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    ProductList.init();
});
