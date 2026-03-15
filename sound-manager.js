class SoundManager {
  constructor() {
    this.sounds = {
      glitch: new Audio('sounds/glitch.wav'),
      typing: new Audio('sounds/typing.wav'),
      notification: new Audio('sounds/notification.wav'),
      warning: new Audio('sounds/warning.wav'),
      unlock: new Audio('sounds/unlock.wav')
    };
    
    // Preload sounds
    Object.values(this.sounds).forEach(audio => {
      audio.load();
    });
  }

  playKeystroke() {
    this.sounds.typing.currentTime = 0;
    this.sounds.typing.play().catch(e => console.error("Audio play failed:", e));
  }

  playError() {
    this.sounds.warning.currentTime = 0;
    this.sounds.warning.play().catch(e => console.error("Audio play failed:", e));
  }

  playSuccess() {
    this.sounds.unlock.currentTime = 0;
    this.sounds.unlock.play().catch(e => console.error("Audio play failed:", e));
  }

  playPing() {
    this.sounds.notification.currentTime = 0;
    this.sounds.notification.play().catch(e => console.error("Audio play failed:", e));
  }

  playGlitch() {
    this.sounds.glitch.currentTime = 0;
    this.sounds.glitch.play().catch(e => console.error("Audio play failed:", e));
  }

  playHover() {}
  playWindowOpen() {}
  playWindowClose() {}
  playClick() {}
  playSystemError() { this.playError(); }
  startComputerHum() {}
  startFireCrackling() {}
  stopFireCrackling() {}
  playDissolve() {}
  startBlackFire() {}
}

window.soundManager = new SoundManager();

document.addEventListener('DOMContentLoaded', () => {
  const inputs = document.querySelectorAll('input[type="text"]');
  inputs.forEach(input => {
    input.addEventListener('input', () => {
      if (window.soundManager) window.soundManager.playKeystroke();
    });
  });
});
