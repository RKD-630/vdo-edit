(() => {
  'use strict';

  // ====== STATE ======
  const state = {
    screen: 'home',
    originalImage: null,
    originalData: null,
    currentData: null,
    baseData: null,      // data before current filter preview
    mask: null,
    width: 0, height: 0,
    fileName: 'Untitled', fileSize: 0, fileFormat: '',
    tool: 'brush',
    brush: { size: 40, hardness: 80, opacity: 100, feather: 10, mode: 'erase' },
    selection: { type: 'freehand', tolerance: 50, path: [], active: false },
    view: { scale: 1, tx: 0, ty: 0, rotation: 0 },
    history: [], historyIndex: -1, maxHistory: 50,
    export: { format: 'png', quality: 'high', bg: 'checker' },
    theme: localStorage.getItem('eraser-theme') || 'dark',
    recent: JSON.parse(localStorage.getItem('eraser-recent') || '[]'),
    compare: { visible: false, pos: 0.5 },
    isDrawing: false, lastPoint: null,
    pointers: new Map(), pinch: null,
    // NEW: Filter state
    filter: { name: 'none', brightness: 0, contrast: 0, saturation: 0 },
    // NEW: Frame state
    frame: { type: 'none', thickness: 20, radius: 0 },
    // NEW: Crop state
    crop: { active: false, x: 0, y: 0, w: 0, h: 0, ratio: 'free', dragging: null, startX: 0, startY: 0, startRect: null }
  };

  const $ = (id) => document.getElementById(id);
  const el = {
    homeScreen: $('homeScreen'), editorScreen: $('editorScreen'),
    fileInput: $('fileInput'), cameraInput: $('cameraInput'),
    canvas: $('canvas'), frameCanvas: $('frameCanvas'),
    canvasWrap: $('canvasWrap'), checkerboard: $('checkerboard'),
    infoSize: $('infoSize'), infoFormat: $('infoFormat'), infoFileSize: $('infoFileSize'),
    brushCursor: $('brushCursor'), zoomLevel: $('zoomLevel'),
    loading: $('loading'), loadingText: $('loadingText'), loadingSub: $('loadingSub'),
    toast: $('toast'), dropZone: $('dropZone'), panelBackdrop: $('panelBackdrop'),
    tbTitle: $('tbTitle'), tbUndo: $('tbUndo'), tbRedo: $('tbRedo'),
    fabAuto: $('fabAuto'), compareWrap: $('compareWrap'),
    compareAfter: $('compareAfter'), compareLine: $('compareLine'), compareHandle: $('compareHandle'),
    selectionMarquee: $('selectionMarquee'), recentList: $('recentList'),
    cropOverlay: $('cropOverlay'), cropBox: $('cropBox'), cropSizeLabel: $('cropSizeLabel'),
    filterGrid: $('filterGrid'), frameGrid: $('frameGrid')
  };
  const ctx = el.canvas.getContext('2d', { willReadFrequently: true });
  const fctx = el.frameCanvas.getContext('2d');

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function showLoading(t='Processing...', s='This may take a moment') {
    el.loadingText.textContent = t; el.loadingSub.textContent = s;
    el.loading.classList.add('visible');
  }
  function hideLoading() { el.loading.classList.remove('visible'); }
  let toastTimer = null;
  function toast(msg, type='info') {
    el.toast.textContent = msg;
    el.toast.className = 'toast visible ' + type;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('visible'), 2800);
  }
  function formatBytes(b) {
    if (b < 1024) return b + ' B';
    if (b < 1024*1024) return (b/1024).toFixed(1) + ' KB';
    return (b/(1024*1024)).toFixed(1) + ' MB';
  }

  function applyTheme(t) {
    state.theme = t; document.body.dataset.theme = t;
    localStorage.setItem('eraser-theme', t);
  }
  applyTheme(state.theme);

  function showHome() {
    state.screen = 'home';
    el.homeScreen.classList.remove('hidden');
    el.editorScreen.classList.remove('visible');
    renderRecent();
  }
  function showEditor() {
    state.screen = 'editor';
    el.homeScreen.classList.add('hidden');
    el.editorScreen.classList.add('visible');
    requestAnimationFrame(() => fitToScreen());
  }

  // ====== FILE ======
  function triggerImport() { el.fileInput.click(); }
  function triggerCamera() { el.cameraInput.click(); }
  function handleFile(file) {
    if (!file) return;
    const validTypes = ['image/jpeg','image/jpg','image/png','image/webp','image/bmp','image/tiff','image/gif','image/avif','image/heic','image/svg+xml'];
    const ext = file.name.split('.').pop().toLowerCase();
    const validExts = ['jpg','jpeg','png','webp','bmp','tiff','tif','gif','avif','heic','heif','svg'];
    if (!validTypes.includes(file.type) && !validExts.includes(ext)) { toast('Unsupported file format', 'error'); return; }
    if (file.size > 50*1024*1024) { toast('File too large (max 50MB)', 'error'); return; }
    showLoading('Loading image...', 'Decoding file');
    const reader = new FileReader();
    reader.onerror = () => { hideLoading(); toast('Failed to read file', 'error'); };
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try { initFromImage(img, file); hideLoading(); showEditor(); addRecent(file.name, e.target.result); }
        catch (err) { hideLoading(); toast('Corrupted or invalid image', 'error'); }
      };
      img.onerror = () => { hideLoading(); toast('Could not decode image', 'error'); };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
  function initFromImage(img, file) {
    const MAX = 4096;
    let w = img.naturalWidth, h = img.naturalHeight;
    if (w > MAX || h > MAX) {
      const r = Math.min(MAX/w, MAX/h);
      w = Math.round(w*r); h = Math.round(h*r);
    }
    state.width = w; state.height = h;
    el.canvas.width = w; el.canvas.height = h;
    el.frameCanvas.width = w; el.frameCanvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);
    state.originalData = ctx.getImageData(0, 0, w, h);
    state.currentData = ctx.getImageData(0, 0, w, h);
    state.baseData = ctx.getImageData(0, 0, w, h);
    state.mask = new Uint8Array(w*h).fill(255);
    state.originalImage = img;
    state.fileName = file ? file.name.replace(/\.[^.]+$/, '') : 'Untitled';
    state.fileSize = file ? file.size : 0;
    state.fileFormat = file ? (file.type.split('/')[1] || 'unknown').toUpperCase() : '';
    el.tbTitle.textContent = state.fileName;
    el.infoSize.textContent = `${w}×${h}`;
    el.infoFormat.textContent = state.fileFormat;
    el.infoFileSize.textContent = state.fileSize ? formatBytes(state.fileSize) : '';
    state.history = []; state.historyIndex = -1;
    state.filter = { name: 'none', brightness: 0, contrast: 0, saturation: 0 };
    state.frame = { type: 'none', thickness: 20, radius: 0 };
    pushHistory();
    render();
    buildFilterGrid();
    buildFrameGrid();
    resetFilterSliders();
  }
  function addRecent(name, dataUrl) {
    const item = { name, thumb: dataUrl, ts: Date.now() };
    state.recent = [item, ...state.recent.filter(r => r.name !== name)].slice(0, 8);
    try { localStorage.setItem('eraser-recent', JSON.stringify(state.recent)); } catch(e) {}
  }
  function renderRecent() {
    if (!state.recent.length) { el.recentList.classList.remove('visible'); return; }
    el.recentList.classList.add('visible');
    el.recentList.innerHTML = state.recent.map(r => `
      <div class="recent-item">
        <div class="recent-thumb" style="background-image:url('${r.thumb}')"></div>
        <div class="recent-info"><div class="recent-name">${escapeHtml(r.name)}</div>
        <div class="recent-meta">${new Date(r.ts).toLocaleDateString()}</div></div>
      </div>`).join('');
  }
  function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // ====== RENDER ======
  function render() {
    if (!state.currentData) return;
    ctx.putImageData(state.currentData, 0, 0);
    applyViewTransform();
    updateZoomLabel();
    renderFrame();
  }
  function applyViewTransform() {
    const { scale, tx, ty, rotation } = state.view;
    const t = `translate(${tx}px, ${ty}px) scale(${scale}) rotate(${rotation}deg)`;
    el.canvas.style.transform = t;
    el.frameCanvas.style.transform = t;
    el.canvas.style.width = state.width + 'px';
    el.canvas.style.height = state.height + 'px';
    el.frameCanvas.style.width = state.width + 'px';
    el.frameCanvas.style.height = state.height + 'px';
  }
  function updateZoomLabel() { el.zoomLevel.textContent = Math.round(state.view.scale*100) + '%'; }
  function fitToScreen() {
    if (!state.width) return;
    const wrap = el.canvasWrap.getBoundingClientRect();
    const pad = 40;
    const sx = (wrap.width - pad) / state.width;
    const sy = (wrap.height - pad) / state.height;
    const s = Math.min(sx, sy, 1);
    state.view.scale = s;
    state.view.tx = (wrap.width - state.width*s) / 2;
    state.view.ty = (wrap.height - state.height*s) / 2;
    state.view.rotation = 0;
    applyViewTransform(); updateZoomLabel();
  }
  function zoomBy(factor, cx, cy) {
    const wrap = el.canvasWrap.getBoundingClientRect();
    if (cx === undefined) { cx = wrap.width/2; cy = wrap.height/2; }
    const oldScale = state.view.scale;
    const newScale = clamp(oldScale*factor, 0.05, 20);
    state.view.tx = cx - (cx - state.view.tx) * (newScale/oldScale);
    state.view.ty = cy - (cy - state.view.ty) * (newScale/oldScale);
    state.view.scale = newScale;
    applyViewTransform(); updateZoomLabel();
  }
  function screenToCanvas(x, y) {
    const wrap = el.canvasWrap.getBoundingClientRect();
    return { x: (x - wrap.left - state.view.tx) / state.view.scale,
             y: (y - wrap.top - state.view.ty) / state.view.scale };
  }

  // ====== HISTORY ======
  function pushHistory() {
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push({
      data: new Uint8ClampedArray(state.currentData.data),
      mask: new Uint8Array(state.mask),
      w: state.width, h: state.height
    });
    if (state.history.length > state.maxHistory) state.history.shift();
    state.historyIndex = state.history.length - 1;
    updateUndoRedo();
  }
  function undo() {
    if (state.historyIndex <= 0) return;
    state.historyIndex--;
    restoreHistory();
  }
  function redo() {
    if (state.historyIndex >= state.history.length - 1) return;
    state.historyIndex++;
    restoreHistory();
  }
  function restoreHistory() {
    const snap = state.history[state.historyIndex];
    if (snap.w !== state.width || snap.h !== state.height) {
      state.width = snap.w; state.height = snap.h;
      el.canvas.width = snap.w; el.canvas.height = snap.h;
      el.frameCanvas.width = snap.w; el.frameCanvas.height = snap.h;
      el.infoSize.textContent = `${snap.w}×${snap.h}`;
    }
    state.currentData = new ImageData(new Uint8ClampedArray(snap.data), snap.w, snap.h);
    state.mask = new Uint8Array(snap.mask);
    render(); updateUndoRedo();
  }
  function updateUndoRedo() {
    el.tbUndo.classList.toggle('disabled', state.historyIndex <= 0);
    el.tbRedo.classList.toggle('disabled', state.historyIndex >= state.history.length - 1);
  }

  // ====== MASK ======
  function applyMaskToCurrent() {
    const d = state.currentData.data;
    const m = state.mask;
    const orig = state.baseData.data;
    for (let i = 0, p = 0; i < m.length; i++, p += 4) {
      d[p] = orig[p]; d[p+1] = orig[p+1]; d[p+2] = orig[p+2]; d[p+3] = m[i];
    }
  }

  // ====== BRUSH ======
  function paintBrush(cx, cy) {
    const { size, hardness, opacity, mode } = state.brush;
    const radius = size/2;
    const x0 = Math.max(0, Math.floor(cx - radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const x1 = Math.min(state.width-1, Math.ceil(cx + radius));
    const y1 = Math.min(state.height-1, Math.ceil(cy + radius));
    const opF = opacity/100;
    const hardF = hardness/100;
    const softRange = radius * (1 - hardF);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > radius) continue;
        let alpha = (dist <= radius - softRange) ? 1 : 1 - (dist - (radius - softRange)) / Math.max(1, softRange);
        alpha = clamp(alpha * opF, 0, 1);
        const idx = y * state.width + x;
        if (mode === 'erase') state.mask[idx] = Math.round(state.mask[idx] * (1 - alpha));
        else state.mask[idx] = Math.min(255, Math.round(state.mask[idx] + (255 - state.mask[idx]) * alpha));
      }
    }
    applyMaskToCurrent();
  }
  function interpolateBrush(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const step = Math.max(2, state.brush.size / 6);
    const steps = Math.max(1, Math.ceil(dist / step));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      paintBrush(x0 + dx*t, y0 + dy*t);
    }
  }

  // ====== AI BG REMOVE ======
  function autoRemoveBackground() {
    if (!state.originalData) return;
    showLoading('Detecting subject...', 'Analyzing edges & colors');
    setTimeout(() => {
      try {
        const w = state.width, h = state.height;
        const data = state.baseData.data;
        const mask = new Uint8Array(w*h).fill(255);
        const edgeSamples = [];
        const sampleStep = Math.max(1, Math.floor(Math.min(w, h) / 80));
        for (let x = 0; x < w; x += sampleStep) {
          edgeSamples.push(getPixel(data, x, 0, w));
          edgeSamples.push(getPixel(data, x, h-1, w));
        }
        for (let y = 0; y < h; y += sampleStep) {
          edgeSamples.push(getPixel(data, 0, y, w));
          edgeSamples.push(getPixel(data, w-1, y, w));
        }
        const bgColor = findDominantColor(edgeSamples);
        const tolerance = 45;
        const visited = new Uint8Array(w*h);
        const queue = [];
        for (let x = 0; x < w; x++) { queue.push(0, x, h-1, x); }
        for (let y = 0; y < h; y++) { queue.push(y, 0, y, w-1); }
        while (queue.length) {
          const x = queue.shift(), y = queue.shift();
          const idx = y*w + x;
          if (visited[idx]) continue;
          visited[idx] = 1;
          const p = getPixel(data, x, y, w);
          if (colorDistance(p, bgColor) <= tolerance) {
            mask[idx] = 0;
            if (x > 0) queue.push(y, x-1);
            if (x < w-1) queue.push(y, x+1);
            if (y > 0) queue.push(y-1, x);
            if (y < h-1) queue.push(y+1, x);
          }
        }
        smoothMask(mask, w, h);
        state.mask = mask;
        applyMaskToCurrent();
        pushHistory(); render(); hideLoading();
        toast('Background removed', 'success');
      } catch (err) { hideLoading(); toast('Auto-detect failed', 'error'); }
    }, 50);
  }
  function getPixel(data, x, y, w) { const i = (y*w + x)*4; return [data[i], data[i+1], data[i+2]]; }
  function colorDistance(a, b) { const dr=a[0]-b[0], dg=a[1]-b[1], db=a[2]-b[2]; return Math.sqrt(dr*dr+dg*dg+db*db); }
  function findDominantColor(samples) {
    const rs = samples.map(s => s[0]).sort((a,b)=>a-b);
    const gs = samples.map(s => s[1]).sort((a,b)=>a-b);
    const bs = samples.map(s => s[2]).sort((a,b)=>a-b);
    const m = Math.floor(samples.length/2);
    return [rs[m], gs[m], bs[m]];
  }
  function smoothMask(mask, w, h) {
    const tmp = new Uint8Array(mask.length);
    const radius = 2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0, count = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x+dx, ny = y+dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            sum += mask[ny*w + nx]; count++;
          }
        }
        tmp[y*w + x] = Math.round(sum/count);
      }
    }
    mask.set(tmp);
  }

  function magicAt(cx, cy) {
    const x = Math.floor(cx), y = Math.floor(cy);
    if (x < 0 || y < 0 || x >= state.width || y >= state.height) return;
    const w = state.width, h = state.height;
    const data = state.baseData.data;
    const target = getPixel(data, x, y, w);
    const tol = 20 + (state.selection.tolerance / 100) * 60;
    const visited = new Uint8Array(w*h);
    const stack = [x, y];
    while (stack.length) {
      const cy2 = stack.pop(), cx2 = stack.pop();
      if (cx2 < 0 || cy2 < 0 || cx2 >= w || cy2 >= h) continue;
      const idx = cy2*w + cx2;
      if (visited[idx]) continue;
      visited[idx] = 1;
      const p = getPixel(data, cx2, cy2, w);
      if (colorDistance(p, target) <= tol) {
        state.mask[idx] = 0;
        stack.push(cx2+1, cy2, cx2-1, cy2, cx2, cy2+1, cx2, cy2-1);
      }
    }
    applyMaskToCurrent();
  }

  function colorEraseAt(cx, cy) {
    const x = Math.floor(cx), y = Math.floor(cy);
    if (x < 0 || y < 0 || x >= state.width || y >= state.height) return;
    const w = state.width, h = state.height;
    const data = state.baseData.data;
    const target = getPixel(data, x, y, w);
    const tol = 20 + (state.selection.tolerance / 100) * 60;
    
    for (let i = 0; i < w * h; i++) {
      if (state.mask[i] === 0) continue;
      const px = i % w, py = Math.floor(i / w);
      const p = getPixel(data, px, py, w);
      if (colorDistance(p, target) <= tol) {
        state.mask[i] = 0;
      }
    }
    applyMaskToCurrent();
  }

  // ====== PANELS ======
  function openPanel(id) { $(id).classList.add('visible'); el.panelBackdrop.classList.add('visible'); }
  function closeAllPanels() {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('visible'));
    el.panelBackdrop.classList.remove('visible');
  }

  // ====== SELECTION ======
  let selStart = null;
  function startSelection(x, y) {
    const c = screenToCanvas(x, y);
    selStart = c; state.selection.path = [c]; state.selection.active = true;
    el.selectionMarquee.classList.add('visible');
  }
  function updateSelection(x, y) {
    if (!state.selection.active || !selStart) return;
    const c = screenToCanvas(x, y);
    const wrap = el.canvasWrap.getBoundingClientRect();
    const type = state.selection.type;
    let left, top, width, height;
    if (type === 'rect') {
      left = Math.min(selStart.x, c.x); top = Math.min(selStart.y, c.y);
      width = Math.abs(c.x - selStart.x); height = Math.abs(c.y - selStart.y);
    } else if (type === 'ellipse') {
      const cx = (selStart.x + c.x)/2, cy = (selStart.y + c.y)/2;
      const rx = Math.abs(c.x - selStart.x)/2, ry = Math.abs(c.y - selStart.y)/2;
      left = cx - rx; top = cy - ry; width = rx*2; height = ry*2;
    } else {
      state.selection.path.push(c);
      left = Math.min(...state.selection.path.map(p=>p.x));
      top = Math.min(...state.selection.path.map(p=>p.y));
      const right = Math.max(...state.selection.path.map(p=>p.x));
      const bottom = Math.max(...state.selection.path.map(p=>p.y));
      width = right - left; height = bottom - top;
    }
    const sx = left*state.view.scale + state.view.tx;
    const sy = top*state.view.scale + state.view.ty;
    el.selectionMarquee.style.left = (wrap.left + sx) + 'px';
    el.selectionMarquee.style.top = (wrap.top + sy) + 'px';
    el.selectionMarquee.style.width = (width*state.view.scale) + 'px';
    el.selectionMarquee.style.height = (height*state.view.scale) + 'px';
  }
  function endSelection() { state.selection.active = false; }
  function applySelectionToMask() {
    const type = state.selection.type;
    const w = state.width, h = state.height;
    if (type === 'rect' && selStart) {
      const c = state.selection.path[state.selection.path.length-1] || selStart;
      const x0 = Math.max(0, Math.floor(Math.min(selStart.x, c.x)));
      const y0 = Math.max(0, Math.floor(Math.min(selStart.y, c.y)));
      const x1 = Math.min(w, Math.ceil(Math.max(selStart.x, c.x)));
      const y1 = Math.min(h, Math.ceil(Math.max(selStart.y, c.y)));
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++)
          state.mask[y*w + x] = 0;
    } else if (type === 'ellipse' && selStart) {
      const c = state.selection.path[state.selection.path.length-1] || selStart;
      const cx = (selStart.x + c.x)/2, cy = (selStart.y + c.y)/2;
      const rx = Math.abs(c.x - selStart.x)/2, ry = Math.abs(c.y - selStart.y)/2;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const dx = (x - cx)/rx, dy = (y - cy)/ry;
          if (dx*dx + dy*dy <= 1) state.mask[y*w + x] = 0;
        }
    } else if ((type === 'freehand' || type === 'lasso') && state.selection.path.length > 2) {
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (pointInPolygon(x, y, state.selection.path)) state.mask[y*w + x] = 0;
    }
    applyMaskToCurrent(); pushHistory(); render(); clearSelection(); closeAllPanels();
    toast('Selection applied', 'success');
  }
  function pointInPolygon(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length-1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
  function clearSelection() {
    state.selection.path = []; state.selection.active = false; selStart = null;
    el.selectionMarquee.classList.remove('visible');
  }

  // ====== FILTERS ======
  const FILTERS = [
    { name: 'None', fn: (r,g,b) => [r,g,b] },
    { name: 'B&W', fn: (r,g,b) => { const v = 0.299*r + 0.587*g + 0.114*b; return [v,v,v]; } },
    { name: 'Sepia', fn: (r,g,b) => [
      clamp(r*0.393 + g*0.769 + b*0.189, 0, 255),
      clamp(r*0.349 + g*0.686 + b*0.168, 0, 255),
      clamp(r*0.272 + g*0.534 + b*0.131, 0, 255)] },
    { name: 'Vintage', fn: (r,g,b) => [
      clamp(r*1.1 + 30, 0, 255), clamp(g*0.95 + 15, 0, 255), clamp(b*0.7 + 20, 0, 255)] },
    { name: 'Warm', fn: (r,g,b) => [clamp(r+25,0,255), clamp(g+10,0,255), clamp(b-15,0,255)] },
    { name: 'Cool', fn: (r,g,b) => [clamp(r-15,0,255), clamp(g+5,0,255), clamp(b+30,0,255)] },
    { name: 'Noir', fn: (r,g,b) => {
      const v = 0.299*r + 0.587*g + 0.114*b;
      const c = v > 128 ? clamp((v-128)*2.2, 0, 255) : 0;
      return [c,c,c]; } },
    { name: 'Fade', fn: (r,g,b) => [
      clamp(r*0.8 + 40, 0, 255), clamp(g*0.8 + 40, 0, 255), clamp(b*0.8 + 40, 0, 255)] },
    { name: 'Vivid', fn: (r,g,b) => {
      const avg = (r+g+b)/3;
      return [clamp(avg + (r-avg)*1.6, 0, 255), clamp(avg + (g-avg)*1.6, 0, 255), clamp(avg + (b-avg)*1.6, 0, 255)]; } },
    { name: 'Invert', fn: (r,g,b) => [255-r, 255-g, 255-b] },
    { name: 'Sunset', fn: (r,g,b) => [clamp(r*1.2+20,0,255), clamp(g*0.85+10,0,255), clamp(b*0.7,0,255)] },
    { name: 'Arctic', fn: (r,g,b) => [clamp(r*0.85,0,255), clamp(g*1.05+10,0,255), clamp(b*1.25+20,0,255)] },
    { name: 'Drama', fn: (r,g,b) => {
      const f = 1.4;
      return [clamp((r-128)*f + 128, 0, 255), clamp((g-128)*f + 128, 0, 255), clamp((b-128)*f + 128, 0, 255)]; } },
    { name: 'Pastel', fn: (r,g,b) => [
      clamp(r*0.6 + 100, 0, 255), clamp(g*0.6 + 100, 0, 255), clamp(b*0.6 + 100, 0, 255)] },
    { name: 'Cyber', fn: (r,g,b) => [clamp(r*0.8+40,0,255), clamp(g*0.5,0,255), clamp(b*1.4+30,0,255)] },
    { name: 'Golden', fn: (r,g,b) => [clamp(r*1.2+15,0,255), clamp(g*1.05+5,0,255), clamp(b*0.75,0,255)] }
  ];

  function applyFilterToData(srcData, filterName, brightness=0, contrast=0, saturation=0) {
    const out = new ImageData(new Uint8ClampedArray(srcData.data), srcData.width, srcData.height);
    const d = out.data;
    const filter = FILTERS.find(f => f.name === filterName) || FILTERS[0];
    const brightF = brightness * 2.55;
    const contF = (contrast + 100) / 100;
    const satF = (saturation + 100) / 100;
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i+1], b = d[i+2];
      // Base filter
      [r, g, b] = filter.fn(r, g, b);
      // Brightness
      r += brightF; g += brightF; b += brightF;
      // Contrast
      r = (r - 128) * contF + 128;
      g = (g - 128) * contF + 128;
      b = (b - 128) * contF + 128;
      // Saturation
      const avg = (r + g + b) / 3;
      r = avg + (r - avg) * satF;
      g = avg + (g - avg) * satF;
      b = avg + (b - avg) * satF;
      d[i] = clamp(r, 0, 255);
      d[i+1] = clamp(g, 0, 255);
      d[i+2] = clamp(b, 0, 255);
    }
    return out;
  }

  function buildFilterGrid() {
    if (!state.baseData) return;
    el.filterGrid.innerHTML = '';
    // Create small thumbnail
    const thumbSize = 80;
    const tmpCanvas = document.createElement('canvas');
    const ratio = state.width / state.height;
    if (ratio > 1) { tmpCanvas.width = thumbSize; tmpCanvas.height = Math.round(thumbSize / ratio); }
    else { tmpCanvas.height = thumbSize; tmpCanvas.width = Math.round(thumbSize * ratio); }
    const tctx = tmpCanvas.getContext('2d');
    tctx.putImageData(state.baseData, 0, 0, 0, 0, state.width, state.height);
    // Draw scaled
    const tmp2 = document.createElement('canvas');
    tmp2.width = tmpCanvas.width; tmp2.height = tmpCanvas.height;
    const t2ctx = tmp2.getContext('2d');
    const tmpSrc = document.createElement('canvas');
    tmpSrc.width = state.width; tmpSrc.height = state.height;
    tmpSrc.getContext('2d').putImageData(state.baseData, 0, 0);
    t2ctx.drawImage(tmpSrc, 0, 0, tmpCanvas.width, tmpCanvas.height);

    FILTERS.forEach((f, idx) => {
      const card = document.createElement('div');
      card.className = 'filter-card' + (state.filter.name === f.name ? ' active' : '');
      card.dataset.name = f.name;
      const preview = document.createElement('div');
      preview.className = 'filter-preview';
      const pc = document.createElement('canvas');
      pc.width = tmp2.width; pc.height = tmp2.height;
      const pctx = pc.getContext('2d');
      pctx.drawImage(tmp2, 0, 0);
      const imgData = pctx.getImageData(0, 0, pc.width, pc.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const [r, g, b] = f.fn(d[i], d[i+1], d[i+2]);
        d[i] = r; d[i+1] = g; d[i+2] = b;
      }
      pctx.putImageData(imgData, 0, 0);
      preview.appendChild(pc);
      const name = document.createElement('div');
      name.className = 'filter-name';
      name.textContent = f.name;
      card.appendChild(preview);
      card.appendChild(name);
      card.addEventListener('click', () => {
        document.querySelectorAll('.filter-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        state.filter.name = f.name;
        previewFilter();
      });
      el.filterGrid.appendChild(card);
    });
  }

  function previewFilter() {
    if (!state.baseData) return;
    const filtered = applyFilterToData(state.baseData, state.filter.name,
      state.filter.brightness, state.filter.contrast, state.filter.saturation);
    // Apply mask to filtered
    state.currentData = filtered;
    applyMaskToCurrent();
    render();
  }

  function resetFilterSliders() {
    $('adjBright').value = 0; $('valBright').textContent = '0';
    $('adjContrast').value = 0; $('valContrast').textContent = '0';
    $('adjSat').value = 0; $('valSat').textContent = '0';
  }

  // ====== FRAMES ======
  const FRAMES = [
    { name: 'None', draw: null },
    { name: 'White', draw: (ctx, w, h, t, r) => drawBorderFrame(ctx, w, h, t, r, '#ffffff', null) },
    { name: 'Black', draw: (ctx, w, h, t, r) => drawBorderFrame(ctx, w, h, t, r, '#000000', null) },
    { name: 'Gold', draw: (ctx, w, h, t, r) => drawGradientFrame(ctx, w, h, t, r, ['#f9d976','#c99a2e','#f9d976']) },
    { name: 'Silver', draw: (ctx, w, h, t, r) => drawGradientFrame(ctx, w, h, t, r, ['#e8e8e8','#8a8a8a','#e8e8e8']) },
    { name: 'Wood', draw: (ctx, w, h, t, r) => drawGradientFrame(ctx, w, h, t, r, ['#8b5a2b','#5a3818','#8b5a2b']) },
    { name: 'Polaroid', draw: (ctx, w, h, t, r) => drawPolaroidFrame(ctx, w, h, t) },
    { name: 'Shadow', draw: (ctx, w, h, t, r) => drawShadowFrame(ctx, w, h, t, r) },
    { name: 'Neon', draw: (ctx, w, h, t, r) => drawNeonFrame(ctx, w, h, t, r) },
    { name: 'Double', draw: (ctx, w, h, t, r) => drawDoubleFrame(ctx, w, h, t, r) },
    { name: 'Rose', draw: (ctx, w, h, t, r) => drawGradientFrame(ctx, w, h, t, r, ['#ff9a9e','#fad0c4','#ff9a9e']) },
    { name: 'Ocean', draw: (ctx, w, h, t, r) => drawGradientFrame(ctx, w, h, t, r, ['#2193b0','#6dd5ed','#2193b0']) }
  ];

  function drawBorderFrame(ctx, w, h, t, r, color, shadow) {
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    if (shadow) { ctx.shadowColor = shadow; ctx.shadowBlur = t/2; }
    ctx.fillStyle = color;
    roundRect(ctx, 0, 0, w, h, r, true, false);
    ctx.globalCompositeOperation = 'destination-out';
    roundRect(ctx, t, t, w - t*2, h - t*2, Math.max(0, r - t/2), true, false);
    ctx.restore();
  }
  function drawGradientFrame(ctx, w, h, t, r, colors) {
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, 0, w, h);
    colors.forEach((c, i) => grad.addColorStop(i / (colors.length-1), c));
    ctx.fillStyle = grad;
    roundRect(ctx, 0, 0, w, h, r, true, false);
    ctx.globalCompositeOperation = 'destination-out';
    roundRect(ctx, t, t, w - t*2, h - t*2, Math.max(0, r - t/2), true, false);
  }
  function drawPolaroidFrame(ctx, w, h, t) {
    ctx.clearRect(0, 0, w, h);
    const bottomExtra = t * 2.5;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(t, t, w - t*2, h - t - bottomExtra);
  }
  function drawShadowFrame(ctx, w, h, t, r) {
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = t;
    ctx.shadowOffsetX = t/4;
    ctx.shadowOffsetY = t/4;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, t/2, t/2, w - t, h - t, r, true, false);
    ctx.restore();
    ctx.globalCompositeOperation = 'destination-out';
    roundRect(ctx, t, t, w - t*2, h - t*2, Math.max(0, r - t/2), true, false);
  }
  function drawNeonFrame(ctx, w, h, t, r) {
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = t/3;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = t;
    roundRect(ctx, t/2, t/2, w - t, h - t, r, false, true);
    ctx.strokeStyle = '#ff00ff';
    ctx.shadowColor = '#ff00ff';
    roundRect(ctx, t/2, t/2, w - t, h - t, r, false, true);
    ctx.restore();
  }
  function drawDoubleFrame(ctx, w, h, t, r) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, 0, 0, w, h, r, true, false);
    ctx.globalCompositeOperation = 'destination-out';
    roundRect(ctx, t*0.6, t*0.6, w - t*1.2, h - t*1.2, Math.max(0, r - t/3), true, false);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(1, t/10);
    roundRect(ctx, t*0.3, t*0.3, w - t*0.6, h - t*0.6, Math.max(0, r - t/4), false, true);
    ctx.globalCompositeOperation = 'destination-out';
    roundRect(ctx, t, t, w - t*2, h - t*2, Math.max(0, r - t/2), true, false);
  }
  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    r = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  function buildFrameGrid() {
    el.frameGrid.innerHTML = '';
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 100; thumbCanvas.height = 100;
    if (state.width && state.height) {
      thumbCanvas.getContext('2d').drawImage(el.canvas, 0, 0, 100, 100);
    }
    const thumbURL = thumbCanvas.toDataURL();

    FRAMES.forEach((f, idx) => {
      const card = document.createElement('div');
      card.className = 'frame-card' + (state.frame.type === f.name ? ' active' : '');
      card.dataset.name = f.name;
      const preview = document.createElement('div');
      preview.className = 'frame-preview';
      if (f.draw) {
        const pc = document.createElement('canvas');
        pc.width = 100; pc.height = 100;
        const pctx = pc.getContext('2d');
        f.draw(pctx, 100, 100, 12, 6);
        preview.style.backgroundImage = `url(${pc.toDataURL()}), url(${thumbURL})`;
        preview.style.backgroundSize = 'cover';
        preview.style.backgroundPosition = 'center';
      } else {
        preview.style.backgroundImage = `url(${thumbURL})`;
        preview.style.backgroundSize = 'cover';
        preview.style.backgroundPosition = 'center';
      }
      const name = document.createElement('div');
      name.className = 'frame-name';
      name.textContent = f.name;
      card.appendChild(preview);
      card.appendChild(name);
      card.addEventListener('click', () => {
        document.querySelectorAll('.frame-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        state.frame.type = f.name;
        renderFrame();
      });
      el.frameGrid.appendChild(card);
    });
  }

  function renderFrame() {
    if (!state.width || !state.height) return;
    fctx.globalCompositeOperation = 'source-over';
    fctx.clearRect(0, 0, state.width, state.height);
    const f = FRAMES.find(x => x.name === state.frame.type);
    if (f && f.draw) {
      fctx.save();
      f.draw(fctx, state.width, state.height, state.frame.thickness, state.frame.radius);
      fctx.restore();
    }
  }

  // ====== CROP ======
  function enterCropMode() {
    closeAllPanels();
    state.crop.active = true;
    // Initialize crop box to full image (in screen coords)
    const wrap = el.canvasWrap.getBoundingClientRect();
    const imgScreenX = state.view.tx;
    const imgScreenY = state.view.ty;
    const imgScreenW = state.width * state.view.scale;
    const imgScreenH = state.height * state.view.scale;
    const pad = 20;
    state.crop.x = imgScreenX + pad;
    state.crop.y = imgScreenY + pad;
    state.crop.w = imgScreenW - pad*2;
    state.crop.h = imgScreenH - pad*2;
    state.crop.ratio = 'free';
    el.cropOverlay.classList.add('visible');
    el.fabAuto.classList.add('hidden');
    updateCropBox();
  }
  function exitCropMode() {
    state.crop.active = false;
    el.cropOverlay.classList.remove('visible');
    el.fabAuto.classList.remove('hidden');
  }
  function updateCropBox() {
    const b = state.crop;
    el.cropBox.style.left = b.x + 'px';
    el.cropBox.style.top = b.y + 'px';
    el.cropBox.style.width = b.w + 'px';
    el.cropBox.style.height = b.h + 'px';
    // Size label in image pixels
    const pw = Math.round(b.w / state.view.scale);
    const ph = Math.round(b.h / state.view.scale);
    el.cropSizeLabel.textContent = `${pw} × ${ph}`;
  }
  function applyCrop() {
    const b = state.crop;
    // Convert to image coords
    const ix = Math.round((b.x - state.view.tx) / state.view.scale);
    const iy = Math.round((b.y - state.view.ty) / state.view.scale);
    const iw = Math.round(b.w / state.view.scale);
    const ih = Math.round(b.h / state.view.scale);
    if (iw < 10 || ih < 10) { toast('Crop area too small', 'error'); return; }
    // Clip to image bounds
    const x0 = clamp(ix, 0, state.width);
    const y0 = clamp(iy, 0, state.height);
    const x1 = clamp(ix + iw, 0, state.width);
    const y1 = clamp(iy + ih, 0, state.height);
    const cw = x1 - x0, ch = y1 - y0;
    if (cw < 10 || ch < 10) { toast('Invalid crop area', 'error'); return; }
    // Extract image data
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = state.width; tmpCanvas.height = state.height;
    tmpCanvas.getContext('2d').putImageData(state.currentData, 0, 0);
    const newCanvas = document.createElement('canvas');
    newCanvas.width = cw; newCanvas.height = ch;
    newCanvas.getContext('2d').drawImage(tmpCanvas, x0, y0, cw, ch, 0, 0, cw, ch);
    const newData = newCanvas.getContext('2d').getImageData(0, 0, cw, ch);
    // Extract mask
    const newMask = new Uint8Array(cw * ch);
    for (let y = 0; y < ch; y++)
      for (let x = 0; x < cw; x++)
        newMask[y*cw + x] = state.mask[(y0+y)*state.width + (x0+x)];
    // Also extract baseData for filter
    const tmpBase = document.createElement('canvas');
    tmpBase.width = state.width; tmpBase.height = state.height;
    tmpBase.getContext('2d').putImageData(state.baseData, 0, 0);
    const newBaseCanvas = document.createElement('canvas');
    newBaseCanvas.width = cw; newBaseCanvas.height = ch;
    newBaseCanvas.getContext('2d').drawImage(tmpBase, x0, y0, cw, ch, 0, 0, cw, ch);
    const newBaseData = newBaseCanvas.getContext('2d').getImageData(0, 0, cw, ch);
    // Update state
    state.width = cw; state.height = ch;
    el.canvas.width = cw; el.canvas.height = ch;
    el.frameCanvas.width = cw; el.frameCanvas.height = ch;
    state.currentData = newData;
    state.mask = newMask;
    state.baseData = newBaseData;
    state.originalData = newBaseData;
    el.infoSize.textContent = `${cw}×${ch}`;
    pushHistory();
    render();
    fitToScreen();
    exitCropMode();
    toast('Crop applied', 'success');
  }

  // Crop interaction
  function onCropPointerDown(e) {
    if (!state.crop.active) return;
    const handle = e.target.dataset?.handle;
    const wrap = el.canvasWrap.getBoundingClientRect();
    const px = e.clientX - wrap.left;
    const py = e.clientY - wrap.top;
    const b = state.crop;
    if (handle) {
      state.crop.dragging = handle;
    } else if (e.target === el.cropBox || e.target.closest('#cropBox')) {
      state.crop.dragging = 'move';
    } else {
      return;
    }
    state.crop.startX = px;
    state.crop.startY = py;
    state.crop.startRect = { x: b.x, y: b.y, w: b.w, h: b.h };
    el.cropOverlay.setPointerCapture(e.pointerId);
    e.stopPropagation();
  }
  function onCropPointerMove(e) {
    if (!state.crop.dragging) return;
    const wrap = el.canvasWrap.getBoundingClientRect();
    const px = e.clientX - wrap.left;
    const py = e.clientY - wrap.top;
    const dx = px - state.crop.startX;
    const dy = py - state.crop.startY;
    const s = state.crop.startRect;
    const b = state.crop;
    const minSize = 30;
    const imgScreenX = state.view.tx;
    const imgScreenY = state.view.ty;
    const imgScreenW = state.width * state.view.scale;
    const imgScreenH = state.height * state.view.scale;

    const applyRatio = (w, h) => {
      if (state.crop.ratio === 'free') return [w, h];
      const [rw, rh] = state.crop.ratio.split(':').map(Number);
      const ratio = rw / rh;
      if (w / h > ratio) return [h * ratio, h];
      return [w, w / ratio];
    };

    if (state.crop.dragging === 'move') {
      b.x = clamp(s.x + dx, imgScreenX, imgScreenX + imgScreenW - s.w);
      b.y = clamp(s.y + dy, imgScreenY, imgScreenY + imgScreenH - s.h);
      b.w = s.w; b.h = s.h;
    } else {
      let nx = s.x, ny = s.y, nw = s.w, nh = s.h;
      const d = state.crop.dragging;
      if (d.includes('w')) { nx = s.x + dx; nw = s.w - dx; }
      if (d.includes('e')) { nw = s.w + dx; }
      if (d.includes('n')) { ny = s.y + dy; nh = s.h - dy; }
      if (d.includes('s')) { nh = s.h + dy; }
      // Enforce min size
      if (nw < minSize) { if (d.includes('w')) nx = s.x + s.w - minSize; nw = minSize; }
      if (nh < minSize) { if (d.includes('n')) ny = s.y + s.h - minSize; nh = minSize; }
      // Apply ratio
      if (state.crop.ratio !== 'free') {
        [nw, nh] = applyRatio(nw, nh);
        if (d.includes('w')) nx = s.x + s.w - nw;
        if (d.includes('n')) ny = s.y + s.h - nh;
      }
      // Clip to image bounds
      nx = clamp(nx, imgScreenX, imgScreenX + imgScreenW);
      ny = clamp(ny, imgScreenY, imgScreenY + imgScreenH);
      nw = Math.min(nw, imgScreenX + imgScreenW - nx);
      nh = Math.min(nh, imgScreenY + imgScreenH - ny);
      b.x = nx; b.y = ny; b.w = nw; b.h = nh;
    }
    updateCropBox();
  }
  function onCropPointerUp(e) {
    state.crop.dragging = null;
    try { el.cropOverlay.releasePointerCapture(e.pointerId); } catch(_) {}
  }

  // ====== COMPARE ======
  function toggleCompare() {
    state.compare.visible = !state.compare.visible;
    if (state.compare.visible) {
      el.compareWrap.classList.add('visible');
      el.fabAuto.classList.add('hidden');
      let before = el.compareWrap.querySelector('canvas');
      if (!before) {
        before = document.createElement('canvas');
        before.style.position = 'absolute';
        before.style.top = '0'; before.style.left = '0';
        before.style.transformOrigin = '0 0';
        el.compareWrap.insertBefore(before, el.compareWrap.firstChild);
      }
      before.width = state.width; before.height = state.height;
      before.getContext('2d').putImageData(state.originalData, 0, 0);
      before.style.transform = el.canvas.style.transform;
      before.style.width = state.width + 'px';
      before.style.height = state.height + 'px';
      updateCompare(0.5);
    } else {
      el.compareWrap.classList.remove('visible');
      el.fabAuto.classList.remove('hidden');
    }
  }
  function updateCompare(ratio) {
    state.compare.pos = clamp(ratio, 0, 1);
    const wrap = el.canvasWrap.getBoundingClientRect();
    const x = wrap.width * ratio;
    el.compareLine.style.left = x + 'px';
    el.compareHandle.style.left = x + 'px';
    el.compareAfter.style.clipPath = `inset(0 0 0 ${x}px)`;
  }

  // ====== EXPORT ======
  function doExport() {
    const { format, quality } = state.export;
    let mime = 'image/png', q = undefined;
    if (format === 'webp') { mime = 'image/webp'; q = qualityValue(); }
    else if (format === 'jpeg') { mime = 'image/jpeg'; q = qualityValue(); }
    // Composite canvas + frame
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = state.width; exportCanvas.height = state.height;
    const ectx = exportCanvas.getContext('2d');
    if (format === 'jpeg') {
      ectx.fillStyle = '#ffffff';
      ectx.fillRect(0, 0, state.width, state.height);
    }
    ectx.drawImage(el.canvas, 0, 0);
    // Draw frame on top
    const f = FRAMES.find(x => x.name === state.frame.type);
    if (f && f.draw) {
      const frameTmp = document.createElement('canvas');
      frameTmp.width = state.width; frameTmp.height = state.height;
      const fCtx = frameTmp.getContext('2d');
      fCtx.globalCompositeOperation = 'source-over';
      f.draw(fCtx, state.width, state.height, state.frame.thickness, state.frame.radius);
      ectx.globalCompositeOperation = 'source-over';
      ectx.drawImage(frameTmp, 0, 0);
    }
    try {
      exportCanvas.toBlob((blob) => {
        if (!blob) { toast('Export failed', 'error'); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.fileName}-edited.${format === 'jpeg' ? 'jpg' : format}`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast('Image saved', 'success');
        closeAllPanels();
      }, mime, q);
    } catch (err) { toast('Export failed', 'error'); }
  }
  function qualityValue() {
    return { original: 1, high: 0.92, medium: 0.75, low: 0.5 }[state.export.quality];
  }

  // ====== TRANSFORM ======
  function rotateImage() {
    const w = state.width, h = state.height;
    const tmp = document.createElement('canvas');
    tmp.width = h; tmp.height = w;
    const tctx = tmp.getContext('2d');
    tctx.translate(h/2, w/2); tctx.rotate(Math.PI/2);
    tctx.drawImage(el.canvas, -w/2, -h/2);
    state.width = h; state.height = w;
    el.canvas.width = h; el.canvas.height = w;
    el.frameCanvas.width = h; el.frameCanvas.height = w;
    ctx.drawImage(tmp, 0, 0);
    state.currentData = ctx.getImageData(0, 0, h, w);
    // Rotate originalData
    const tmp2 = document.createElement('canvas');
    tmp2.width = state.originalData.width; tmp2.height = state.originalData.height;
    tmp2.getContext('2d').putImageData(state.originalData, 0, 0);
    const tmp3 = document.createElement('canvas');
    tmp3.width = h; tmp3.height = w;
    const t3ctx = tmp3.getContext('2d');
    t3ctx.translate(h/2, w/2); t3ctx.rotate(Math.PI/2);
    t3ctx.drawImage(tmp2, -state.originalData.width/2, -state.originalData.height/2);
    state.originalData = t3ctx.getImageData(0, 0, h, w);
    state.baseData = new ImageData(new Uint8ClampedArray(state.originalData.data), h, w);
    // Rotate mask
    const newMask = new Uint8Array(w*h);
    for (let y = 0; y < w; y++)
      for (let x = 0; x < h; x++)
        newMask[y*h + x] = state.mask[(w-1-x)*state.width + y];
    state.mask = newMask;
    el.infoSize.textContent = `${h}×${w}`;
    pushHistory(); render(); fitToScreen();
  }
  function flipImage(horizontal) {
    const w = state.width, h = state.height;
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    const tctx = tmp.getContext('2d');
    if (horizontal) { tctx.translate(w, 0); tctx.scale(-1, 1); }
    else { tctx.translate(0, h); tctx.scale(1, -1); }
    tctx.drawImage(el.canvas, 0, 0);
    ctx.drawImage(tmp, 0, 0);
    state.currentData = ctx.getImageData(0, 0, w, h);
    const newMask = new Uint8Array(w*h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        newMask[y*w + x] = horizontal ? state.mask[y*w + (w-1-x)] : state.mask[(h-1-y)*w + x];
    state.mask = newMask;
    pushHistory(); render();
  }
  function resetImage() {
    state.currentData = new ImageData(new Uint8ClampedArray(state.originalData.data), state.width, state.height);
    state.baseData = new ImageData(new Uint8ClampedArray(state.originalData.data), state.width, state.height);
    state.mask.fill(255);
    state.filter = { name: 'none', brightness: 0, contrast: 0, saturation: 0 };
    resetFilterSliders();
    applyMaskToCurrent();
    pushHistory(); render();
    toast('Image reset');
  }
  function resetMask() {
    state.mask.fill(255);
    applyMaskToCurrent();
    pushHistory(); render();
    toast('Mask reset');
  }
  function clearBackground() {
    state.mask.fill(0);
    applyMaskToCurrent();
    pushHistory(); render();
    toast('Background cleared');
  }
  function restoreOriginal() {
    state.currentData = new ImageData(new Uint8ClampedArray(state.originalData.data), state.width, state.height);
    state.baseData = new ImageData(new Uint8ClampedArray(state.originalData.data), state.width, state.height);
    state.mask.fill(255);
    state.filter = { name: 'none', brightness: 0, contrast: 0, saturation: 0 };
    resetFilterSliders();
    pushHistory(); render();
    toast('Original restored');
  }

  // ====== POINTER EVENTS ======
  function getPointerPos(e) { return { x: e.clientX, y: e.clientY }; }

  function onPointerDown(e) {
    if (state.screen !== 'editor') return;
    if (state.crop.active) return;
    if (e.target.closest('.topbar, .bottombar, .panel, .zoom-controls, .fab, .compare-wrap, .crop-overlay')) return;
    el.canvasWrap.setPointerCapture(e.pointerId);
    state.pointers.set(e.pointerId, getPointerPos(e));
    if (state.pointers.size === 2) {
      const [p1, p2] = [...state.pointers.values()];
      state.pinch = {
        dist: Math.hypot(p2.x - p1.x, p2.y - p1.y),
        scale: state.view.scale,
        cx: (p1.x + p2.x) / 2, cy: (p1.y + p2.y) / 2,
        tx: state.view.tx, ty: state.view.ty
      };
      state.isDrawing = false;
      return;
    }
    if (state.pointers.size === 1) {
      const pos = getPointerPos(e);
      if (state.tool === 'brush' || state.tool === 'erase' || state.tool === 'restore') {
        state.isDrawing = true;
        const c = screenToCanvas(pos.x, pos.y);
        state.lastPoint = c;
        paintBrush(c.x, c.y); render();
      } else if (state.tool === 'magic') {
        const c = screenToCanvas(pos.x, pos.y);
        magicAt(c.x, c.y); pushHistory(); render();
      } else if (state.tool === 'colorErase') {
        const c = screenToCanvas(pos.x, pos.y);
        colorEraseAt(c.x, c.y); pushHistory(); render();
      } else if (state.tool === 'select') {
        startSelection(pos.x, pos.y);
      } else if (state.tool === 'auto') {
        autoRemoveBackground();
      } else {
        state.isPanning = true;
        state.panStart = { x: pos.x, y: pos.y, tx: state.view.tx, ty: state.view.ty };
      }
    }
  }
  function onPointerMove(e) {
    if (!state.pointers.has(e.pointerId)) return;
    const pos = getPointerPos(e);
    state.pointers.set(e.pointerId, pos);
    if ((state.tool === 'brush' || state.tool === 'erase' || state.tool === 'restore') && state.screen === 'editor' && !state.crop.active) {
      el.brushCursor.classList.add('visible');
      const size = state.brush.size * state.view.scale;
      el.brushCursor.style.left = pos.x + 'px';
      el.brushCursor.style.top = pos.y + 'px';
      el.brushCursor.style.width = size + 'px';
      el.brushCursor.style.height = size + 'px';
    }
    if (state.pointers.size === 2 && state.pinch) {
      const [p1, p2] = [...state.pointers.values()];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const ratio = dist / state.pinch.dist;
      const newScale = clamp(state.pinch.scale * ratio, 0.05, 20);
      const cx = (p1.x + p2.x) / 2, cy = (p1.y + p2.y) / 2;
      const wrap = el.canvasWrap.getBoundingClientRect();
      const lcx = state.pinch.cx - wrap.left, lcy = state.pinch.cy - wrap.top;
      state.view.scale = newScale;
      state.view.tx = state.pinch.tx + (cx - state.pinch.cx) - lcx * (newScale / state.pinch.scale - 1);
      state.view.ty = state.pinch.ty + (cy - state.pinch.cy) - lcy * (newScale / state.pinch.scale - 1);
      applyViewTransform(); updateZoomLabel();
      return;
    }
    if (state.isDrawing && state.pointers.size === 1) {
      const c = screenToCanvas(pos.x, pos.y);
      if (state.lastPoint) interpolateBrush(state.lastPoint.x, state.lastPoint.y, c.x, c.y);
      else paintBrush(c.x, c.y);
      state.lastPoint = c; render();
    } else if (state.isPanning && state.pointers.size === 1) {
      state.view.tx = state.panStart.tx + (pos.x - state.panStart.x);
      state.view.ty = state.panStart.ty + (pos.y - state.panStart.y);
      applyViewTransform();
    } else if (state.selection.active && state.pointers.size === 1) {
      updateSelection(pos.x, pos.y);
    }
  }
  function onPointerUp(e) {
    state.pointers.delete(e.pointerId);
    if (state.isDrawing) { state.isDrawing = false; state.lastPoint = null; pushHistory(); }
    if (state.isPanning) state.isPanning = false;
    if (state.pinch && state.pointers.size < 2) state.pinch = null;
    if (state.selection.active) endSelection();
    try { el.canvasWrap.releasePointerCapture(e.pointerId); } catch(_) {}
  }
  function onWheel(e) {
    if (state.screen !== 'editor' || state.crop.active) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const wrap = el.canvasWrap.getBoundingClientRect();
    zoomBy(factor, e.clientX - wrap.left, e.clientY - wrap.top);
  }
  function onDblClick(e) {
    if (state.screen !== 'editor' || state.crop.active) return;
    if (e.target.closest('.topbar, .bottombar, .panel')) return;
    const wrap = el.canvasWrap.getBoundingClientRect();
    zoomBy(1.5, e.clientX - wrap.left, e.clientY - wrap.top);
  }

  // Drag & Drop
  let dragCounter = 0;
  window.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    dragCounter++; el.dropZone.classList.add('visible');
  });
  window.addEventListener('dragleave', () => {
    dragCounter--;
    if (dragCounter <= 0) { dragCounter = 0; el.dropZone.classList.remove('visible'); }
  });
  window.addEventListener('dragover', (e) => { e.preventDefault(); });
  window.addEventListener('drop', (e) => {
    e.preventDefault(); dragCounter = 0;
    el.dropZone.classList.remove('visible');
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  });

  // ====== EVENT BINDINGS ======
  $('btnImport').addEventListener('click', triggerImport);
  $('btnCamera').addEventListener('click', triggerCamera);
  $('btnRecent').addEventListener('click', () => {
    if (state.recent.length) toast('Recent images shown below');
    else toast('No recent images');
  });
  $('btnNewProject').addEventListener('click', triggerImport);
  $('btnTheme').addEventListener('click', () => applyTheme(state.theme === 'dark' ? 'light' : 'dark'));
  $('btnAbout').addEventListener('click', () => toast('EraserAI — Background Remover v1.1'));

  el.fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
    e.target.value = '';
  });
  el.cameraInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
    e.target.value = '';
  });

  $('tbBack').addEventListener('click', showHome);
  $('tbImport').addEventListener('click', triggerImport);
  $('tbUndo').addEventListener('click', undo);
  $('tbRedo').addEventListener('click', redo);
  $('tbMenu').addEventListener('click', () => openPanel('panelMenu'));
  $('tbSave').addEventListener('click', () => openPanel('panelExport'));

  document.querySelectorAll('.bb-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      if (tool === 'crop') { openPanel('panelCrop'); }
      else if (tool === 'filter') { buildFilterGrid(); openPanel('panelFilter'); }
      else if (tool === 'frame') { buildFrameGrid(); openPanel('panelFrame'); }
      else if (tool === 'brush') {
        state.brush.mode = 'erase';
        document.querySelectorAll('#brushMode .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'erase'));
        openPanel('panelBrush');
      } else if (tool === 'erase') {
        state.brush.mode = 'erase';
        document.querySelectorAll('#brushMode .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'erase'));
        setTool('brush');
        openPanel('panelBrush');
      } else if (tool === 'restore') {
        state.brush.mode = 'restore';
        document.querySelectorAll('#brushMode .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'restore'));
        setTool('brush');
        openPanel('panelBrush');
      } else if (tool === 'magic') setTool('magic');
      else if (tool === 'colorErase') setTool('colorErase');
      else if (tool === 'select') openPanel('panelSelect');
      else if (tool === 'auto') autoRemoveBackground();
      else if (tool === 'compare') toggleCompare();
      else if (tool === 'export') openPanel('panelExport');
    });
  });

  function setTool(t) {
    state.tool = t;
    document.querySelectorAll('.bb-btn').forEach(b => {
      const bt = b.dataset.tool;
      let active = bt === t;
      if (t === 'brush' && state.brush.mode === 'restore') active = bt === 'restore';
      else if (t === 'brush' && state.brush.mode === 'erase') active = bt === 'erase' || bt === 'brush';
      b.classList.toggle('active', active);
    });
    if (t !== 'brush' && t !== 'erase' && t !== 'restore') el.brushCursor.classList.remove('visible');
  }

  el.fabAuto.addEventListener('click', autoRemoveBackground);
  $('zoomIn').addEventListener('click', () => zoomBy(1.25));
  $('zoomOut').addEventListener('click', () => zoomBy(0.8));
  $('zoomFit').addEventListener('click', fitToScreen);

  el.canvasWrap.addEventListener('pointerdown', onPointerDown);
  el.canvasWrap.addEventListener('pointermove', onPointerMove);
  el.canvasWrap.addEventListener('pointerup', onPointerUp);
  el.canvasWrap.addEventListener('pointercancel', onPointerUp);
  el.canvasWrap.addEventListener('wheel', onWheel, { passive: false });
  el.canvasWrap.addEventListener('dblclick', onDblClick);
  el.canvasWrap.addEventListener('contextmenu', (e) => e.preventDefault());
  el.canvasWrap.addEventListener('pointerleave', () => {
    if (state.pointers.size === 0) el.brushCursor.classList.remove('visible');
  });

  // Crop overlay events
  el.cropOverlay.addEventListener('pointerdown', onCropPointerDown);
  el.cropOverlay.addEventListener('pointermove', onCropPointerMove);
  el.cropOverlay.addEventListener('pointerup', onCropPointerUp);
  $('cropCancel').addEventListener('click', exitCropMode);
  $('cropApply').addEventListener('click', applyCrop);
  $('cropRotate').addEventListener('click', rotateImage);
  $('cropRotateLeft').addEventListener('click', rotateImage);
  $('cropFlipH').addEventListener('click', () => flipImage(true));
  $('cropReset').addEventListener('click', () => {
    state.filter = { name: 'none', brightness: 0, contrast: 0, saturation: 0 };
    resetFilterSliders();
    previewFilter();
    toast('Reset to original');
  });
  document.querySelectorAll('#cropRatio .seg-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#cropRatio .seg-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      state.crop.ratio = b.dataset.ratio;
      if (state.crop.active) {
        // Adjust crop box to match ratio
        const [rw, rh] = state.crop.ratio === 'free' ? [1,1] : state.crop.ratio.split(':').map(Number);
        const ratio = rw / rh;
        const newH = state.crop.w / ratio;
        state.crop.h = Math.min(newH, state.height * state.view.scale - (state.crop.y - state.view.ty));
        updateCropBox();
      }
    });
  });
  $('cropStart').addEventListener('click', enterCropMode);

  el.panelBackdrop.addEventListener('click', closeAllPanels);

  // Brush panel
  const brushInputs = { size: $('brushSize'), hardness: $('brushHardness'), opacity: $('brushOpacity'), feather: $('brushFeather') };
  const brushVals = { size: $('valSize'), hardness: $('valHardness'), opacity: $('valOpacity'), feather: $('valFeather') };
  brushInputs.size.addEventListener('input', (e) => { state.brush.size = +e.target.value; brushVals.size.textContent = e.target.value; });
  brushInputs.hardness.addEventListener('input', (e) => { state.brush.hardness = +e.target.value; brushVals.hardness.textContent = e.target.value + '%'; });
  brushInputs.opacity.addEventListener('input', (e) => { state.brush.opacity = +e.target.value; brushVals.opacity.textContent = e.target.value + '%'; });
  brushInputs.feather.addEventListener('input', (e) => { state.brush.feather = +e.target.value; brushVals.feather.textContent = e.target.value; });
  document.querySelectorAll('#brushMode .seg-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#brushMode .seg-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      state.brush.mode = b.dataset.mode;
      setTool('brush');
    });
  });
  $('brushDone').addEventListener('click', closeAllPanels);

  // Selection panel
  document.querySelectorAll('#panelSelect .tool-card').forEach(c => {
    c.addEventListener('click', () => {
      document.querySelectorAll('#panelSelect .tool-card').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      state.selection.type = c.dataset.sel;
    });
  });
  $('selTolerance').addEventListener('input', (e) => {
    state.selection.tolerance = +e.target.value;
    const v = +e.target.value;
    $('valTolerance').textContent = v < 33 ? 'Low' : v < 66 ? 'Medium' : 'High';
  });
  $('selInvert').addEventListener('click', () => {
    for (let i = 0; i < state.mask.length; i++) state.mask[i] = 255 - state.mask[i];
    applyMaskToCurrent(); pushHistory(); render();
    toast('Selection inverted');
  });
  $('selAll').addEventListener('click', () => { state.mask.fill(0); applyMaskToCurrent(); render(); toast('All selected'); });
  $('selClear').addEventListener('click', () => { clearSelection(); closeAllPanels(); });
  $('selApply').addEventListener('click', applySelectionToMask);

  // Filter panel
  $('adjBright').addEventListener('input', (e) => {
    state.filter.brightness = +e.target.value;
    $('valBright').textContent = e.target.value;
    previewFilter();
  });
  $('adjContrast').addEventListener('input', (e) => {
    state.filter.contrast = +e.target.value;
    $('valContrast').textContent = e.target.value;
    previewFilter();
  });
  $('adjSat').addEventListener('input', (e) => {
    state.filter.saturation = +e.target.value;
    $('valSat').textContent = e.target.value;
    previewFilter();
  });
  $('filterReset').addEventListener('click', () => {
    state.filter = { name: 'none', brightness: 0, contrast: 0, saturation: 0 };
    resetFilterSliders();
    document.querySelectorAll('.filter-card').forEach(c => c.classList.toggle('active', c.dataset.name === 'None'));
    previewFilter();
  });
  $('filterApply').addEventListener('click', () => {
    // Bake filter into baseData
    const filtered = applyFilterToData(state.baseData, state.filter.name,
      state.filter.brightness, state.filter.contrast, state.filter.saturation);
    state.baseData = filtered;
    state.originalData = filtered;
    state.filter = { name: 'none', brightness: 0, contrast: 0, saturation: 0 };
    resetFilterSliders();
    applyMaskToCurrent();
    pushHistory(); render();
    closeAllPanels();
    buildFilterGrid();
    toast('Filter applied', 'success');
  });

  // Frame panel
  $('frameThick').addEventListener('input', (e) => {
    state.frame.thickness = +e.target.value;
    $('valFrameThick').textContent = e.target.value;
    renderFrame();
  });
  $('frameRadius').addEventListener('input', (e) => {
    state.frame.radius = +e.target.value;
    $('valFrameRadius').textContent = e.target.value;
    renderFrame();
  });
  $('frameRemove').addEventListener('click', () => {
    state.frame.type = 'none';
    document.querySelectorAll('.frame-card').forEach(c => c.classList.toggle('active', c.dataset.name === 'None'));
    renderFrame();
    toast('Frame removed');
  });
  $('frameApply').addEventListener('click', () => {
    closeAllPanels();
    toast('Frame applied', 'success');
  });

  // Export panel
  document.querySelectorAll('#exportFormat .seg-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#exportFormat .seg-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      state.export.format = b.dataset.fmt;
    });
  });
  document.querySelectorAll('#exportQuality .seg-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#exportQuality .seg-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      state.export.quality = b.dataset.q;
    });
  });
  document.querySelectorAll('#bgPreview .seg-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#bgPreview .seg-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      state.export.bg = b.dataset.bg;
      const cb = el.checkerboard;
      cb.style.background = '';
      if (b.dataset.bg === 'white') cb.style.background = '#ffffff';
      else if (b.dataset.bg === 'black') cb.style.background = '#000000';
      else if (b.dataset.bg === 'gray') cb.style.background = '#808080';
    });
  });
  $('exportBtn').addEventListener('click', doExport);

  // Menu
  $('menuRotate').addEventListener('click', () => { rotateImage(); closeAllPanels(); });
  $('menuFlipH').addEventListener('click', () => { flipImage(true); closeAllPanels(); });
  $('menuFlipV').addEventListener('click', () => { flipImage(false); closeAllPanels(); });
  $('menuReset').addEventListener('click', () => { resetImage(); closeAllPanels(); });
  $('menuResetMask').addEventListener('click', () => { resetMask(); closeAllPanels(); });
  $('menuClearBg').addEventListener('click', () => { clearBackground(); closeAllPanels(); });
  $('menuRestoreOrig').addEventListener('click', () => { restoreOriginal(); closeAllPanels(); });
  $('menuTheme').addEventListener('click', () => { applyTheme(state.theme === 'dark' ? 'light' : 'dark'); closeAllPanels(); });
  $('menuDiscard').addEventListener('click', () => {
    if (confirm('Discard all changes and exit?')) { closeAllPanels(); showHome(); }
  });

  // Compare drag
  let compareDrag = false;
  el.compareHandle.addEventListener('pointerdown', (e) => {
    compareDrag = true; el.compareHandle.setPointerCapture(e.pointerId);
  });
  window.addEventListener('pointermove', (e) => {
    if (!compareDrag) return;
    const wrap = el.canvasWrap.getBoundingClientRect();
    updateCompare((e.clientX - wrap.left) / wrap.width);
  });
  window.addEventListener('pointerup', () => { compareDrag = false; });

  // Keyboard
  window.addEventListener('keydown', (e) => {
    if (state.screen !== 'editor') return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (state.crop.active) {
      if (e.key === 'Enter') { e.preventDefault(); applyCrop(); }
      else if (e.key === 'Escape') { e.preventDefault(); exitCropMode(); }
      return;
    }
    if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((ctrl && e.key === 'y') || (ctrl && e.shiftKey && e.key === 'z')) { e.preventDefault(); redo(); }
    else if (e.key === '+' || e.key === '=') zoomBy(1.15);
    else if (e.key === '-') zoomBy(0.87);
    else if (e.key === '0' && ctrl) { e.preventDefault(); fitToScreen(); }
    else if (e.key === 'c' && !ctrl) openPanel('panelCrop');
    else if (e.key === 'f' && !ctrl) openPanel('panelFilter');
    else if (e.key === 'Escape') { closeAllPanels(); clearSelection(); }
    else if (e.key === 'b') setTool('brush');
    else if (e.key === 'e') { state.brush.mode = 'erase'; setTool('brush'); }
    else if (e.key === 'r') { state.brush.mode = 'restore'; setTool('brush'); }
    else if (e.key === 'm') setTool('magic');
    else if (e.key === 's' && ctrl) { e.preventDefault(); openPanel('panelExport'); }
  });

  window.addEventListener('resize', () => {
    if (state.screen === 'editor' && state.width) applyViewTransform();
  });
  document.addEventListener('touchmove', (e) => {
    if (e.target.closest('.panel')) return;
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  renderRecent();
  updateUndoRedo();
  setTimeout(() => toast('Welcome to EraserAI ✨', 'success'), 500);
})();