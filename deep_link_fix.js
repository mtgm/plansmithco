// Handle deep linking - load product if SKU is in URL
function handleDeepLink() {
    const urlParams = new URLSearchParams(window.location.search);
    const sku = urlParams.get('sku');

    if (!sku) {
        return; // No SKU in URL, nothing to do
    }

    // Find product by SKU across all categories
    for (const category of allData) {
        const product = category.products.find(p => p.sku === sku);
        if (product) {
            // Open category first
            openCategory(category);
            // Then select product
            setTimeout(() => selectProduct(product), 100);
            return;
        }
    }

    console.warn(`Product with SKU "${sku}" not found`);
}
