// AURORA OS - MAIN INITIALIZATION
(function() {
  // The backend is the sole source of truth.
  // We wait for authReady event from auth-init.js
  window.addEventListener('authReady', (event) => {
    const userState = event.detail;
    console.log("AURORA OS: Main initialized with state:", userState);
    
    // Initialize UI based on userState if needed
    if (typeof window.syncProgression === 'function') {
      window.syncProgression();
    }
  });
})();


