// AURORA OS - AUTH INITIALIZATION (NON-BLOCKING)
(function() {
  function ensureUserId() {
    const params = new URLSearchParams(window.location.search);
    let id = params.get('userId');
    
    if (!id) {
      // If no userId in URL, generate a temporary one
      id = 'user_' + Math.random().toString(36).substring(2, 11);
      console.log("USER ID GENERATED (TEMP): " + id);
    } else {
      if (!window.userIdLogged) {
        console.log("USER ID LOADED: " + id);
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
