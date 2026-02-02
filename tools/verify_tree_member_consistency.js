/*
  verify_tree_member_consistency.js

  Run with Node using a Firebase service account key to inspect trees and their members.

  Usage:
    - Install dependencies: npm install firebase-admin
    - Set env var: SERVICE_ACCOUNT=path/to/serviceAccount.json
    - Run: node tools/verify_tree_member_consistency.js

  The script lists trees where `memberCount` disagrees with the actual number
  of documents in `trees/{treeId}/members` and prints samples for investigation.
*/

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const keyPath = process.env.SERVICE_ACCOUNT || process.argv[2];
if (!keyPath) {
  console.error('Provide service account JSON path in SERVICE_ACCOUNT env or as first arg');
  process.exit(1);
}

if (!fs.existsSync(keyPath)) {
  console.error('Service account file not found:', keyPath);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(path.resolve(keyPath)))
});

const db = admin.firestore();

(async () => {
  try {
    console.log('Fetching trees...');
    const treesSnap = await db.collection('trees').get();
    console.log('Total trees:', treesSnap.size);

    const mismatches = [];

    for (const tdoc of treesSnap.docs) {
      const tdata = tdoc.data() || {};
      const tId = tdoc.id;
      const declared = Number(tdata.memberCount || 0);

      const membersSnap = await db.collection('trees').doc(tId).collection('members').get();
      const actual = membersSnap.size;

      if (declared !== actual) {
        const sampleNames = membersSnap.docs.slice(0, 10).map(d => (d.data() || {}).name || null).filter(Boolean);
        mismatches.push({ id: tId, title: tdata.title || tdata.name || '(no title)', declared, actual, sampleNames });
      }
    }

    console.log('\nTrees with memberCount mismatch:', mismatches.length);
    mismatches.slice(0, 200).forEach(m => {
      console.log(`- ${m.id} | ${m.title} | declared=${m.declared} actual=${m.actual} sampleNames=${JSON.stringify(m.sampleNames)}`);
    });

    if (mismatches.length === 0) console.log('No inconsistencies found between memberCount and actual members.');
  } catch (err) {
    console.error('Error running consistency check:', err);
    process.exit(2);
  }
})();
