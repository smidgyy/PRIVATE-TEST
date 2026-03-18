import { auth, db, loginAnonymously, onAuthReady } from './firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

// Attach to window so inline scripts can use them
(window as any).firebaseAuth = auth;
(window as any).firebaseDb = db;
(window as any).loginAnonymously = loginAnonymously;
(window as any).onAuthReady = onAuthReady;
(window as any).firestore = { doc, getDoc, setDoc, updateDoc };

// Automatically log in anonymously on load
loginAnonymously().then((user) => {
  console.log("Logged in as:", user.uid);
  localStorage.setItem('aurora_userId', user.uid);
  // Ensure user document exists
  const userRef = doc(db, 'users', user.uid);
  getDoc(userRef).then((docSnap) => {
    if (!docSnap.exists()) {
      setDoc(userRef, {
        stage: 1,
        unlockedNodes: [],
        completedSteps: []
      });
    }
  });
}).catch(err => {
  console.error("Firebase login failed, using local fallback:", err);
  if (!localStorage.getItem('aurora_userId')) {
    localStorage.setItem('aurora_userId', 'local_' + Math.random().toString(36).substring(2, 11));
  }
});
