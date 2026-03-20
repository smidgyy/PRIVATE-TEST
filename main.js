// Generate or retrieve a persistent session ID
let userId = localStorage.getItem('aurora_userId');
if (!userId) {
  userId = 'user_' + Math.random().toString(36).substring(2, 11);
  localStorage.setItem('aurora_userId', userId);
}

// SINGLE SOURCE OF TRUTH
window.userId = userId;
window.getUserId = () => window.userId;

console.log("USER ID INITIALIZED:", window.userId);

// Provide a promise for readiness
window.userIdReady = Promise.resolve(window.userId);

// Expose minimal interface for compatibility with existing scripts
window.onAuthReady = (callback) => {
  // Simulate auth ready immediately since we're using session IDs
  setTimeout(() => {
    if (typeof callback === 'function') {
      callback({ uid: window.userId });
    }
  }, 100);
};

// Mock firestore for any legacy scripts that might try to access it
window.firestore = {
  doc: () => ({}),
  getDoc: () => Promise.resolve({ exists: () => false }),
  setDoc: () => Promise.resolve(),
  updateDoc: () => Promise.resolve()
};


