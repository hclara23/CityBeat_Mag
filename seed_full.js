const PocketBase = require('pocketbase/cjs');

async function main() {
    const pb = new PocketBase('http://127.0.0.1:8090');
    await pb.collection('_superusers').authWithPassword('admin@citybeat.local', 'password123456');
    console.log("Authenticated as superuser.");

    // Delete in reverse order
    const order = ['ad_clicks', 'ad_campaigns', 'ad_placements', 'sponsors', 'articles', 'categories'];
    const cols = await pb.collections.getFullList();
    for (const name of order) {
        const col = cols.find(c => c.name === name);
        if (col) {
            try { await pb.collections.delete(col.id); console.log(`Deleted: ${name}`); } catch (e) {}
        }
    }

    // Create Collections
    const catCol = await pb.collections.create({
        name: 'categories', type: 'base',
        fields: [
            { name: 'slug', type: 'text', required: true },
            { name: 'name_en', type: 'text', required: true },
            { name: 'name_es', type: 'text', required: true }
        ],
        listRule: '', viewRule: ''
    });

    await pb.collections.create({
        name: 'articles', type: 'base',
        fields: [
            { name: 'slug', type: 'text', required: true },
            { name: 'title_en', type: 'text', required: true },
            { name: 'title_es', type: 'text', required: true },
            { name: 'excerpt_en', type: 'text' },
            { name: 'excerpt_es', type: 'text' },
            { name: 'content_en', type: 'editor' },
            { name: 'content_es', type: 'editor' },
            { name: 'category', type: 'relation', collectionId: catCol.id, maxSelect: 1 },
            { name: 'is_published', type: 'bool' },
            { name: 'published_at', type: 'date' }
        ],
        listRule: 'is_published = true', viewRule: 'is_published = true'
    });

    // Seed Data
    console.log("Seeding data...");
    await pb.collection('categories').create({ id: 'catpolitics0001', slug: 'politics', name_en: 'Politics', name_es: 'Política' });
    await pb.collection('categories').create({ id: 'catartscult0001', slug: 'arts', name_en: 'Arts & Culture', name_es: 'Artes y Cultura' });

    await pb.collection('articles').create({
        id: 'artelection0001',
        slug: 'local-election-preview',
        title_en: 'City Council Election Preview 2026',
        title_es: 'Avance de las Elecciones al Concejo Municipal 2026',
        excerpt_en: 'A comprehensive look at the candidates.',
        excerpt_es: 'Avance de candidatos.',
        category: 'catpolitics0001',
        is_published: true,
        published_at: (new Date()).toISOString()
    });

    await pb.collection('articles').create({
        id: 'artgallery00001',
        slug: 'new-gallery-opening',
        title_en: 'Neon Gallery Opens in Downtown',
        title_es: 'La Galería Neón Abre en el Centro',
        excerpt_en: 'The citys newest art space.',
        excerpt_es: 'Nueva galería.',
        category: 'catartscult0001',
        is_published: true,
        published_at: (new Date()).toISOString()
    });

    console.log("Full seeding complete successfully.");
}

main().catch(e => {
    console.error("Failed:", e.message, JSON.stringify(e.response?.data || {}));
    process.exit(1);
});
