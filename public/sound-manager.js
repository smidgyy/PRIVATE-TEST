class SoundManager {
  constructor() {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  playKeystroke() {
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150 + Math.random() * 50, this.audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.audioCtx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.05, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.05);
  }

  playError() {
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
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
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, this.audioCtx.currentTime);
    osc.frequency.setValueAtTime(600, this.audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, this.audioCtx.currentTime + 0.05);
    gain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.3);
  }

  playPing() {
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.audioCtx.currentTime);
    gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, this.audioCtx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.5);
  }

  playGlitch() {
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
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

  playHover() {
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, this.audioCtx.currentTime);
    gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.02, this.audioCtx.currentTime + 0.05);
    gain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.1);
  }

  playWindowOpen() {
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, this.audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.audioCtx.currentTime + 0.2);
    gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, this.audioCtx.currentTime + 0.05);
    gain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.2);
  }

  playWindowClose() {
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, this.audioCtx.currentTime + 0.2);
    gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, this.audioCtx.currentTime + 0.05);
    gain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.2);
  }

  playClick() {
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(100, this.audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.05);
  }

  playSystemError() { this.playError(); }

  startComputerHum() {
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    if (this.humOsc) return;
    this.humOsc = this.audioCtx.createOscillator();
    this.humGain = this.audioCtx.createGain();
    this.humOsc.type = 'sine';
    this.humOsc.frequency.setValueAtTime(60, this.audioCtx.currentTime);
    this.humGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
    this.humGain.gain.linearRampToValueAtTime(0.02, this.audioCtx.currentTime + 2);
    this.humOsc.connect(this.humGain);
    this.humGain.connect(this.audioCtx.destination);
    this.humOsc.start();
  }

  startFireCrackling() {
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    if (this.fireInterval) return;
    this.fireInterval = setInterval(() => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(Math.random() * 100 + 50, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.01, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.02);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.02);
    }, 100);
  }

  stopFireCrackling() {
    if (this.fireInterval) {
      clearInterval(this.fireInterval);
      this.fireInterval = null;
    }
  }

  playDissolve() {
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    const bufferSize = this.audioCtx.sampleRate * 0.5;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.5);
    noise.connect(gain);
    gain.connect(this.audioCtx.destination);
    noise.start();
  }

  playBlowSound() {
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    const bufferSize = this.audioCtx.sampleRate * 1.0;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, this.audioCtx.currentTime);
    filter.frequency.linearRampToValueAtTime(50, this.audioCtx.currentTime + 0.8);

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.4, this.audioCtx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.8);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioCtx.destination);

    noise.start();
    noise.stop(this.audioCtx.currentTime + 1.0);
  }

  playFlintSound() {
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    const osc = this.audioCtx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(4000, this.audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(8000, this.audioCtx.currentTime + 0.05);
    
    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, this.audioCtx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.1);
    
    const bufferSize = this.audioCtx.sampleRate * 0.1;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;
    
    const noiseFilter = this.audioCtx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 5000;
    
    const noiseGain = this.audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.5, this.audioCtx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
    
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.audioCtx.destination);
    
    noise.start();
    noise.stop(this.audioCtx.currentTime + 0.1);
  }

  startBlackFire() {
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    if (this.blackFireOsc) return;
    this.blackFireOsc = this.audioCtx.createOscillator();
    this.blackFireGain = this.audioCtx.createGain();
    this.blackFireOsc.type = 'sine';
    this.blackFireOsc.frequency.setValueAtTime(50, this.audioCtx.currentTime);
    this.blackFireGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
    this.blackFireGain.gain.linearRampToValueAtTime(0.2, this.audioCtx.currentTime + 5);
    this.blackFireOsc.connect(this.blackFireGain);
    this.blackFireGain.connect(this.audioCtx.destination);
    this.blackFireOsc.start();
  }

  startAmbientDrone() {
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    if (this.droneOscs) return;
    this.droneOscs = [];
    // Softer, more ethereal frequencies (E minor 9th feel)
    const freqs = [164.81, 246.94, 329.63, 493.88, 659.25];
    
    this.droneGain = this.audioCtx.createGain();
    this.droneGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
    this.droneGain.gain.linearRampToValueAtTime(0.03, this.audioCtx.currentTime + 5); // Softer volume, slower ramp
    
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, this.audioCtx.currentTime);
    filter.Q.value = 1;

    freqs.forEach((f, i) => {
      const osc = this.audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, this.audioCtx.currentTime);
      
      // Add subtle movement
      const lfo = this.audioCtx.createOscillator();
      const lfoGain = this.audioCtx.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = 0.1 + (i * 0.05);
      lfoGain.gain.value = 2;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();
      
      osc.connect(this.droneGain);
      osc.start();
      this.droneOscs.push(osc);
      this.droneOscs.push(lfo); // Track LFOs for cleanup if needed
    });
    
    this.droneGain.connect(filter);
    filter.connect(this.audioCtx.destination);
  }

  playBootSound() {
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    
    const osc1 = this.audioCtx.createOscillator();
    const gain1 = this.audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(100, this.audioCtx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(200, this.audioCtx.currentTime + 1);
    gain1.gain.setValueAtTime(0, this.audioCtx.currentTime);
    gain1.gain.linearRampToValueAtTime(0.1, this.audioCtx.currentTime + 0.1);
    gain1.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 1);
    osc1.connect(gain1);
    gain1.connect(this.audioCtx.destination);
    osc1.start();
    osc1.stop(this.audioCtx.currentTime + 1);

    const playPing = (freq, startTime) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + startTime);
      gain.gain.setValueAtTime(0, this.audioCtx.currentTime + startTime);
      gain.gain.linearRampToValueAtTime(0.1, this.audioCtx.currentTime + startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + startTime + 0.5);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(this.audioCtx.currentTime + startTime);
      osc.stop(this.audioCtx.currentTime + startTime + 0.5);
    };

    playPing(400, 0.5);
    playPing(600, 0.7);
    playPing(800, 0.9);
  }

  playCrashSound() {
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    const bufferSize = this.audioCtx.sampleRate * 0.5;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize / 5));
    }
    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, this.audioCtx.currentTime + 0.5);
    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.5);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioCtx.destination);
    noise.start();
  }

  resume() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }
}

window.soundManager = new SoundManager();

document.addEventListener('DOMContentLoaded', () => {
  const resumeAudio = () => {
    if (window.soundManager) window.soundManager.resume();
  };
  document.addEventListener('click', resumeAudio, { once: true });
  document.addEventListener('keydown', resumeAudio, { once: true });
  document.addEventListener('touchstart', resumeAudio, { once: true });

  const inputs = document.querySelectorAll('input[type="text"]');
  inputs.forEach(input => {
    input.addEventListener('input', () => {
      if (window.soundManager) window.soundManager.playKeystroke();
    });
  });

  // Handle missing stage4-ambient file by providing a procedural alternative
  const stage4Ambient = document.getElementById('stage4-ambient');
  if (stage4Ambient) {
    const originalPlay = stage4Ambient.play.bind(stage4Ambient);
    stage4Ambient.play = function() {
      if (window.soundManager) {
        window.soundManager.startAmbientDrone();
        return Promise.resolve();
      }
      return originalPlay();
    };
  }
});
