// Cleanup script to remove temporary user documents
// These are user documents created with fake UIDs before the invitation system was implemented

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const argv = require('minimist')(process.argv.slice(2));
const serviceAccountPath = process.env.SERVICE_ACCOUNT || argv.serviceAccount || argv.serviceAccountPath || 'serviceAccountKey.json';

if (!fs.existsSync(serviceAccountPath)) {
  console.error('Service account JSON not found at', serviceAccountPath);
  console.error('Set SERVICE_ACCOUNT env var or pass --serviceAccount path/to/serviceAccount.json');
  process.exit(1);
}

const serviceAccount = require(path.resolve(serviceAccountPath));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function cleanupTempUsers() {
  try {
    console.log('🔍 Scanning for temporary user documents...\n');
    
    const usersSnapshot = await db.collection('users').get();
    
    const tempUsers = [];
    const validUsers = [];
    
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      // Temp UIDs start with "user_" followed by timestamp
      if (doc.id.startsWith('user_')) {
        tempUsers.push({
          uid: doc.id,
          email: data.email || 'Unknown',
          displayName: data.displayName || 'N/A',
          role: data.role || 'N/A',
          createdAt: data.createdAt || 'N/A'
        });
      } else {
        validUsers.push(doc.id);
      }
    });
    
    console.log(`✓ Valid users: ${validUsers.length}`);
    console.log(`⚠ Temporary users found: ${tempUsers.length}\n`);
    
    if (tempUsers.length === 0) {
      console.log('✅ No temporary users to clean up!');
      process.exit(0);
      return;
    }
    
    console.log('The following temporary user documents will be DELETED:\n');
    tempUsers.forEach(user => {
      console.log(`  📧 ${user.email}`);
      console.log(`     UID: ${user.uid}`);
      console.log(`     Name: ${user.displayName}`);
      console.log(`     Role: ${user.role}`);
      console.log(`     Created: ${user.createdAt}`);
      console.log('');
    });
    
    // Confirmation prompt
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question('Do you want to delete these temporary users? (yes/no): ', async (answer) => {
      readline.close();
      
      if (answer.toLowerCase() !== 'yes') {
        console.log('❌ Cleanup cancelled.');
        process.exit(0);
        return;
      }
      
      // Delete them
      console.log('\n🗑️  Deleting temporary users...\n');
      
      for (const user of tempUsers) {
        await db.collection('users').doc(user.uid).delete();
        console.log(`✓ Deleted: ${user.uid} (${user.email})`);
      }
      
      console.log(`\n✅ Cleanup complete! Deleted ${tempUsers.length} temporary user(s).`);
      console.log('\n💡 TIP: If these users need to be added back, use the User Management');
      console.log('   page to create invitations for them. They will be properly set up');
      console.log('   when they log in for the first time.');
      
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupTempUsers();
