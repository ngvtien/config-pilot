const https = require('https');
const fs = require('fs');
const path = require('path');

// Create public/js directory if it doesn't exist
const jsDir = path.join('public', 'js');
if (!fs.existsSync('public')) {
    fs.mkdirSync('public');
}
if (!fs.existsSync(jsDir)) {
    fs.mkdirSync(jsDir);
}

// Updated URLs with correct CDN links
const libraries = [
    {
        name: 'Three.js',
        url: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.179.1/three.module.min.js',
        filename: 'three.min.js'
    },
    {
        name: 'Anime.js',
        url: 'https://cdn.jsdelivr.net/npm/animejs@3.2.1/lib/anime.min.js',
        filename: 'anime.min.js'
    }
];

/**
 * Downloads a file from a URL and saves it to the specified path
 * @param {string} url - The URL to download from
 * @param {string} filePath - The local file path to save to
 * @returns {Promise} - Promise that resolves when download is complete
 */
function downloadFile(url, filePath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filePath);
        
        https.get(url, (response) => {
            // Handle redirects
            if (response.statusCode === 301 || response.statusCode === 302) {
                return downloadFile(response.headers.location, filePath)
                    .then(resolve)
                    .catch(reject);
            }
            
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                return;
            }
            
            response.pipe(file);
            
            file.on('finish', () => {
                file.close();
                resolve();
            });
            
            file.on('error', (err) => {
                fs.unlink(filePath, () => {}); // Delete the file on error
                reject(err);
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * Main function to download all libraries
 */
async function downloadLibraries() {
    console.log('Downloading JavaScript libraries...');
    console.log('');
    
    for (const lib of libraries) {
        try {
            console.log(`Downloading ${lib.name}...`);
            const filePath = path.join(jsDir, lib.filename);
            await downloadFile(lib.url, filePath);
            console.log(`✓ ${lib.name} downloaded successfully`);
        } catch (error) {
            console.log(`✗ Failed to download ${lib.name}: ${error.message}`);
            process.exit(1);
        }
    }
    
    console.log('');
    console.log('All libraries downloaded successfully!');
    console.log('Files saved to public/js/');
}

// Run the download process
downloadLibraries().catch((error) => {
    console.error('Download process failed:', error.message);
    process.exit(1);
});