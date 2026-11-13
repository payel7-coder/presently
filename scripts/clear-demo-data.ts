import { db } from '../src/firebase/config.ts';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';

const DEMO_USER_IDS = new Set([
  'teacher-tanvir',
  'teacher-nusrat',
  'teacher-hasan',
  'admin-principal',
]);

async function clearCollections() {
  console.log('Connecting to Firestore to clear demo data and demo teachers...');
  const collectionsToClear = ['sessions', 'records', 'students', 'assignments'];

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

  try {
    const userSnap = await getDocs(collection(db, 'users'));
    console.log(`Found ${userSnap.size} documents in collection "users"`);
    if (!userSnap.empty) {
      const batch = writeBatch(db);
      let deletedCount = 0;
      userSnap.forEach(d => {
        const data = d.data() as { email?: string; role?: string };
        const isPayelAdmin =
          d.id === 'admin-payel' ||
          (data.email && data.email.toLowerCase() === 'payelahmed70@gmail.com');
        if (DEMO_USER_IDS.has(d.id) || (!isPayelAdmin && data.role === 'teacher')) {
          batch.delete(doc(db, 'users', d.id));
          deletedCount++;
        }
      });
      if (deletedCount > 0) {
        await batch.commit();
        console.log(`Removed ${deletedCount} demo/residual teacher user(s) from "users".`);
      } else {
        console.log('No demo/residual teachers found in "users".');
      }
    }
  } catch (e) {
    console.error('Error cleaning demo users:', e);
  }

  console.log('Clean database ready: zero demo sessions, records, students, assignments, or demo teachers.');
  process.exit(0);
}

clearCollections();
