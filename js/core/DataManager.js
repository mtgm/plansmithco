/**
 * DataManager.js
 * Handles fetching and filtering of product data from products.json
 */
class DataManager {
    constructor(dataUrl = './products.json') {
        this.dataUrl = dataUrl;
        this.products = [];
        this.categories = [];
        this.isLoaded = false;
    }

    /**
     * Initializes the data manager by fetching data
     * @returns {Promise<void>}
     */
    async init() {
        if (this.isLoaded) return;

        try {
            const response = await fetch(this.dataUrl);
            if (!response.ok) throw new Error(`Failed to load data: ${response.status}`);

            const data = await response.json();
            this.processData(data);
            this.isLoaded = true;
            console.log('DataManager initialized with', this.products.length, 'products');
        } catch (error) {
            console.error('Error initializing DataManager:', error);
            throw error;
        }
    }

    /**
     * Process raw JSON data into a flat product list and categories
     * @param {Array} rawData 
     */
    processData(rawData) {
        this.products = [];
        this.categories = [];

        rawData.forEach(category => {
            this.categories.push({
                id: category.id,
                name: category.name,
                description: category.description,
                thumbnail: category.thumbnail
            });

            if (category.products && Array.isArray(category.products)) {
                category.products.forEach(prod => {
                    // Inject category info into product for easier access
                    this.products.push({
                        ...prod,
                        categoryId: category.id,
                        categoryName: category.name
                    });
                });
            }
        });
    }

    /**
     * Get all products
     * @returns {Array}
     */
    getAllProducts() {
        return this.products;
    }

    /**
     * Get a specific product by ID
     * @param {string} id 
     * @returns {Object|undefined}
     */
    getProductById(id) {
        return this.products.find(p => p.id === id);
    }

    /**
     * Get products by category ID
     * @param {string} categoryId 
     * @returns {Array}
     */
    getProductsByCategory(categoryId) {
        return this.products.filter(p => p.categoryId === categoryId);
    }

    /**
     * Search products by name (case insensitive)
     * @param {string} query 
     * @returns {Array}
     */
    searchProducts(query) {
        if (!query) return this.products;
        const lowerQuery = query.toLowerCase();
        return this.products.filter(p =>
            p.name.toLowerCase().includes(lowerQuery) ||
            (p.description && p.description.toLowerCase().includes(lowerQuery))
        );
    }
}

// Export a singleton instance globally
window.dataManager = new DataManager();
