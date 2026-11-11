import { db } from '../src/firebase/config.ts';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';

async function clearCollections() {
  console.log('Connecting to Firestore to clear demo data...');
  const collectionsToClear = ['sessions', 'records', 'students'];

  for (const colName of collectionsToClear) {
    try {
      const snap = await getDocs(collection(db, colName));
      console.log(`Found ${snap.size} documents in collection "${colName}"`);
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.forEach(d => {
          batch.delete(doc(db, colName, d.id));
        });
        await batch.commit();
        console.log(`Successfully deleted all ${snap.size} documents from "${colName}"`);
      }
    } catch (e) {
      console.error(`Error clearing collection "${colName}":`, e);
    }
  }

  console.log('All demo sessions, records, and student lists have been cleared from Firestore.');
  process.exit(0);
}

clearCollections();
