import Database from "better-sqlite3";
import path from "path";

const db = new Database("citybeat.db");

// Enable foreign keys
db.pragma("foreign_keys = ON");

export function initDb() {
  // Categories
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL
    )
  `);

  // Authors
  db.exec(`
    CREATE TABLE IF NOT EXISTS authors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      avatar TEXT NOT NULL,
      bio TEXT NOT NULL
    )
  `);

  // Stories
  db.exec(`
    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      dek TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      category_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      date TEXT NOT NULL,
      read_time TEXT NOT NULL,
      hero_image TEXT NOT NULL,
      content TEXT NOT NULL,
      is_sponsored INTEGER DEFAULT 0,
      sponsor_name TEXT,
      sponsor_logo TEXT,
      featured INTEGER DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (author_id) REFERENCES authors(id)
    )
  `);

  // Events
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      venue TEXT NOT NULL,
      price TEXT NOT NULL,
      category TEXT NOT NULL,
      image TEXT NOT NULL,
      description TEXT NOT NULL
    )
  `);

  // Newsletters
  db.exec(`
    CREATE TABLE IF NOT EXISTS newsletters (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      preview_text TEXT NOT NULL,
      cover_image TEXT NOT NULL
    )
  `);

  // Ad Campaigns
  db.exec(`
    CREATE TABLE IF NOT EXISTS ad_campaigns (
      id TEXT PRIMARY KEY,
      client_name TEXT NOT NULL,
      placement TEXT NOT NULL,
      status TEXT NOT NULL,
      impressions INTEGER NOT NULL,
      clicks INTEGER NOT NULL,
      cost INTEGER NOT NULL
    )
  `);
}

export default db;
