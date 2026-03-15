class SoundManager {
  constructor() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new AudioContext();
    this.humOsc = null;
    this.humGain = null;
    this.stage4Osc = null;
    this.stage4Gain = null;
  }

  _resume() {
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playKeystroke() {
    this._resume();
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, this.audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.audioCtx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.05, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.05);
  }

  playError() {
    this._resume();
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(100, this.audioCtx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.2);
  }

  playSuccess() {
    this._resume();
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, this.audioCtx.currentTime);
    osc.frequency.setValueAtTime(660, this.audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, this.audioCtx.currentTime + 0.05);
    gain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.3);
  }

  playPing() {
    this._resume();
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, this.audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.5);
  }

  playGlitch() {
    this._resume();
    const bufferSize = this.audioCtx.sampleRate * 0.2;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.2);
    noise.connect(gain);
    gain.connect(this.audioCtx.destination);
    noise.start();
  }

  playBoot() {
    this._resume();
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, this.audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.audioCtx.currentTime + 0.5);
    gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, this.audioCtx.currentTime + 0.2);
    gain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 1.0);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 1.0);
  }

  playCrash() {
    this._resume();
    const bufferSize = this.audioCtx.sampleRate * 1.0;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.audioCtx.sampleRate * 0.2));
    }
    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 1.0);
    noise.connect(gain);
    gain.connect(this.audioCtx.destination);
    noise.start();
  }

  startStage4Ambience() {
    this._resume();
    if (this.stage4Osc) return;
    this.stage4Osc = this.audioCtx.createOscillator();
    this.stage4Gain = this.audioCtx.createGain();
    this.stage4Osc.type = 'triangle';
    this.stage4Osc.frequency.value = 55; // Low drone
    this.stage4Gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
    this.stage4Gain.gain.linearRampToValueAtTime(0.1, this.audioCtx.currentTime + 5.0);
    this.stage4Osc.connect(this.stage4Gain);
    this.stage4Gain.connect(this.audioCtx.destination);
    this.stage4Osc.start();
  }

  playHover() {}
  playWindowOpen() {}
  playWindowClose() {}
  playClick() {}
  playSystemError() { this.playError(); }
  
  startComputerHum() {
    this._resume();
    if (this.humOsc) return;
    this.humOsc = this.audioCtx.createOscillator();
    this.humGain = this.audioCtx.createGain();
    this.humOsc.type = 'sine';
    this.humOsc.frequency.value = 60; // 60Hz mains hum
    this.humGain.gain.value = 0.02;
    this.humOsc.connect(this.humGain);
    this.humGain.connect(this.audioCtx.destination);
    this.humOsc.start();
  }
  
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
  
  const resumeAudio = () => {
    if (window.soundManager) window.soundManager._resume();
    document.removeEventListener('click', resumeAudio);
    document.removeEventListener('keydown', resumeAudio);
  };
  document.addEventListener('click', resumeAudio);
  document.addEventListener('keydown', resumeAudio);
});
