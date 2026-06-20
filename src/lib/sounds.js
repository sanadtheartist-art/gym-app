let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playSuccessSound() {
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    
    // Play a nice two-tone chime (e.g., C5 then E5)
    playTone(ctx, 523.25, t, 0.1); // C5
    playTone(ctx, 659.25, t + 0.15, 0.3); // E5
  } catch (e) {
    console.warn("Audio playback failed", e);
  }
}

export function playTapSound() {
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    
    // Very short, subtle click
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.05);
    
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(t);
    osc.stop(t + 0.05);
  } catch (e) {
    console.warn("Audio playback failed", e);
  }
}

export function playTimerAlert() {
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    
    // Triple beep
    playTone(ctx, 880, t, 0.15);
    playTone(ctx, 880, t + 0.3, 0.15);
    playTone(ctx, 1046.50, t + 0.6, 0.4);
  } catch (e) {
    console.warn("Audio playback failed", e);
  }
}

function playTone(ctx, frequency, startTime, duration) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = 'sine';
  osc.frequency.value = frequency;
  
  // Attack and release envelope to avoid clicking
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.5, startTime + 0.02);
  gain.gain.setValueAtTime(0.5, startTime + duration - 0.05);
  gain.gain.linearRampToValueAtTime(0, startTime + duration);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(startTime);
  osc.stop(startTime + duration);
}
