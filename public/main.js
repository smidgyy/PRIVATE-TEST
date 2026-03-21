// AURORA OS - MAIN MODULE
// This module runs after auth-init.js

// SINGLE SOURCE OF TRUTH
const userId = window.userId || localStorage.getItem('aurora_user_id');
if (userId) {
  window.userId = userId;
}

window.getUserId = () => window.userId || (typeof window.ensureUserId === 'function' ? window.ensureUserId() : localStorage.getItem('aurora_user_id'));

// Expose for compatibility
window.userIdReady = Promise.resolve(window.userId);

// Expose minimal interface for compatibility with existing scripts
window.onAuthReady = (callback) => {
  setTimeout(() => {
    if (typeof callback === 'function') {
      callback({ uid: window.userId });
    }
  }, 0);
};

// Mock firestore for any legacy scripts
window.firestore = {
  doc: () => ({}),
  getDoc: () => Promise.resolve({ exists: () => false }),
  setDoc: () => Promise.resolve(),
  updateDoc: () => Promise.resolve()
};


