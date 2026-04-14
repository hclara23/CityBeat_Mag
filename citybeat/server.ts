import express from "express";
import { createServer as createViteServer } from "vite";
import { initDb } from "./src/db/db";
import { seedDb } from "./src/db/seed";
import db from "./src/db/db";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize and seed database
  initDb();
  seedDb();

  app.use(express.json());

  // API Routes
  
  // Stories
  app.get("/api/stories", (req, res) => {
    const { category, search, featured, limit } = req.query;
    
    let query = `
      SELECT s.*, 
             c.id as cat_id, c.name as cat_name, c.slug as cat_slug, c.color as cat_color,
             a.id as auth_id, a.name as auth_name, a.role as auth_role, a.avatar as auth_avatar, a.bio as auth_bio
      FROM stories s
      JOIN categories c ON s.category_id = c.id
      JOIN authors a ON s.author_id = a.id
      WHERE 1=1
    `;
    
    const params: any[] = [];

    if (category && category !== 'all') {
      query += " AND c.slug = ?";
      params.push(category);
    }

    if (search) {
      query += " AND (s.title LIKE ? OR s.dek LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    if (featured === 'true') {
      query += " AND s.featured = 1";
    }

    query += " ORDER BY s.date DESC";

    if (limit) {
      query += " LIMIT ?";
      params.push(Number(limit));
    }

    const rows = db.prepare(query).all(...params);
    
    const stories = rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      dek: row.dek,
      slug: row.slug,
      date: row.date,
      readTime: row.read_time,
      heroImage: row.hero_image,
      content: row.content,
      isSponsored: Boolean(row.is_sponsored),
      sponsorName: row.sponsor_name,
      sponsorLogo: row.sponsor_logo,
      featured: Boolean(row.featured),
      category: {
        id: row.cat_id,
        name: row.cat_name,
        slug: row.cat_slug,
        color: row.cat_color
      },
      author: {
        id: row.auth_id,
        name: row.auth_name,
        role: row.auth_role,
        avatar: row.auth_avatar,
        bio: row.auth_bio
      }
    }));

    res.json(stories);
  });

  app.get("/api/stories/:slug", (req, res) => {
    const { slug } = req.params;
    
    const row: any = db.prepare(`
      SELECT s.*, 
             c.id as cat_id, c.name as cat_name, c.slug as cat_slug, c.color as cat_color,
             a.id as auth_id, a.name as auth_name, a.role as auth_role, a.avatar as auth_avatar, a.bio as auth_bio
      FROM stories s
      JOIN categories c ON s.category_id = c.id
      JOIN authors a ON s.author_id = a.id
      WHERE s.slug = ?
    `).get(slug);

    if (!row) {
      return res.status(404).json({ error: "Story not found" });
    }

    const story = {
      id: row.id,
      title: row.title,
      dek: row.dek,
      slug: row.slug,
      date: row.date,
      readTime: row.read_time,
      heroImage: row.hero_image,
      content: row.content,
      isSponsored: Boolean(row.is_sponsored),
      sponsorName: row.sponsor_name,
      sponsorLogo: row.sponsor_logo,
      featured: Boolean(row.featured),
      category: {
        id: row.cat_id,
        name: row.cat_name,
        slug: row.cat_slug,
        color: row.cat_color
      },
      author: {
        id: row.auth_id,
        name: row.auth_name,
        role: row.auth_role,
        avatar: row.auth_avatar,
        bio: row.auth_bio
      }
    };

    res.json(story);
  });

  // Categories
  app.get("/api/categories", (req, res) => {
    const categories = db.prepare("SELECT * FROM categories").all();
    res.json(categories);
  });

  // Events
  app.get("/api/events", (req, res) => {
    const { category, limit } = req.query;
    let query = "SELECT * FROM events WHERE 1=1";
    const params: any[] = [];

    if (category && category !== 'all') {
      query += " AND lower(category) = ?";
      params.push(String(category).toLowerCase());
    }

    query += " ORDER BY date ASC";

    if (limit) {
      query += " LIMIT ?";
      params.push(Number(limit));
    }

    const events = db.prepare(query).all(...params);
    res.json(events);
  });

  // Newsletters
  app.get("/api/newsletters", (req, res) => {
    const newsletters = db.prepare("SELECT * FROM newsletters ORDER BY date DESC").all();
    const mapped = newsletters.map((n: any) => ({
      id: n.id,
      title: n.title,
      date: n.date,
      previewText: n.preview_text,
      coverImage: n.cover_image
    }));
    res.json(mapped);
  });

  // Ad Campaigns
  app.get("/api/campaigns", (req, res) => {
    const campaigns = db.prepare("SELECT * FROM ad_campaigns").all();
    const mapped = campaigns.map((c: any) => ({
      id: c.id,
      clientName: c.client_name,
      placement: c.placement,
      status: c.status,
      impressions: c.impressions,
      clicks: c.clicks,
      cost: c.cost
    }));
    res.json(mapped);
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production (placeholder)
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
