/**
 * utils.js
 * Common utility functions for the application
 */

const Utils = {
    /**
     * Get a query parameter from the URL
     * @param {string} param 
     * @returns {string|null}
     */
    getQueryParam: (param) => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    },

    /**
     * Format a number as currency (TRY)
     * @param {number} amount 
     * @returns {string}
     */
    formatCurrency: (amount) => {
        return new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: 'TRY',
            minimumFractionDigits: 0
        }).format(amount);
    },

    /**
     * Debounce function for search inputs
     * @param {Function} func 
     * @param {number} wait 
     */
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Update URL without reloading page
     * @param {string} key 
     * @param {string} value 
     */
    updateUrlParam: (key, value) => {
        const url = new URL(window.location);
        if (value) {
            url.searchParams.set(key, value);
        } else {
            url.searchParams.delete(key);
        }
        window.history.pushState({}, '', url);
    },

    /**
     * Create an element with classes and content
     * @param {string} tag 
     * @param {string[]} classes 
     * @param {string} text 
     * @returns {HTMLElement}
     */
    createElement: (tag, classes = [], text = '') => {
        const el = document.createElement(tag);
        if (classes.length) el.classList.add(...classes);
        if (text) el.textContent = text;
        return el;
    }
};

// Make available globally
window.Utils = Utils;
