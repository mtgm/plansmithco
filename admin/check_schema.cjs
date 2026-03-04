
const https = require('https');

const url = 'https://yfweguudxujusijbkbus.supabase.co/rest/v1';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlmd2VndXVkeHVqdXNpamJrYnVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzODAxMDcsImV4cCI6MjA4NTk1NjEwN30.bSsfrlbkcwOIH1QXFbdSk2exLLhJ9BYFzYpkihkqJu4';

function get(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'yfweguudxujusijbkbus.supabase.co',
            path: `/rest/v1/${path}`,
            method: 'GET',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve(data);
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.end();
    });
}

async function run() {
    try {
        const variants = JSON.parse(await get('variant_options?limit=1'));
        if (variants && variants.length > 0) {
            console.log('Variant Columns:', Object.keys(variants[0]));
        } else {
            console.log('No variants found or error:', variants);
        }

        const categories = JSON.parse(await get('categories?limit=1'));
        if (categories && categories.length > 0) {
            console.log('Category Columns:', Object.keys(categories[0]));
        } else {
            console.log('No categories found or error:', categories);
        }
    } catch (e) {
        console.error(e);
    }
}

run();
