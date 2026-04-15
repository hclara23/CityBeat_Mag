const PocketBase = require('pocketbase/cjs');

async function debugSchema() {
    const pb = new PocketBase('http://127.0.0.1:8090');
    await pb.collection('_superusers').authWithPassword('admin@citybeat.local', 'password123456');
    const col = await pb.collections.getOne('users');
    console.log("Field 0:", JSON.stringify(col.fields[0]));
    console.log("All Fields:", col.fields.map(f => `${f.name}:${f.type}`).join(", "));
}

debugSchema().catch(console.error);
