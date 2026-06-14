import { adminAuth } from '../src/firebase/admin';

async function fixUser() {
  try {
    const userRecord = await adminAuth.getUserByEmail('morningstarelp@gmail.com');
    console.log(`Found existing user with UID: ${userRecord.uid}`);
    
    if (userRecord.uid !== '7d265d1e-491f-4756-81b2-86b1795fa2e9') {
      console.log('Deleting wrong UID...');
      await adminAuth.deleteUser(userRecord.uid);
      console.log('Deleted. Recreating with correct Supabase UID...');
      
      await adminAuth.createUser({
        uid: '7d265d1e-491f-4756-81b2-86b1795fa2e9',
        email: 'morningstarelp@gmail.com',
        emailVerified: true,
      });
      console.log('Successfully recreated.');
    } else {
      console.log('UID is actually correct.');
    }
  } catch (error) {
    console.error(error);
  }
}

fixUser().then(() => process.exit(0));
