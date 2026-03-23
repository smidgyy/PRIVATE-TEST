class SoundManager {
  constructor() {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.connect(this.audioCtx.destination);
    
    // Load saved volume or default to 1 (100%)
    const savedVolume = localStorage.getItem('aurora_master_volume');
    if (savedVolume !== null) {
      this.setVolume(parseFloat(savedVolume));
    } else {
      this.setVolume(1);
    }
  }

  setVolume(vol) {
    if (this.masterGain) {
      this.masterGain.gain.value = vol;
    }
    localStorage.setItem('aurora_master_volume', vol);
    
    // Also update HTML5 audio elements if they exist
    const audioElements = document.querySelectorAll('audio, video');
    audioElements.forEach(el => {
      // Store original volume if not already stored
      if (el.dataset.originalVolume === undefined) {
        el.dataset.originalVolume = el.volume;
      }
      el.volume = parseFloat(el.dataset.originalVolume) * vol;
    });

    // Dispatch event for other custom audio players
    window.dispatchEvent(new CustomEvent('masterVolumeChanged', { detail: { volume: vol } }));
  }

  getVolume() {
    return this.masterGain ? this.masterGain.gain.value : 1;
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
    gain.connect(this.masterGain);
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
    gain.connect(this.masterGain);
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
    gain.connect(this.masterGain);
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
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.5);
  }

  playNotification() {
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    
    const playBeep = (startTime) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, this.audioCtx.currentTime + startTime); // A5
      
      gain.gain.setValueAtTime(0, this.audioCtx.currentTime + startTime);
      gain.gain.linearRampToValueAtTime(0.05, this.audioCtx.currentTime + startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + startTime + 0.15);
      
      osc.connect(gain);
      gain.connect(this.masterGain);
      
      osc.start(this.audioCtx.currentTime + startTime);
      osc.stop(this.audioCtx.currentTime + startTime + 0.15);
    };
    
    playBeep(0);
    playBeep(0.2);
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
    gain.connect(this.masterGain);
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
    gain.connect(this.masterGain);
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
    gain.connect(this.masterGain);
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
    gain.connect(this.masterGain);
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
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.05);
  }

  playSystemError() { this.playError(); }

  startComputerHum() {
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    if (this.ambientInterval) return; // Already started
    
    this.currentStage = 0;
    
    const checkStage = () => {
      let stage = 1;
      if (typeof getStage4Progress === 'function' && getStage4Progress() >= 1) {
        stage = 4;
      } else if (window.userState && (window.userState.stage3_secret_unlocked || window.userState.stage3_ground)) {
        stage = 3;
      } else if (window.userState && window.userState.stage2_unlocked) {
        stage = 2;
      }
      
      if (this.currentStage !== stage) {
        this.setStageAmbient(stage);
      }
    };
    
    this.ambientInterval = setInterval(checkStage, 1000);
    checkStage();
  }

  startAmbientDrone() {
    // This is called by stage4Ambient.play()
    // The ambient interval already handles stage 4, so we just ensure it's running
    this.startComputerHum();
  }

  setStageAmbient(stage) {
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    this.currentStage = stage;
    
    // Fade out current ambient
    if (this.ambientGain) {
      const currentGain = this.ambientGain;
      const currentOscs = this.ambientOscs;
      currentGain.gain.cancelScheduledValues(this.audioCtx.currentTime);
      currentGain.gain.setValueAtTime(currentGain.gain.value, this.audioCtx.currentTime);
      currentGain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 3);
      setTimeout(() => {
        if (currentOscs) {
          currentOscs.forEach(o => {
            try { o.stop(); } catch(e) {}
          });
        }
      }, 3500);
    }

    this.ambientOscs = [];
    this.ambientGain = this.audioCtx.createGain();
    this.ambientGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
    this.ambientGain.connect(this.masterGain);
    
    let freqs = [];
    let targetVolume = 0.05;
    let filterFreq = 800;
    
    if (stage === 1) {
      // Stage 1: subtle, minimal, calm ambience, sense of curiosity and discovery
      // A major 9th feel, very soft
      freqs = [220.00, 277.18, 329.63, 440.00]; 
      targetVolume = 0.02;
      filterFreq = 600;
    } else if (stage === 2) {
      // Stage 2: deeper, mysterious tone, subtle tension
      // G minor feel
      freqs = [196.00, 233.08, 293.66, 392.00]; 
      targetVolume = 0.03;
      filterFreq = 700;
    } else if (stage === 3) {
      // Stage 3: darker ambience with low-frequency elements, unease, anticipation
      // C minor low
      freqs = [130.81, 155.56, 196.00, 261.63]; 
      targetVolume = 0.04;
      filterFreq = 800;
    } else if (stage === 4) {
      // Stage 4: atmospheric, eerie, immersive, intense but not overwhelming
      // A minor darker, with more movement
      freqs = [110.00, 130.81, 164.81, 220.00, 329.63]; 
      targetVolume = 0.05;
      filterFreq = 1000;
    }

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, this.audioCtx.currentTime);
    filter.Q.value = stage === 4 ? 2 : 1;
    
    freqs.forEach((f, i) => {
      const osc = this.audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, this.audioCtx.currentTime);
      
      const lfo = this.audioCtx.createOscillator();
      const lfoGain = this.audioCtx.createGain();
      lfo.type = 'sine';
      // Slower movement for earlier stages, slightly faster for later
      const lfoSpeed = stage === 4 ? 0.1 : 0.05;
      lfo.frequency.value = lfoSpeed + (i * 0.02); 
      lfoGain.gain.value = stage >= 3 ? 3 : 1.5;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();
      
      osc.connect(this.ambientGain);
      osc.start();
      this.ambientOscs.push(osc);
      this.ambientOscs.push(lfo);
    });

    // Add a very low sub-bass for stages 3 and 4
    if (stage >= 3) {
      const subOsc = this.audioCtx.createOscillator();
      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(stage === 4 ? 55 : 65.41, this.audioCtx.currentTime); // Low A or C
      
      const subLfo = this.audioCtx.createOscillator();
      const subLfoGain = this.audioCtx.createGain();
      subLfo.type = 'sine';
      subLfo.frequency.value = 0.02;
      subLfoGain.gain.value = 2;
      subLfo.connect(subLfoGain);
      subLfoGain.connect(subOsc.frequency);
      subLfo.start();
      
      subOsc.connect(this.ambientGain);
      subOsc.start();
      this.ambientOscs.push(subOsc);
      this.ambientOscs.push(subLfo);
    }
    
    // Add a subtle high-pitched shimmer for stage 4
    if (stage === 4) {
      const shimmerOsc = this.audioCtx.createOscillator();
      shimmerOsc.type = 'sine';
      shimmerOsc.frequency.setValueAtTime(880, this.audioCtx.currentTime);
      
      const shimmerGain = this.audioCtx.createGain();
      shimmerGain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
      
      const shimmerLfo = this.audioCtx.createOscillator();
      shimmerLfo.type = 'sine';
      shimmerLfo.frequency.value = 0.2;
      
      const shimmerLfoGain = this.audioCtx.createGain();
      shimmerLfoGain.gain.value = 0.05;
      shimmerLfo.connect(shimmerLfoGain);
      shimmerLfoGain.connect(shimmerGain.gain);
      shimmerLfo.start();
      
      shimmerOsc.connect(shimmerGain);
      shimmerGain.connect(this.ambientGain);
      shimmerOsc.start();
      
      this.ambientOscs.push(shimmerOsc);
      this.ambientOscs.push(shimmerLfo);
    }

    this.ambientGain.connect(filter);
    filter.connect(this.masterGain);
    
    this.ambientGain.gain.linearRampToValueAtTime(targetVolume, this.audioCtx.currentTime + 5);
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
      gain.connect(this.masterGain);
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
    gain.connect(this.masterGain);
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
    gain.connect(this.masterGain);

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
    gain.connect(this.masterGain);
    
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
    noiseGain.connect(this.masterGain);
    
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
    this.blackFireGain.connect(this.masterGain);
    this.blackFireOsc.start();
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
    gain1.connect(this.masterGain);
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
      gain.connect(this.masterGain);
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
    gain.connect(this.masterGain);
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
