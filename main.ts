// Generate or retrieve a persistent session ID
let userId = localStorage.getItem('aurora_userId');
if (!userId) {
  userId = 'user_' + Math.random().toString(36).substring(2, 11);
  localStorage.setItem('aurora_userId', userId);
}
console.log(">>> [BOOT] Session ID:", userId);

// Expose minimal interface for compatibility with existing scripts
(window as any).getUserId = () => userId;
(window as any).onAuthReady = (callback: any) => {
  // Simulate auth ready immediately since we're using session IDs
  setTimeout(() => {
    if (typeof callback === 'function') {
      callback({ uid: userId });
    }
  }, 100);
};

// Mock firestore for any legacy scripts that might try to access it
(window as any).firestore = {
  doc: () => ({}),
  getDoc: () => Promise.resolve({ exists: () => false }),
  setDoc: () => Promise.resolve(),
  updateDoc: () => Promise.resolve()
};


