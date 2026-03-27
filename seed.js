const PocketBase = require('pocketbase/cjs');

async function seed() {
    const pb = new PocketBase('http://127.0.0.1:8090');
    
    // Auth as superuser
    try {
        await pb.collection('_superusers').authWithPassword('admin@citybeat.local', 'password123456');
        console.log("Authenticated as superuser.");
    } catch (e) {
        console.error("Auth failed:", e.message, e.response);
        process.exit(1);
    }

    // Update Collection Rules
    console.log("Updating collection rules...");
    try {
        const collections = await pb.collections.getFullList();
        for (const col of collections) {
            if (col.name === 'articles') {
                col.listRule = 'is_published = true';
                col.viewRule = 'is_published = true';
                await pb.collections.update(col.id, col);
                console.log("Updated articles rules.");
            }
            if (col.name === 'ad_campaigns') {
                col.listRule = 'status = "active"';
                await pb.collections.update(col.id, col);
                console.log("Updated ad_campaigns rules.");
            }
        }
    } catch (e) {
        console.error("Failed to update rules:", e.message, e.response);
    }

    // Create Categories
    const categories = [
        { id: 'cat_politics', slug: 'politics', name_en: 'Politics', name_es: 'Política' },
        { id: 'cat_arts', slug: 'arts', name_en: 'Arts & Culture', name_es: 'Artes y Cultura' }
    ];

    for (const cat of categories) {
        try {
            await pb.collection('categories').create(cat);
            console.log(`Created category: ${cat.slug}`);
        } catch (e) {
            console.log(`Category ${cat.slug} failed: ${e.message}`, JSON.stringify(e.response?.data || {}));
        }
    }

    // Create Articles
    const articles = [
        {
            id: 'story_election',
            slug: 'local-election-preview',
            title_en: 'City Council Election Preview 2026',
            title_es: 'Avance de las Elecciones al Concejo Municipal 2026',
            excerpt_en: 'A comprehensive look at the candidates running for city council this year.',
            excerpt_es: 'Una mirada completa a los candidatos que se postulan para el concejo municipal este año.',
            category: 'cat_politics',
            is_published: true,
            published_at: (new Date()).toISOString(),
        },
        {
            id: 'story_gallery',
            slug: 'new-gallery-opening',
            title_en: 'Neon Gallery Opens in Downtown',
            title_es: 'La Galería Neón Abre en el Centro',
            excerpt_en: 'The citys newest art space celebrates local contemporary artists.',
            excerpt_es: 'El espacio de arte más nuevo de la ciudad celebra a los artistas contemporáneos locales.',
            category: 'cat_arts',
            is_published: true,
            published_at: (new Date()).toISOString(),
        }
    ];

    for (const story of articles) {
        try {
            await pb.collection('articles').create(story);
            console.log(`Created article: ${story.slug}`);
        } catch (e) {
            console.log(`Article ${story.slug} failed: ${e.message}`, JSON.stringify(e.response?.data || {}));
        }
    }
    
    console.log("Seeding complete.");
}

seed().catch(console.error);
