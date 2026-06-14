import { adminAuth } from '../src/firebase/admin';

const users = [
  {
    uid: 'dfc38473-04b4-45b1-9e1b-0cffce5f9aad',
    email: 'citybeat@yahoo.com',
  },
  {
    uid: '01a0ce57-68dd-4356-a459-274d7ee4e6db',
    email: 'citybeatmag@yahoo.com',
  },
  {
    uid: '7d265d1e-491f-4756-81b2-86b1795fa2e9',
    email: 'morningstarelp@gmail.com',
  }
];

async function migrateAuth() {
  console.log('Starting Supabase -> Firebase Auth migration...');
  
  for (const user of users) {
    try {
      // Check if user already exists
      try {
        await adminAuth.getUser(user.uid);
        console.log(`User ${user.email} (${user.uid}) already exists in Firebase. Skipping.`);
        continue;
      } catch (e: any) {
        if (e.code !== 'auth/user-not-found') {
          throw e;
        }
      }

      console.log(`Creating user ${user.email}...`);
      await adminAuth.createUser({
        uid: user.uid,
        email: user.email,
        emailVerified: true,
      });
      console.log(`Successfully created ${user.email}`);
    } catch (error) {
      console.error(`Failed to create user ${user.email}:`, error);
    }
  }
  
  console.log('Migration complete. Users will need to use "Forgot Password" to set a new password on Firebase, or sign in via Magic Link if configured.');
}

migrateAuth().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
