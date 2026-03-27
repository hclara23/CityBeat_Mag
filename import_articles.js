const PocketBase = require('pocketbase/cjs');
const fs = require('fs');

const pb = new PocketBase('http://127.0.0.1:8090');

async function importData() {
    const data = JSON.parse(fs.readFileSync('extracted_data.json', 'utf8'));
    
    // Ensure categories exist
    const categories = {};
    for (const article of data) {
        if (!categories[article.category_slug]) {
            try {
                const record = await pb.collection('categories').getFirstListItem(`slug="${article.category_slug}"`);
                categories[article.category_slug] = record.id;
            } catch (e) {
                const record = await pb.collection('categories').create({
                    name_en: article.category_name_en,
                    name_es: article.category_name_es,
                    slug: article.category_slug
                });
                categories[article.category_slug] = record.id;
            }
        }
        
        // Create article
        try {
            await pb.collection('articles').create({
                title_en: article.title_en,
                title_es: article.title_es,
                excerpt_en: article.excerpt_en,
                excerpt_es: article.excerpt_es,
                slug: article.slug,
                category: categories[article.category_slug],
                is_published: article.is_published,
                published_at: article.published_at
            });
            console.log(`Imported: ${article.title_en}`);
        } catch (e) {
            console.log(`Failed/Duplicate: ${article.title_en}`);
        }
    }
}

importData();
