// Seed example directory listings + ad banners into production Firestore.
// Idempotent: uses deterministic doc IDs, so re-running updates in place.
//
//   node scripts/seed-data.js

const { initializeApp, applicationDefault } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')

initializeApp({ credential: applicationDefault(), projectId: 'kerstenblueprint' })
const db = getFirestore()

const now = FieldValue.serverTimestamp()

const LISTINGS = [
  {
    id: 'seed-elevate-el-paso',
    name: 'Elevate El Paso',
    category: 'Marketing Agency',
    address: '1201 N Mesa St Suite D1, El Paso, TX 79902',
    phone: '(915) 226-4593',
    website: 'https://elevateelpaso.com',
    description:
      'Elevate El Paso is a digital marketing agency specializing in strategic storytelling, social media management, website development, and community outreach — amplifying local brands and building meaningful connections across the borderland.',
    tier: 'premium',
    claim_status: 'approved',
    is_published: true,
    is_sponsored: false,
    image_url: 'https://picsum.photos/seed/elevateelpaso-cover/1600/900',
    gallery_urls: [
      'https://picsum.photos/seed/elevate-1/1200/800',
      'https://picsum.photos/seed/elevate-2/1200/800',
      'https://picsum.photos/seed/elevate-3/1200/800',
    ],
    social_links: {
      instagram: 'https://instagram.com/elevateeptx',
      facebook: 'https://facebook.com/elevateelpasotv',
    },
    hours: {
      Monday: '9:00 AM - 5:00 PM',
      Tuesday: '9:00 AM - 5:00 PM',
      Wednesday: '9:00 AM - 5:00 PM',
      Thursday: '9:00 AM - 5:00 PM',
      Friday: '9:00 AM - 5:00 PM',
      Saturday: 'Closed',
      Sunday: 'Closed',
    },
  },
  {
    id: 'seed-cyo-studio',
    name: 'CYO Studio',
    category: 'Fitness',
    address: 'The Cortez, 310 N Mesa St Ste 401-B, El Paso, TX 79901',
    phone: '(915) 239-7200',
    website: 'https://cyostudio.com',
    description:
      'CYO Studio is a high-intensity, rhythm-based indoor cycling studio offering cycling, yoga, and pilates classes designed to challenge your body, inspire your mind, and push you past your limits. Memberships from $49/mo with a free 3-day trial.',
    tier: 'basic',
    claim_status: 'unclaimed',
    is_published: true,
    is_sponsored: false,
    image_url: null,
    gallery_urls: [],
    social_links: { facebook: 'https://facebook.com/cyostudio' },
    hours: {},
  },
  {
    id: 'seed-10th-planet-el-paso',
    name: '10th Planet Jiu Jitsu El Paso',
    category: 'Martial Arts',
    address: '10854 Pelicano Dr, El Paso, TX 79935',
    phone: '(915) 317-2585',
    website: 'https://10thplanetelpaso.com',
    description:
      "El Paso's premier no-gi jiu-jitsu and Muay Thai training facility. An official Eddie Bravo 10th Planet affiliate since 2005, offering jiu-jitsu, Muay Thai, MMA, and kickboxing across 3,200 sq ft of mat space.",
    tier: 'basic',
    claim_status: 'unclaimed',
    is_published: true,
    is_sponsored: false,
    image_url: null,
    gallery_urls: [],
    social_links: {
      instagram: 'https://instagram.com/10thpelpaso',
      facebook: 'https://facebook.com/10thplanetjjep',
    },
    hours: {},
  },
  {
    id: 'seed-electric-supply-source',
    name: 'Electric Supply Source (ESS)',
    category: 'Electrical Contractor',
    address: '3650 Buckner St, El Paso, TX 79925',
    phone: '(915) 217-2200',
    website: 'https://electricsupplysource.co',
    description:
      'Commercial and industrial electrical contractor with 18+ years of expertise: code-compliant installations, industrial automation, UL 508A control panels, PLC/DCS integration, thermal imaging diagnostics, surveillance, and structured/fiber cabling.',
    tier: 'basic',
    claim_status: 'unclaimed',
    is_published: true,
    is_sponsored: false,
    image_url: null,
    gallery_urls: [],
    social_links: {},
    hours: {},
  },
  {
    id: 'seed-wakala-property-services',
    name: 'Wakala Roll-Offs & Cleaning Services',
    category: 'Property Services',
    address: 'El Paso, TX',
    phone: '(915) 455-1645',
    website: 'https://wakalapropertyservices.com',
    description:
      'Full-service property maintenance across El Paso: dumpster/roll-off rentals, pressure washing, hauling, handyman repairs, yard cleanups, and small remodels for residential and commercial properties.',
    tier: 'basic',
    claim_status: 'unclaimed',
    is_published: true,
    is_sponsored: false,
    image_url: null,
    gallery_urls: [],
    social_links: {},
    hours: {},
  },
]

const BANNERS = [
  {
    id: 'seed-banner-builders-of-the-desert',
    sponsor_name: 'Builders of the Desert',
    title: 'El Paso & Borderland History Tours',
    description:
      'Explore the stories that built the borderland. Guided local-history tours of El Paso, Juárez, and the surrounding desert — book your group today.',
    image_url: 'https://picsum.photos/seed/desert-history-tours/1200/600',
    link_url: 'https://buildersofthedesert.org',
    placement: 'home_top',
    locale: 'all',
    is_active: true,
    priority: 10,
  },
  {
    id: 'seed-banner-mountain-star-cu',
    sponsor_name: 'Mountain Star Credit Union',
    title: 'Banking Built for El Paso',
    description:
      'Local, member-owned banking for the El Paso community — better rates, lower fees, and people who know your neighborhood. Become a member today.',
    image_url: 'https://picsum.photos/seed/mountain-star-cu/1200/600',
    link_url: null, // TODO: set the real Mountain Star CU URL in admin
    placement: 'directory',
    locale: 'all',
    is_active: true,
    priority: 10,
  },
]

async function main() {
  for (const l of LISTINGS) {
    const { id, ...data } = l
    await db
      .collection('directory_listings')
      .doc(id)
      .set({ ...data, owner_id: null, is_seed: true, updated_at: now, created_at: now }, { merge: true })
    console.log('listing ✓', l.name)
  }

  for (const b of BANNERS) {
    const { id, ...data } = b
    await db
      .collection('ad_banners')
      .doc(id)
      .set({ ...data, is_seed: true, updated_at: now, created_at: now }, { merge: true })
    console.log('banner  ✓', b.sponsor_name)
  }

  console.log('\nSeed complete.')
}

main().then(() => process.exit(0)).catch((e) => { console.error('ERR', e.message); process.exit(1) })
