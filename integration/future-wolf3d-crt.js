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
      status && (status.textContent = 'CRT unlocked · warming picture tube');
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
          iframe.srcdoc = runtimeHtml.replace('<body>', `<body data-game="${target}">`);
          iframe.hidden = false;
          boot.hidden = true;
          iframe.focus();
        } catch (error) {
          status && (status.textContent = `${gameName} failed to open`);
        }
      }, 1850);
    }

    function powerOff() {
      unlocked = false;
      tracker.reset();
      svg.classList.remove('unlocked');
      scene.classList.remove('crt-unlocked');
      scene.classList.remove('wolf-wide-screen');
      screen.classList.remove('powered');
      iframe.hidden = true;
      iframe.removeAttribute('srcdoc');
      iframe.src = 'about:blank';
      boot.hidden = false;
      clearGlows();
      status && (status.textContent = 'CRT powered down · board controls restored');
    }
    function exitToGame(direction) {
      if (!unlocked) return;
      powerOff();
      onExit(direction);
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

    function runtimeMessage(event) {
      if (event.source !== iframe.contentWindow || !event.data) return;
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
      status && (status.textContent = 'Wolfenstein runtime loaded · click the screen for keyboard control');
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
      const press = (event) => { event.preventDefault(); event.stopPropagation(); tracker.press(symbol.id); };
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
    scene.append(svg);
    describe(0);

    return {
      reset() {
        powerOff();
      },
      destroy() { if (lightFrame) cancelAnimationFrame(lightFrame); window.removeEventListener('message', runtimeMessage); scene.classList.remove('wolf-wide-screen'); iframe.removeAttribute('srcdoc'); iframe.src = 'about:blank'; svg.remove(); },
      press: (id) => tracker.press(id),
      powerOff,
      isActive: () => unlocked,
    };
  }

  window.FutureWolfCrt = { createSequenceTracker, mount, sequence: [...sequence], sodSequence: [...sodSequence], menuSequence: [...menuSequence], symbols: symbols.map((item) => ({ ...item })) };
})();
