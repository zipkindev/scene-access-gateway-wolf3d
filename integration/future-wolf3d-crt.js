(() => {
  'use strict';

  const WIDTH = 1672;
  const HEIGHT = 941;
  const sequence = ['left-crescent', 'right-crescent', 'left-orbit', 'right-orbit'];
  const sodSequence = ['right-crescent', 'left-orbit', 'right-orbit', 'left-crescent'];
  const sequences = { WL6: sequence, SOD: sodSequence };
  const menuSequence = ['left-sign', 'right-sign', 'left-flag', 'right-flag'];
  const roomSymbols = [
    { id: 'left-sign', label: 'left room sign', x: 50, y: 305, width: 230, height: 250 },
    { id: 'right-sign', label: 'right room sign', x: 1380, y: 465, width: 270, height: 235 },
    { id: 'left-flag', label: 'left room flag', x: 110, y: 0, width: 145, height: 310 },
    { id: 'right-flag', label: 'right room flag', x: 1520, y: 0, width: 150, height: 380 },
  ];
  const symbols = [
    { id: 'left-orbit', label: 'symbol left of the left crescent', x: 557, y: 733, radius: 34 },
    { id: 'left-crescent', label: 'left crescent', x: 661, y: 733, radius: 35 },
    { id: 'right-crescent', label: 'right crescent', x: 994, y: 733, radius: 35 },
    { id: 'right-orbit', label: 'symbol right of the right crescent', x: 1094, y: 733, radius: 34 },
  ];

  function createSequenceTracker(onProgress = () => {}, onUnlock = () => {}) {
    let progress = 0;
    let target = null;
    return {
      press(id) {
        if (!target) target = Object.keys(sequences).find((key) => sequences[key][0] === id) || null;
        if (target && id === sequences[target][progress]) {
          progress += 1;
          onProgress(progress, sequences[target].length, id, target);
          if (progress === sequences[target].length) onUnlock(target);
          return { accepted: true, progress, target, unlocked: progress === sequences[target].length };
        }
        target = Object.keys(sequences).find((key) => sequences[key][0] === id) || null;
        progress = target ? 1 : 0;
        onProgress(progress, sequence.length, id, target);
        return { accepted: !!target, progress, target, unlocked: false };
      },
      reset() { progress = 0; target = null; onProgress(0, sequence.length, null, null); },
      get progress() { return progress; },
      get target() { return target; },
    };
  }

  function mount({ scene, screen, iframe, boot, status, image, lightCanvas, wolfUrl = '/wolf3d/?game=WL6', sodUrl = '/wolf3d/?game=SOD', onExit = () => {}, onZoom = () => {} }) {
    if (!scene || !screen || !iframe || !boot || !image || !lightCanvas) throw new Error('Wolf CRT mount is incomplete');
    const phosphor = document.createElement('div');
    phosphor.className = 'wolf-crt-phosphor';
    phosphor.setAttribute('aria-hidden', 'true');
    const beamFragment = document.createDocumentFragment();
    for (let line = 0; line < 480; line += 1) {
      const ray = document.createElement('i');
      ray.className = 'wolf-crt-ray';
      const pair = Math.floor(line / 2);
      const order = (pair * 197) % 240;
      const centerDistance = Math.abs(line - 239.5) / 239.5;
      ray.style.setProperty('--beam-y', (line * 100 / 480).toFixed(4) + '%');
      ray.style.setProperty('--beam-origin', line % 2 ? '100%' : '0%');
      ray.style.setProperty('--raster-delay', Math.round(order * 3.7) + 'ms');
      ray.style.setProperty('--energy-delay', Math.round(centerDistance * 390) + 'ms');
      ray.style.setProperty('--out-delay', Math.round((1 - centerDistance) * 340) + 'ms');
      ray.style.setProperty('--release-delay', Math.round(order * 1.15) + 'ms');
      beamFragment.append(ray);
    }
    phosphor.append(beamFragment);
    screen.insertBefore(phosphor, screen.querySelector('.wolf-crt-bezel'));
    const noiseCanvas = document.createElement('canvas');
    noiseCanvas.className = 'wolf-crt-noise';
    noiseCanvas.width = 144; noiseCanvas.height = 80;
    noiseCanvas.setAttribute('aria-hidden', 'true');
    screen.insertBefore(noiseCanvas, screen.querySelector('.wolf-crt-bezel'));
    const noiseContext = noiseCanvas.getContext('2d', { alpha: true });
    let noiseFrame = 0;
    let startupPromise = Promise.resolve();
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let beamTimer = 0;
    let shuttingDown = false;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'wolf-symbol-layer');
    svg.setAttribute('viewBox', `0 0 ${WIDTH} ${HEIGHT}`);
    svg.setAttribute('aria-label', 'CRT unlock symbols');
    let unlocked = false;
    const light = lightCanvas.getContext('2d');
    const traced = new Map();
    const lit = new Set();
    const rejected = new Map();
    let lightFrame = 0;
    let menuProgress = 0;
    let crtAudio = null;

    function playCrtSound(mode) {
      const AudioEngine = window.AudioContext || window.webkitAudioContext;
      if (!AudioEngine) return;
      try {
        crtAudio = crtAudio || new AudioEngine();
        if (crtAudio.state === 'suspended') crtAudio.resume().catch(() => {});
        const now = crtAudio.currentTime + .012;
        const duration = mode === 'on' ? 3.35 : 2.65;
        const master = crtAudio.createGain();
        master.gain.setValueAtTime(.0001, now);
        master.gain.exponentialRampToValueAtTime(mode === 'on' ? .105 : .09, now + .045);
        master.gain.exponentialRampToValueAtTime(.0001, now + duration);
        master.connect(crtAudio.destination);
        const charge = crtAudio.createOscillator(), chargeGain = crtAudio.createGain();
        charge.type = mode === 'on' ? 'sine' : 'triangle';
        charge.frequency.setValueAtTime(mode === 'on' ? 54 : 680, now);
        charge.frequency.exponentialRampToValueAtTime(mode === 'on' ? 1260 : 42, now + duration * .84);
        chargeGain.gain.setValueAtTime(.68, now); chargeGain.gain.exponentialRampToValueAtTime(.0001, now + duration);
        charge.connect(chargeGain).connect(master); charge.start(now); charge.stop(now + duration);
        const shimmer = crtAudio.createOscillator(), shimmerGain = crtAudio.createGain();
        shimmer.type = 'sine'; shimmer.frequency.setValueAtTime(mode === 'on' ? 2150 : 980, now);
        shimmer.frequency.exponentialRampToValueAtTime(mode === 'on' ? 7200 : 160, now + duration * .7);
        shimmerGain.gain.setValueAtTime(.0001, now); shimmerGain.gain.exponentialRampToValueAtTime(.22, now + .06);
        shimmerGain.gain.exponentialRampToValueAtTime(.0001, now + duration * .76);
        shimmer.connect(shimmerGain).connect(master); shimmer.start(now); shimmer.stop(now + duration);
        const noiseLength = Math.max(1, Math.floor(crtAudio.sampleRate * duration));
        const noiseBuffer = crtAudio.createBuffer(1, noiseLength, crtAudio.sampleRate), samples = noiseBuffer.getChannelData(0);
        for (let i = 0; i < samples.length; i += 1) samples[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / samples.length, mode === 'on' ? 2.2 : 1.35);
        const noise = crtAudio.createBufferSource(), noiseFilter = crtAudio.createBiquadFilter(), noiseGain = crtAudio.createGain();
        noise.buffer = noiseBuffer; noiseFilter.type = 'bandpass'; noiseFilter.Q.value = 1.8;
        noiseFilter.frequency.setValueAtTime(mode === 'on' ? 740 : 2900, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(mode === 'on' ? 5200 : 240, now + duration);
        noiseGain.gain.setValueAtTime(mode === 'on' ? .42 : .54, now); noiseGain.gain.exponentialRampToValueAtTime(.0001, now + duration);
        noise.connect(noiseFilter).connect(noiseGain).connect(master); noise.start(now);
      } catch (error) {}
    }
    let revealing = false;
    const revealTimers = new Set();
    const rewardKey = 'zipkin.arcade.wolfReward.v1';
    let pendingReward = '';
    let rewardTimer = 0;
    try { pendingReward = window.localStorage.getItem(rewardKey) || ''; } catch (_) {}
    function rememberReward(target) { pendingReward = target; try { window.localStorage.setItem(rewardKey, target); } catch (_) {} }
    function clearReward() { pendingReward = ''; try { window.localStorage.removeItem(rewardKey); } catch (_) {} }
    function scheduleRewardReveal(delay = 900) {
      if ((pendingReward !== 'SOD' && pendingReward !== 'MENU') || unlocked || revealing || rewardTimer) return false;
      rewardTimer = window.setTimeout(() => {
        rewardTimer = 0; if (unlocked) return;
        if (pendingReward === 'SOD') reveal('SOD', 'Wolfenstein reward · watch the Spear sequence');
        else if (pendingReward === 'MENU') reveal('WL6', 'Spear reward · reloading Wolfenstein');
      }, delay);
      return true;
    }

    function stopNoise() {
      if (noiseFrame) cancelAnimationFrame(noiseFrame);
      noiseFrame = 0; noiseCanvas.classList.remove('active'); noiseContext.clearRect(0, 0, noiseCanvas.width, noiseCanvas.height);
    }
    const compositor = document.createElement('canvas');
    compositor.className = 'wolf-crt-compositor';
    compositor.setAttribute('aria-hidden', 'true');
    screen.insertBefore(compositor, iframe);
    const compositeContext = compositor.getContext('2d', { alpha: true });
    const frameBuffer = document.createElement('canvas');
    const frameContext = frameBuffer.getContext('2d', { alpha: true, willReadFrequently: false });
    const pixelMask = document.createElement('canvas');
    const maskContext = pixelMask.getContext('2d', { alpha: true });
    let compositorFrame = 0;

    function sizeCompositor() {
      const rect = screen.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(640, Math.round(rect.width * ratio));
      const height = Math.max(360, Math.round(rect.height * ratio));
      if (compositor.width !== width || compositor.height !== height) {
        compositor.width = frameBuffer.width = width;
        compositor.height = frameBuffer.height = height;
        pixelMask.width = Math.max(160, Math.round(width / 4));
        pixelMask.height = Math.max(90, Math.round(height / 4));
      }
      compositeContext.imageSmoothingEnabled = false;
      frameContext.imageSmoothingEnabled = false;
      maskContext.imageSmoothingEnabled = false;
    }

    function ease(value) {
      const clamped = Math.max(0, Math.min(1, value));
      return clamped * clamped * (3 - 2 * clamped);
    }

    function noiseAt(x, y) {
      let value = Math.imul(x + 17, 374761393) ^ Math.imul(y + 29, 668265263);
      value = Math.imul(value ^ (value >>> 13), 1274126177);
      return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
    }

    function drawScanlines(progress, releasing = false) {
      const width = compositor.width, height = compositor.height;
      const lineHeight = height / 480;
      compositeContext.save();
      compositeContext.globalCompositeOperation = 'source-over';
      for (let line = 0; line < 480; line += 1) {
        const pair = Math.floor(line / 2);
        const delay = ((pair * 197) % 240) / 240 * .52;
        const local = ease((progress - delay) / .48);
        if (local <= 0) continue;
        const amount = releasing ? 1 - local : local;
        if (amount <= 0) continue;
        const fromRight = line % 2 === 1;
        const length = width * amount;
        const x = fromRight ? width - length : 0;
        const y = line * lineHeight;
        const flicker = .54 + noiseAt(line, Math.floor(progress * 90)) * .24;
        compositeContext.fillStyle = 'rgba(188,194,192,' + flicker + ')';
        compositeContext.fillRect(x, y, length, Math.max(.55, lineHeight * .34));
        if (!releasing && local > .02 && local < .98) {
          compositeContext.fillStyle = 'rgba(236,244,241,.72)';
          compositeContext.fillRect(fromRight ? x : x + length - 3, y, 3, Math.max(.7, lineHeight * .46));
        }
      }
      compositeContext.restore();
    }

    function prepareMask(progress, inverse = false) {
      const width = pixelMask.width, height = pixelMask.height;
      const pixels = maskContext.createImageData(width, height);
      const threshold = ease(progress) * 1.16;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const dx = Math.abs((x + .5) / width - .5) * 2;
          const dy = Math.abs((y + .5) / height - .5) * 2;
          const distance = Math.hypot(dx * .78, dy) / 1.27;
          const grain = (noiseAt(x, y) - .5) * .12;
          let visible = distance + grain <= threshold;
          if (inverse) visible = !visible;
          pixels.data[(y * width + x) * 4 + 3] = visible ? 255 : 0;
        }
      }
      maskContext.putImageData(pixels, 0, 0);
    }

    function liveGameCanvas() {
      try { return iframe.contentDocument && iframe.contentDocument.getElementById('screen'); }
      catch (_error) { return null; }
    }

    function drawLiveGame(progress) {
      const source = liveGameCanvas();
      if (!source || !source.width || !source.height) return false;
      const width = compositor.width, height = compositor.height;
      frameContext.globalCompositeOperation = 'source-over';
      frameContext.clearRect(0, 0, width, height);
      frameContext.drawImage(source, 0, 0, width, height);
      prepareMask(progress);
      frameContext.globalCompositeOperation = 'destination-in';
      frameContext.drawImage(pixelMask, 0, 0, width, height);
      frameContext.globalCompositeOperation = 'source-over';
      compositeContext.drawImage(frameBuffer, 0, 0);
      return true;
    }

    function buildTextPlate(text) {
      const plate = document.createElement('canvas');
      plate.width = 480; plate.height = 270;
      const context = plate.getContext('2d');
      context.imageSmoothingEnabled = false;
      context.font = '700 19px monospace';
      context.textAlign = 'center'; context.textBaseline = 'middle';
      context.fillStyle = '#83ff9f';
      context.shadowColor = 'rgba(94,255,133,.72)'; context.shadowBlur = 5;
      context.fillText(text, 240, 135);
      context.shadowBlur = 0;
      context.fillStyle = 'rgba(184,255,198,.8)';
      context.fillRect(72, 160, 336, 1);
      return plate;
    }

    function drawTextPixels(plate, progress, opacity) {
      const width = compositor.width, height = compositor.height;
      frameContext.globalCompositeOperation = 'source-over';
      frameContext.clearRect(0, 0, width, height);
      frameContext.globalAlpha = opacity;
      frameContext.drawImage(plate, 0, 0, width, height);
      frameContext.globalAlpha = 1;
      prepareMask(progress);
      frameContext.globalCompositeOperation = 'destination-in';
      frameContext.drawImage(pixelMask, 0, 0, width, height);
      frameContext.globalCompositeOperation = 'source-over';
      compositeContext.drawImage(frameBuffer, 0, 0);
    }

    function animateCompositor(duration, painter) {
      cancelAnimationFrame(compositorFrame);
      const started = performance.now();
      return new Promise((resolve) => {
        const draw = (now) => {
          const elapsed = now - started;
          painter(Math.min(1, elapsed / duration), elapsed);
          if (elapsed < duration) { compositorFrame = requestAnimationFrame(draw); return; }
          compositorFrame = 0; resolve();
        };
        compositorFrame = requestAnimationFrame(draw);
      });
    }

    function playRealStartup() {
      stopNoise(); sizeCompositor();
      iframe.style.clipPath = 'none';
      screen.classList.remove('compositor-live', 'display-live', 'game-revealing', 'beam-hold', 'beam-raster', 'beam-release', 'crt-filter-active');
      screen.classList.add('compositor-active');
      const plate = buildTextPlate('WOLF 3D BOOT');
      if (reduceMotion) return Promise.resolve();
      return animateCompositor(2860, (_progress, elapsed) => {
        compositeContext.clearRect(0, 0, compositor.width, compositor.height);
        drawScanlines(Math.min(1, elapsed / 1120));
        if (elapsed >= 1120) screen.classList.add('crt-filter-active');
        if (elapsed >= 1180) {
          const build = Math.min(1, (elapsed - 1180) / 780);
          const fade = elapsed < 2250 ? 1 : Math.max(0, 1 - (elapsed - 2250) / 500);
          drawTextPixels(plate, build, fade);
        }
      });
    }

    function playRealGameReveal() {
      sizeCompositor();
      if (reduceMotion) {
        screen.classList.remove('compositor-active'); screen.classList.add('compositor-live', 'display-live', 'crt-filter-active');
        return Promise.resolve();
      }
      return animateCompositor(1700, (progress) => {
        compositeContext.clearRect(0, 0, compositor.width, compositor.height);
        drawScanlines(1);
        drawLiveGame(progress);
      }).then(() => {
        screen.classList.remove('compositor-active');
        screen.classList.add('compositor-live', 'display-live', 'crt-filter-active');
        status && (status.textContent = 'Wolfenstein runtime loaded · click for keyboard control');
      });
    }

    function playRealShutdown() {
      stopNoise(); sizeCompositor();
      screen.classList.remove('compositor-live', 'display-live');
      screen.classList.add('compositor-active');
      const plate = buildTextPlate('SHUTTING DOWN');
      if (reduceMotion) return Promise.resolve();
      return animateCompositor(3220, (_progress, elapsed) => {
        compositeContext.clearRect(0, 0, compositor.width, compositor.height);
        if (elapsed < 2050) {
          drawScanlines(1);
          drawLiveGame(Math.max(0, 1 - Math.max(0, elapsed - 560) / 1380));
          const build = Math.min(1, elapsed / 520);
          const fade = elapsed < 1320 ? 1 : Math.max(0, 1 - (elapsed - 1320) / 560);
          drawTextPixels(plate, build, fade);
        } else {
          screen.classList.remove('crt-filter-active');
          drawScanlines(Math.min(1, (elapsed - 2050) / 1080), true);
        }
      });
    }

    function pixelClip(progress) {
      const eased = progress * progress * (3 - 2 * progress);
      const halfWidth = 50.6 * eased;
      const halfHeight = 50.6 * eased;
      const points = [];
      const steps = 10;
      const jitter = (index, axis) => Math.sin(index * 12.9898 + axis * 78.233) * 1.25 * Math.sin(Math.PI * eased);
      const clamp = (value) => Math.max(0, Math.min(100, Math.round(value * 2) / 2));
      for (let index = 0; index <= steps; index += 1) {
        const x = 50 - halfWidth + halfWidth * 2 * index / steps;
        points.push(clamp(x) + '% ' + clamp(50 - halfHeight + jitter(index, 1)) + '%');
      }
      for (let index = 1; index <= steps; index += 1) {
        const y = 50 - halfHeight + halfHeight * 2 * index / steps;
        points.push(clamp(50 + halfWidth + jitter(index, 2)) + '% ' + clamp(y) + '%');
      }
      for (let index = steps - 1; index >= 0; index -= 1) {
        const x = 50 - halfWidth + halfWidth * 2 * index / steps;
        points.push(clamp(x) + '% ' + clamp(50 + halfHeight + jitter(index, 3)) + '%');
      }
      for (let index = steps - 1; index > 0; index -= 1) {
        const y = 50 - halfHeight + halfHeight * 2 * index / steps;
        points.push(clamp(50 - halfWidth + jitter(index, 4)) + '% ' + clamp(y) + '%');
      }
      return 'polygon(' + points.join(',') + ')';
    }

    function createTextMask(text) {
      const buffer = document.createElement('canvas');
      buffer.width = 144; buffer.height = 80;
      const context = buffer.getContext('2d');
      context.clearRect(0, 0, buffer.width, buffer.height);
      context.font = '700 10px monospace';
      context.textAlign = 'center'; context.textBaseline = 'middle';
      context.fillStyle = '#fff';
      context.fillText(text, buffer.width / 2, buffer.height / 2);
      return context.getImageData(0, 0, buffer.width, buffer.height);
    }

    function drawProjectedText(mask, progress, opacity = 1) {
      const width = mask.width, height = mask.height;
      noiseContext.clearRect(0, 0, width, height);
      noiseContext.save(); noiseContext.globalCompositeOperation = 'screen';
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const index = (y * width + x) * 4;
          if (mask.data[index + 3] < 40) continue;
          const dx = Math.abs(x + .5 - width / 2) / (width / 2);
          const dy = Math.abs(y + .5 - height / 2) / (height / 2);
          const distance = Math.max(dx, dy);
          const texture = (((x * 29 + y * 47) % 31) - 15) / 360;
          if (distance > progress * 1.08 + texture) continue;
          const pulse = .72 + ((x * 11 + y * 7) % 5) * .055;
          noiseContext.fillStyle = 'rgba(111,255,151,' + Math.max(0, opacity * pulse) + ')';
          noiseContext.fillRect(x, y, 1, 1);
        }
      }
      const radius = Math.max(0, Math.min(1, progress));
      for (let grain = 0; grain < 420; grain += 1) {
        const x = (grain * 83 + 17) % width, y = (grain * 47 + 11) % height;
        const distance = Math.max(Math.abs(x - width / 2) / (width / 2), Math.abs(y - height / 2) / (height / 2));
        if (distance > radius || ((grain * 19) % 13) > 2) continue;
        noiseContext.fillStyle = 'rgba(126,255,161,' + (.055 * opacity) + ')';
        noiseContext.fillRect(x, y, 1, 1);
      }
      noiseContext.restore();
    }

    function playProjectedStartup() {
      stopNoise();
      boot.hidden = true;
      screen.classList.remove('display-live', 'game-revealing', 'beam-hold', 'beam-off', 'beam-release');
      void screen.offsetWidth;
      screen.classList.add('beam-raster');
      if (reduceMotion) return Promise.resolve();
      return new Promise((resolve) => {
        window.setTimeout(() => {
          if (!unlocked) { resolve(); return; }
          status && (status.textContent = 'Scanline surface complete · projecting boot pixels from the center');
          noiseCanvas.width = 144; noiseCanvas.height = 80; noiseCanvas.classList.add('active');
          const mask = createTextMask('WOLF 3D CRT BOOT');
          const started = performance.now();
          const paint = (now) => {
            const elapsed = now - started;
            const build = Math.min(1, elapsed / 920);
            const fade = elapsed < 1420 ? 1 : Math.max(0, 1 - (elapsed - 1420) / 420);
            drawProjectedText(mask, build, fade);
            if (elapsed < 1840 && unlocked) { noiseFrame = requestAnimationFrame(paint); return; }
            noiseFrame = 0; noiseCanvas.classList.remove('active'); noiseContext.clearRect(0, 0, 144, 80); resolve();
          };
          noiseFrame = requestAnimationFrame(paint);
        }, 1180);
      });
    }

    function playGameReveal() {
      stopNoise();
      if (reduceMotion) {
        iframe.style.clipPath = 'none';
        screen.classList.remove('beam-raster', 'game-revealing');
        screen.classList.add('display-live');
        return Promise.resolve();
      }
      screen.classList.add('game-revealing');
      noiseCanvas.width = 144; noiseCanvas.height = 80; noiseCanvas.classList.add('active');
      const started = performance.now();
      return new Promise((resolve) => {
        const paint = (now) => {
          const progress = Math.min(1, (now - started) / 1480);
          iframe.style.clipPath = pixelClip(progress);
          noiseContext.clearRect(0, 0, 144, 80);
          const edge = progress;
          for (let grain = 0; grain < 700; grain += 1) {
            const x = (grain * 61 + 7) % 144, y = (grain * 97 + 13) % 80;
            const distance = Math.max(Math.abs(x - 72) / 72, Math.abs(y - 40) / 40);
            if (Math.abs(distance - edge) > .035 || ((grain * 17) % 7) > 2) continue;
            noiseContext.fillStyle = 'rgba(157,255,183,' + (.12 + ((grain * 5) % 5) * .035) + ')';
            noiseContext.fillRect(x, y, 1, 1);
          }
          if (progress < 1 && unlocked) { noiseFrame = requestAnimationFrame(paint); return; }
          noiseFrame = 0; noiseCanvas.classList.remove('active'); noiseContext.clearRect(0, 0, 144, 80);
          iframe.style.clipPath = 'none';
          screen.classList.remove('beam-raster', 'game-revealing'); screen.classList.add('display-live');
          status && (status.textContent = 'Wolfenstein runtime loaded · click for keyboard control');
          resolve();
        };
        noiseFrame = requestAnimationFrame(paint);
      });
    }

    function playProjectedShutdown() {
      stopNoise();
      screen.classList.remove('display-live', 'beam-raster', 'beam-off', 'beam-release');
      screen.classList.add('game-revealing', 'beam-hold');
      if (reduceMotion) { iframe.style.clipPath = pixelClip(0); return Promise.resolve(); }
      noiseCanvas.width = 144; noiseCanvas.height = 80; noiseCanvas.classList.add('active');
      const mask = createTextMask('CRT SHUTTING DOWN');
      const started = performance.now();
      return new Promise((resolve) => {
        const paint = (now) => {
          const elapsed = now - started;
          const textBuild = Math.min(1, elapsed / 480);
          const retreat = Math.max(0, Math.min(1, (elapsed - 650) / 1320));
          const textFade = elapsed < 1050 ? 1 : Math.max(0, 1 - (elapsed - 1050) / 720);
          drawProjectedText(mask, textBuild, textFade);
          iframe.style.clipPath = pixelClip(1 - retreat);
          if (elapsed < 1970) { noiseFrame = requestAnimationFrame(paint); return; }
          noiseFrame = 0; noiseCanvas.classList.remove('active'); noiseContext.clearRect(0, 0, 144, 80);
          iframe.style.clipPath = pixelClip(0); iframe.hidden = true;
          screen.classList.remove('game-revealing'); resolve();
        };
        noiseFrame = requestAnimationFrame(paint);
      });
    }

    function ramp(low, high, value) {
      const amount = Math.max(0, Math.min(1, (value - low) / (high - low)));
      return amount * amount * (3 - 2 * amount);
    }
    function traceSymbol(symbol) {
      if (traced.has(symbol.id)) return traced.get(symbol.id);
      const size = 88;
      const left = Math.round(symbol.x - size / 2);
      const top = Math.round(symbol.y - size / 2);
      const source = document.createElement('canvas');
      source.width = size; source.height = size;
      const sourceContext = source.getContext('2d');
      sourceContext.drawImage(image, left, top, size, size, 0, 0, size, size);
      const pixels = sourceContext.getImageData(0, 0, size, size);
      const sprite = document.createElement('canvas');
      sprite.width = size; sprite.height = size;
      const spriteContext = sprite.getContext('2d');
      const glow = spriteContext.createImageData(size, size);
      const luminance = (index) => (0.2126 * pixels.data[index] + 0.7152 * pixels.data[index + 1] + 0.0722 * pixels.data[index + 2]) / 255;
      for (let y = 4; y < size - 4; y += 1) {
        for (let x = 4; x < size - 4; x += 1) {
          const index = (y * size + x) * 4;
          const r = pixels.data[index];
          const b = pixels.data[index + 2];
          const nearby = (luminance(index - 16) + luminance(index + 16) + luminance(index - 16 * size) + luminance(index + 16 * size)) / 4;
          const detail = ramp(0.055, 0.19, Math.abs(luminance(index) - nearby));
          const gold = ramp(0.018, 0.12, (r - b) / 255);
          const radius = Math.hypot(x - size / 2, y - size / 2);
          const bounds = 1 - ramp(24, 37, radius);
          const alpha = Math.round(255 * detail * gold * bounds);
          if (alpha < 7) continue;
          glow.data[index] = 255; glow.data[index + 1] = 211; glow.data[index + 2] = 122; glow.data[index + 3] = alpha;
        }
      }
      spriteContext.putImageData(glow, 0, 0);
      const result = { sprite, left, top };
      traced.set(symbol.id, result);
      return result;
    }
    function drawRays(symbol, strength, now) {
      const shimmer = 0.78 + Math.sin(now / 170 + symbol.x) * 0.14;
      for (const offset of [-12, -5, 4, 11]) {
        const gradient = light.createLinearGradient(0, symbol.y - 76, 0, symbol.y - 10);
        gradient.addColorStop(0, 'rgba(255,224,150,0)');
        gradient.addColorStop(.72, `rgba(255,211,122,${0.07 * strength * shimmer})`);
        gradient.addColorStop(1, `rgba(255,246,207,${0.34 * strength})`);
        light.fillStyle = gradient;
        light.beginPath();
        light.moveTo(symbol.x + offset * .25 - 2, symbol.y - 76);
        light.lineTo(symbol.x + offset * .25 + 2, symbol.y - 76);
        light.lineTo(symbol.x + offset + 3, symbol.y - 9);
        light.lineTo(symbol.x + offset - 3, symbol.y - 9);
        light.closePath();
        light.fill();
      }
    }
    function paintLights(now) {
      lightFrame = 0;
      light.clearRect(0, 0, WIDTH, HEIGHT);
      light.globalCompositeOperation = 'screen';
      for (const symbol of symbols) {
        const rejectedAt = rejected.get(symbol.id);
        const rejectionAge = rejectedAt == null ? Infinity : now - rejectedAt;
        const strength = lit.has(symbol.id) ? 1 : rejectionAge < 430 ? 1 - rejectionAge / 430 : 0;
        if (strength <= 0) continue;
        const geometry = traceSymbol(symbol);
        drawRays(symbol, strength, now);
        light.filter = 'blur(7px)';
        light.globalAlpha = .62 * strength;
        light.drawImage(geometry.sprite, geometry.left, geometry.top - 2);
        light.filter = 'none';
        light.globalAlpha = .98 * strength;
        light.drawImage(geometry.sprite, geometry.left, geometry.top);
      }
      light.globalAlpha = 1;
      light.globalCompositeOperation = 'source-over';
      light.filter = 'none';
      if (lit.size || [...rejected.values()].some((started) => now - started < 430)) lightFrame = requestAnimationFrame(paintLights);
    }
    function ensureLightFrame() {
      if (!lightFrame) lightFrame = requestAnimationFrame(paintLights);
    }

    function describe(progress) {
      if (!status) return;
      status.textContent = progress
        ? `CRT sequence ${progress} of ${sequence.length}`
        : 'CRT locked · choose a crescent sequence';
    }
    function clearGlows() {
      lit.clear(); rejected.clear();
      light.clearRect(0, 0, WIDTH, HEIGHT);
    }
    function glow(id, accepted) {
      if (accepted) lit.add(id);
      else rejected.set(id, performance.now());
      ensureLightFrame();
    }
    function unlock(target) {
      if (unlocked) return;
      unlocked = true;
      const runtimeUrl = target === 'SOD' ? sodUrl : wolfUrl;
      const gameName = target === 'SOD' ? 'Spear of Destiny' : 'Wolfenstein 3D';
      window.setTimeout(() => svg.classList.add('unlocked'), 500);
      scene.classList.add('crt-unlocked');
      screen.classList.remove('beam-on', 'beam-off', 'beam-collapse', 'beam-release', 'beam-raster', 'beam-hold', 'display-live', 'game-revealing');
      playCrtSound('on');
      startupPromise = playRealStartup();
      status && (status.textContent = 'Projecting 480 fine scanline beams over the table');
      window.setTimeout(() => screen.classList.add('powered'), 500);
      window.setTimeout(async () => {
        status && (status.textContent = `Opening ${gameName}`);
        try {
          // The public proxy deliberately sends X-Frame-Options: DENY on HTTP
          // responses. Load the same-origin runtime as srcdoc so that boundary
          // remains intact while the game still runs in an isolated document.
          const response = await fetch(runtimeUrl, { credentials: 'same-origin', cache: 'no-store' });
          if (!response.ok) throw new Error(`runtime returned ${response.status}`);
          const runtimeHtml = await response.text();
          if (target === 'SOD' && pendingReward === 'SOD') clearReward();
          iframe.srcdoc = runtimeHtml.replace('<body>', `<body data-game="${target}">`);
          iframe.hidden = false;
          iframe.focus();
        } catch (error) {
          status && (status.textContent = `${gameName} failed to open`);
        }
      }, 1850);
    }

    function finishPowerOff(after) {
      window.clearTimeout(beamTimer); beamTimer = 0; shuttingDown = false; stopNoise();
      tracker.reset();
      svg.classList.remove('unlocked');
      scene.classList.remove('crt-unlocked', 'wolf-wide-screen');
      cancelAnimationFrame(compositorFrame); compositorFrame = 0;
      screen.classList.remove('powered', 'beam-warm', 'beam-raster', 'beam-on', 'beam-off', 'beam-collapse', 'beam-release', 'beam-hold', 'display-live', 'game-revealing', 'compositor-active', 'compositor-live', 'crt-filter-active');
      compositeContext.clearRect(0, 0, compositor.width, compositor.height);
      iframe.style.clipPath = '';
      iframe.hidden = true;
      iframe.removeAttribute('srcdoc');
      iframe.src = 'about:blank';
      boot.hidden = false;
      clearGlows();
      status && (status.textContent = pendingReward ? 'CRT powered down · reward ready' : 'CRT powered down · board controls restored');
      if (pendingReward) scheduleRewardReveal();
      if (after) after();
    }
    function powerOff(after) {
      if (shuttingDown) return;
      unlocked = false; shuttingDown = true;
      playCrtSound('off');
      status && (status.textContent = 'CRT shutdown · projecting the shutdown message');
      playRealShutdown().then(() => {
        status && (status.textContent = 'CRT powered down · marble table restored');
        finishPowerOff(after);
      });
    }
    function exitToGame(direction) {
      if (!unlocked || shuttingDown) return;
      powerOff(() => onExit(direction));
    }
    function pressMenuSymbol(id) {
      if (!unlocked) return;
      if (id === menuSequence[menuProgress]) menuProgress += 1;
      else menuProgress = id === menuSequence[0] ? 1 : 0;
      status && (status.textContent = `Secret menu sequence ${menuProgress} of ${menuSequence.length}`);
      if (menuProgress !== menuSequence.length) return;
      menuProgress = 0;
      const runtime = iframe.contentWindow;
      if (runtime && typeof runtime.uWolfOpenSecretMenu === 'function') runtime.uWolfOpenSecretMenu();
      else if (runtime) runtime.postMessage({ type: 'uwolf-secret-menu' }, '*');
      status && (status.textContent = 'Secret uWolf menu unlocked');
    }

    function revealMenuReward() {
      if (pendingReward !== 'MENU' || !unlocked) return false;
      svg.classList.add('menu-reward'); menuProgress = 0;
      status && (status.textContent = 'Spear reward · memorize the illuminated room sequence');
      menuSequence.forEach((id, index) => {
        const timer = window.setTimeout(() => {
          revealTimers.delete(timer);
          const hit = svg.querySelector('[data-secret-symbol="' + id + '"]');
          if (hit) hit.classList.add('reward-reveal');
          if (index === menuSequence.length - 1) {
            clearReward();
            const cleanup = window.setTimeout(() => { revealTimers.delete(cleanup); svg.classList.remove('menu-reward'); svg.querySelectorAll('.reward-reveal').forEach((node) => node.classList.remove('reward-reveal')); }, 1200);
            revealTimers.add(cleanup);
          }
        }, 700 + index * 1050);
        revealTimers.add(timer);
      });
      return true;
    }

    function runtimeMessage(event) {
      if (event.source !== iframe.contentWindow || !event.data) return;
      if (event.data.type === 'uwolf-reward-earned' && (event.data.target === 'SOD' || event.data.target === 'MENU')) {
        rememberReward(event.data.target);
        status && (status.textContent = event.data.target === 'SOD' ? 'Spear reward stored · close the CRT to reveal it' : 'Secret-menu reward stored · close Spear to reveal it');
        return;
      }
      if (event.data.type === 'uwolf-score-finished') {
        status && (status.textContent = pendingReward ? 'Run complete · preparing reward' : 'Run complete · CRT ready for another unlock');
        powerOff();
        return;
      }
      if (event.data.type === 'uwolf-wide-mode') {
        scene.classList.toggle('wolf-wide-screen', !!event.data.active);
        status && (status.textContent = event.data.active ? 'Wide mobile game view enabled' : 'Embedded CRT view restored');
        return;
      }
      if (event.data.type !== 'uwolf-scene-zoom' || scene.classList.contains('wolf-wide-screen')) return;
      const factor = Math.max(.88, Math.min(1.12, Number(event.data.factor) || 1));
      const x = Math.max(0, Math.min(1, Number(event.data.x) || .5));
      const y = Math.max(0, Math.min(1, Number(event.data.y) || .5));
      const rect = screen.getBoundingClientRect();
      onZoom(factor, rect.left + rect.width * x, rect.top + rect.height * y);
    }
    window.addEventListener('message', runtimeMessage);

    iframe.addEventListener('load', () => {
      if (!unlocked || iframe.hidden) return;
      startupPromise.then(() => {
        if (!unlocked || iframe.hidden) return;
        status && (status.textContent = 'Boot pixels complete · materializing the game from the center');
        return playRealGameReveal();
      }).then(() => {
        if (!unlocked || iframe.hidden) return;
        if (pendingReward === 'MENU') { const timer = window.setTimeout(() => { revealTimers.delete(timer); revealMenuReward(); }, 1200); revealTimers.add(timer); }
      });
    });
    iframe.addEventListener('error', () => {
      status && (status.textContent = `Wolfenstein runtime failed to open: ${wolfUrl}`);
    });
    const tracker = createSequenceTracker((progress, _length, id, target) => {
      describe(progress);
      if (progress <= 1) clearGlows();
      if (id) glow(id, !!target && id === sequences[target][Math.max(0, progress - 1)] && progress > 0);
    }, unlock);

    for (const symbol of symbols) {
      const hit = document.createElementNS(svg.namespaceURI, 'circle');
      hit.setAttribute('class', 'wolf-symbol-hit');
      hit.setAttribute('cx', symbol.x);
      hit.setAttribute('cy', symbol.y);
      hit.setAttribute('r', symbol.radius);
      hit.setAttribute('data-symbol', symbol.id);
      hit.setAttribute('role', 'button');
      hit.setAttribute('tabindex', '0');
      hit.setAttribute('aria-label', symbol.label);
      const press = (event) => { event.preventDefault(); event.stopPropagation(); if (!revealing) tracker.press(symbol.id); };
      hit.addEventListener('click', press);
      hit.addEventListener('pointerdown', (event) => event.stopPropagation());
      hit.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') press(event);
      });
      svg.append(hit);
    }
    for (const roomSymbol of roomSymbols) {
      const hit = document.createElementNS(svg.namespaceURI, 'rect');
      hit.setAttribute('class', 'wolf-secret-hit');
      hit.setAttribute('x', roomSymbol.x); hit.setAttribute('y', roomSymbol.y);
      hit.setAttribute('width', roomSymbol.width); hit.setAttribute('height', roomSymbol.height);
      hit.setAttribute('data-secret-symbol', roomSymbol.id);
      hit.setAttribute('role', 'button'); hit.setAttribute('tabindex', '-1');
      hit.setAttribute('aria-label', roomSymbol.label);
      // Keep the room symbol's secret-menu role, but allow the click to bubble
      // to the board's normal hotspot/QR handlers so those interactions remain
      // available while the CRT is active.
      const press = (event) => { event.preventDefault(); pressMenuSymbol(roomSymbol.id); };
      hit.addEventListener('click', press);
      hit.addEventListener('pointerdown', (event) => event.stopPropagation());
      svg.append(hit);
    }
    for (const dial of [
      { direction: -1, x: 435, width: 130, label: 'Previous board game' },
      { direction: 1, x: 1080, width: 138, label: 'Next board game' },
    ]) {
      const hit = document.createElementNS(svg.namespaceURI, 'rect');
      hit.setAttribute('class', 'wolf-dial-exit');
      hit.setAttribute('x', dial.x); hit.setAttribute('y', 807);
      hit.setAttribute('width', dial.width); hit.setAttribute('height', 134);
      hit.setAttribute('role', 'button'); hit.setAttribute('tabindex', '0');
      hit.setAttribute('aria-label', dial.label);
      const exit = (event) => { event.preventDefault(); event.stopPropagation(); exitToGame(dial.direction); };
      hit.addEventListener('click', exit);
      hit.addEventListener('pointerdown', (event) => event.stopPropagation());
      hit.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') exit(event); });
      svg.append(hit);
    }
    function reveal(target = 'WL6', message = '') {
      if (unlocked || revealing || !sequences[target]) return false;
      revealing = true; tracker.reset(); clearGlows();
      status && (status.textContent = message || 'Stellar core mastered · watch the CRT sequence');
      sequences[target].forEach((id, index) => { const timer = window.setTimeout(() => { revealTimers.delete(timer); tracker.press(id); if (index === sequences[target].length - 1) revealing = false; }, 700 + index * 1050); revealTimers.add(timer); });
      return true;
    }
    scene.append(svg);
    describe(0);
    if (pendingReward) scheduleRewardReveal(1200);

    return {
      reset() {
        powerOff();
      },
      destroy() { if (rewardTimer) window.clearTimeout(rewardTimer); rewardTimer = 0; for (const timer of revealTimers) window.clearTimeout(timer); revealTimers.clear(); if (lightFrame) cancelAnimationFrame(lightFrame); window.clearTimeout(beamTimer); stopNoise(); window.removeEventListener('message', runtimeMessage); scene.classList.remove('wolf-wide-screen'); iframe.removeAttribute('srcdoc'); iframe.src = 'about:blank'; noiseCanvas.remove(); phosphor.remove(); svg.remove(); },
      press: (id) => revealing ? { accepted: false, progress: tracker.progress, target: tracker.target, unlocked: false } : tracker.press(id),
      reveal,
      testReward(target) { if (!['localhost','127.0.0.1','::1'].includes(location.hostname) || (target !== 'SOD' && target !== 'MENU')) return false; rememberReward(target); powerOff(); scheduleRewardReveal(150); return true; },
      powerOff,
      isActive: () => unlocked,
    };
  }

  window.FutureWolfCrt = { createSequenceTracker, mount, sequence: [...sequence], sodSequence: [...sodSequence], menuSequence: [...menuSequence], symbols: symbols.map((item) => ({ ...item })) };
})();
