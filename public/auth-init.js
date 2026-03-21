// AURORA OS - AUTH INITIALIZATION (NON-BLOCKING)
(function() {
  function ensureUserId() {
    let id = localStorage.getItem('aurora_user_id');
    if (!id) {
      id = 'user_' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('aurora_user_id', id);
      console.log("USER ID READY: " + id);
    } else {
      // Only log once per session if possible, but the requirement says "Add only one clean log when the userId is created or loaded"
      // We'll use a session flag to avoid spamming on every page load if it's an iframe, 
      // but let's just log it once as requested.
      if (!window.userIdLogged) {
        console.log("USER ID READY: " + id);
        window.userIdLogged = true;
      }
    }
    window.userId = id;
    return id;
  }

  // Initialize immediately
  ensureUserId();

  // Expose helper
  window.ensureUserId = ensureUserId;
  
  // Compatibility helpers
  window.getUserId = () => window.userId || ensureUserId();
  window.userIdReady = Promise.resolve(window.userId);
  
  window.onAuthReady = (callback) => {
    if (typeof callback === 'function') {
      callback({ uid: window.userId });
    }
  };
})();
