// AURORA OS - MAIN INITIALIZATION
(function() {
  // The backend is the sole source of truth.
  // We wait for authReady event from auth-init.js
  window.addEventListener('authReady', async (event) => {
    const userState = event.detail;
    console.log("AURORA OS: Main initialized with state:", userState);
    
    // Initialize UI based on userState if needed
    if (typeof window.syncProgression === 'function') {
      await window.syncProgression();
      
      // ONLY AFTER syncProgression, we can consider the UI "rendered" or "ready"
      // If there was a renderUI function, we would call it here.
      if (typeof window.arrangeIcons === 'function') {
        window.arrangeIcons();
      }
    }
  });
})();


