import db from "./db";
import { CATEGORIES, AUTHORS, STORIES, EVENTS, NEWSLETTERS, AD_CAMPAIGNS } from "../lib/data";

export function seedDb() {
  const check = db.prepare("SELECT count(*) as count FROM stories").get() as { count: number };
  
  if (check.count > 0) {
    console.log("Database already seeded.");
    return;
  }

  console.log("Seeding database...");

  const insertCategory = db.prepare(`
    INSERT INTO categories (id, name, slug, color) VALUES (@id, @name, @slug, @color)
  `);

  const insertAuthor = db.prepare(`
    INSERT INTO authors (id, name, role, avatar, bio) VALUES (@id, @name, @role, @avatar, @bio)
  `);

  const insertStory = db.prepare(`
    INSERT INTO stories (
      id, title, dek, slug, category_id, author_id, date, read_time, hero_image, content, 
      is_sponsored, sponsor_name, sponsor_logo, featured
    ) VALUES (
      @id, @title, @dek, @slug, @category_id, @author_id, @date, @readTime, @heroImage, @content,
      @isSponsored, @sponsorName, @sponsorLogo, @featured
    )
  `);

  const insertEvent = db.prepare(`
    INSERT INTO events (id, title, date, time, venue, price, category, image, description)
    VALUES (@id, @title, @date, @time, @venue, @price, @category, @image, @description)
  `);

  const insertNewsletter = db.prepare(`
    INSERT INTO newsletters (id, title, date, preview_text, cover_image)
    VALUES (@id, @title, @date, @previewText, @coverImage)
  `);

  const insertCampaign = db.prepare(`
    INSERT INTO ad_campaigns (id, client_name, placement, status, impressions, clicks, cost)
    VALUES (@id, @clientName, @placement, @status, @impressions, @clicks, @cost)
  `);

  const insertMany = db.transaction(() => {
    for (const cat of CATEGORIES) insertCategory.run(cat);
    for (const auth of AUTHORS) insertAuthor.run(auth);
    for (const story of STORIES) {
      insertStory.run({
        ...story,
        category_id: story.category.id,
        author_id: story.author.id,
        isSponsored: story.isSponsored ? 1 : 0,
        featured: story.featured ? 1 : 0,
        sponsorName: story.sponsorName || null,
        sponsorLogo: story.sponsorLogo || null
      });
    }
    for (const event of EVENTS) insertEvent.run(event);
    for (const news of NEWSLETTERS) insertNewsletter.run(news);
    for (const ad of AD_CAMPAIGNS) insertCampaign.run(ad);
  });

  insertMany();
  console.log("Database seeded successfully.");
}

// Force update the hero image for the first story to ensure it reflects the latest change
// even if the database was already seeded.
try {
  db.prepare("UPDATE stories SET hero_image = ? WHERE id = '1'").run("https://fal.media/files/monkey/o7C4_1740050785368.png");
  console.log("Updated hero image for story 1.");
} catch (error) {
  console.error("Failed to update hero image:", error);
}
