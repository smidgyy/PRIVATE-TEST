// AURORA OS - AUTH INITIALIZATION (NON-BLOCKING)
(function() {
  // We no longer generate or trust userId from the client.
  // The backend handles session-based userId via HttpOnly cookies.
  window.userId = 'session_managed'; 
  window.userState = null;
  window.isAuthReady = false;

  async function initializeSession() {
    try {
      const response = await fetch('/api/init', { method: 'POST' });
      const data = await response.json();
      if (data.status === 'success') {
        window.userState = data.state;
        window.userId = data.state.userId;
        window.isAuthReady = true;
        console.log("AURORA OS: Session initialized successfully.");
        
        // Dispatch event for components that need to know when auth is ready
        window.dispatchEvent(new CustomEvent('authReady', { detail: data.state }));
      }
    } catch (error) {
      console.error("AURORA OS: Failed to initialize session:", error);
    }
  }

  // Initialize immediately
  initializeSession();

  // Compatibility helpers (deprecated but kept for legacy scripts)
  window.ensureUserId = () => window.userId;
  window.getUserId = () => window.userId;
  window.userIdReady = new Promise((resolve) => {
    window.addEventListener('authReady', (e) => resolve(e.detail.userId));
  });
  
  window.onAuthReady = (callback) => {
    if (window.isAuthReady) {
      callback({ uid: window.userId, state: window.userState });
    } else {
      window.addEventListener('authReady', (e) => callback({ uid: e.detail.userId, state: e.detail }));
    }
  };
})();
