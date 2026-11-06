/* ============================================================
   audio.js — tiny Web Audio sound effects, no asset files
   ============================================================ */

const SFX = (function () {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) ctx = new AC();
      } catch (e) { /* no audio available */ }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(opts) {
    const c = ensure();
    if (!c || muted) return;
    const {
      freq = 440, to = null, dur = 0.15, type = 'sine',
      gain = 0.2, delay = 0,
    } = opts;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  function noise(opts) {
    const c = ensure();
    if (!c || muted) return;
    const {
      dur = 0.2, freq = 1000, to = null, q = 0.9,
      gain = 0.25, delay = 0, type = 'lowpass',
    } = opts;
    const t0 = c.currentTime + delay;
    const frames = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, frames, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(freq, t0);
    if (to) filt.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    filt.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt).connect(g).connect(c.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  return {
    unlock() { ensure(); },
    setMuted(v) { muted = !!v; },
    isMuted() { return muted; },

    flip() {
      noise({ dur: 0.14, freq: 2600, to: 700, type: 'bandpass', q: 1.4, gain: 0.20 });
      tone({ freq: 520, to: 760, dur: 0.1, type: 'triangle', gain: 0.06 });
    },
    slap() {
      noise({ dur: 0.2, freq: 1400, to: 240, gain: 0.42 });
      tone({ freq: 130, to: 48, dur: 0.16, type: 'sine', gain: 0.3 });
      tone({ freq: 900, to: 300, dur: 0.07, type: 'square', gain: 0.05 });
    },
    windowOpen() {
      tone({ freq: 760, dur: 0.09, type: 'square', gain: 0.14 });
      tone({ freq: 1080, dur: 0.12, type: 'square', gain: 0.14, delay: 0.09 });
      noise({ dur: 0.3, freq: 500, to: 3000, type: 'bandpass', q: 1.2, gain: 0.12 });
    },
    gestureOpen() {
      tone({ freq: 300, dur: 0.1, type: 'sawtooth', gain: 0.13 });
      tone({ freq: 450, dur: 0.1, type: 'sawtooth', gain: 0.13, delay: 0.1 });
      tone({ freq: 600, dur: 0.16, type: 'sawtooth', gain: 0.13, delay: 0.2 });
    },
    buzz() {
      tone({ freq: 260, to: 70, dur: 0.4, type: 'sawtooth', gain: 0.2 });
      noise({ dur: 0.3, freq: 900, to: 200, gain: 0.16 });
    },
    take() {
      noise({ dur: 0.34, freq: 900, to: 260, gain: 0.22 });
      tone({ freq: 340, to: 130, dur: 0.3, type: 'triangle', gain: 0.14 });
    },
    win() {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((f, i) => tone({ freq: f, dur: 0.28, type: 'triangle', gain: 0.16, delay: i * 0.1 }));
      noise({ dur: 0.7, freq: 4000, to: 6000, type: 'bandpass', q: 2, gain: 0.06, delay: 0.45 });
    },
    deal() {
      for (let i = 0; i < 8; i++) {
        noise({ dur: 0.05, freq: 3000, type: 'highpass', gain: 0.1, delay: i * 0.05 });
      }
      tone({ freq: 660, dur: 0.12, type: 'triangle', gain: 0.1, delay: 0.5 });
      tone({ freq: 880, dur: 0.18, type: 'triangle', gain: 0.1, delay: 0.62 });
    },
    click() {
      tone({ freq: 700, to: 950, dur: 0.07, type: 'triangle', gain: 0.1 });
    },
    deny() {
      tone({ freq: 220, to: 160, dur: 0.13, type: 'square', gain: 0.1 });
    },
  };
})();
