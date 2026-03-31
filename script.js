document.addEventListener('DOMContentLoaded', () => {
    
    // --- Application State ---
    const APP = {
        ratio: '9:16',
        zoom: 50, // Pixels per second
        duration: 20, // Total timeline duration in seconds
        time: 0, 
        playing: false,
        selectedClipId: null,
        tracks: {
            media: [], 
            text: [],  
            audio: []  
        },
    };

    // --- DOM Elements ---
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const newProjectBtn = document.getElementById('new-project-btn');
    
    const propEmpty = document.getElementById('prop-empty');
    const propMedia = document.getElementById('prop-media');
    const propText = document.getElementById('prop-text');
    const propAudio = document.getElementById('prop-audio');

    const frameBg = document.getElementById('frame-bg');
    const frameObjects = document.getElementById('frame-objects');
    const videoFrame = document.getElementById('dynamic-video-frame');
    const playerTimeDisplay = document.getElementById('player-time-display');

    const tlPlayBtn = document.getElementById('tl-play');
    const tlTimeCounter = document.getElementById('tl-time-counter');
    const tlZoom = document.getElementById('tl-zoom');
    const tlDeleteBtn = document.getElementById('tl-delete-btn');
    
    const playhead = document.getElementById('playhead');
    const playheadHandle = document.getElementById('playhead-handle');
    const trackContents = {
        media: document.getElementById('content-media'),
        text: document.getElementById('content-text'),
        audio: document.getElementById('content-audio')
    };
    const tracksViewport = document.getElementById('tracks-viewport');
    
    const bgType = document.getElementById('bg-type');
    const bgColorGroup = document.getElementById('bg-color-group');
    const bgGradGroup = document.getElementById('bg-grad-group');
    const bgUploadGroup = document.getElementById('bg-upload-group');
    const bgColorVal = document.getElementById('bg-color-val');
    const bgColorHex = document.getElementById('bg-color-hex');
    const bgGrad1 = document.getElementById('bg-grad-1');
    const bgGrad2 = document.getElementById('bg-grad-2');
    const bgGradAngle = document.getElementById('bg-grad-angle');
    const bgFileUpload = document.getElementById('bg-file-upload');
    const bgFileName = document.getElementById('bg-file-name');

    const textContent = document.getElementById('text-content');
    const textFont = document.getElementById('text-font');
    const textSize = document.getElementById('text-size');
    const textColor = document.getElementById('text-color');
    const textBgColor = document.getElementById('text-bg-color');
    const textEffect = document.getElementById('text-effect');
    const effectSpeed = document.getElementById('effect-speed');
    const btnBold = document.getElementById('btn-bold');
    const btnItalic = document.getElementById('btn-italic');
    const iconButtons = document.querySelectorAll('.icon-insert-btn');

    const audioFileUpload = document.getElementById('audio-file-upload');
    const audioFileName = document.getElementById('audio-file-name');
    const audioVol = document.getElementById('audio-vol');

    const videoRatioBtn = document.getElementById('video-ratio-btn');
    const finishBtn = document.getElementById('finish-and-save-btn');
    const exportFormat = document.getElementById('export-format');
    const overlay = document.getElementById('generation-overlay');
    const progressFill = document.getElementById('progress-fill');
    const closeOverlayBtn = document.getElementById('close-overlay-btn');

    // --- Initialization ---
    function init() {
        addClip('media', 0, 10, { bgType: 'gradient', grad1: '#10b981', grad2: '#3b82f6', angle: 135 });
        addClip('text', 1, 8, { 
            text: "TEXT TO VIDEO\nSTUDIO PRO", 
            font: "'Outfit', sans-serif", 
            size: 48, color: "#ffffff", bgColor: "transparent", 
            effect: "none", bold: true, italic: false, x: 50, y: 50, speed: 5
        });

        updateRuler();
        updateRatioUI();
        seekTo(0);
        setupEventListeners();
    }

    function setupEventListeners() {
        if (sidebarToggle) sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            // If opening and nothing is selected, show the first text clip by default
            if(sidebar.classList.contains('open') && !APP.selectedClipId) {
                const firstText = APP.tracks.text[0];
                if(firstText) selectClip(firstText.id, 'text');
            }
        });
        if (newProjectBtn) newProjectBtn.addEventListener('click', () => { if(confirm("Start a new project? Unsaved changes will be lost.")) window.location.reload(); });
        if (videoRatioBtn) videoRatioBtn.addEventListener('change', (e) => { APP.ratio = e.target.value; updateRatioUI(); renderVideoFrame(); });
        
        if (tlZoom) tlZoom.addEventListener('input', (e) => { APP.zoom = parseInt(e.target.value); updateRuler(); renderTimelineClips(); updatePlayheadUI(); });

        const startPlayheadDrag = (e) => {
            e.preventDefault();
            const moveHandler = (moveEvent) => {
                const clientX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
                const rect = tracksViewport.getBoundingClientRect();
                const x = clientX - rect.left + tracksViewport.scrollLeft;
                seekTo(Math.max(0, Math.min(APP.duration, x / APP.zoom)));
            };
            const stopHandler = () => { document.removeEventListener('mousemove', moveHandler); document.removeEventListener('mouseup', stopHandler); document.removeEventListener('touchmove', moveHandler); document.removeEventListener('touchend', stopHandler); };
            document.addEventListener('mousemove', moveHandler); document.addEventListener('mouseup', stopHandler); document.addEventListener('touchmove', moveHandler, { passive: false }); document.addEventListener('touchend', stopHandler);
        };
        if (playheadHandle) { playheadHandle.addEventListener('mousedown', startPlayheadDrag); playheadHandle.addEventListener('touchstart', startPlayheadDrag, { passive: false }); }
        tracksViewport.addEventListener('mousedown', (e) => { if (e.target.id === 'tl-ruler' || e.target.parentElement.id === 'tl-ruler') { const rect = tracksViewport.getBoundingClientRect(); const x = e.clientX - rect.left + tracksViewport.scrollLeft; seekTo(Math.max(0, Math.min(APP.duration, x / APP.zoom))); } });

        if (tlPlayBtn) tlPlayBtn.addEventListener('click', togglePlayback);
        document.getElementById('add-media-clip-btn').addEventListener('click', () => addClip('media', APP.time, 5, { bgType: 'color', color: '#1a1a2e', objectFit: 'cover' }));
        document.getElementById('add-text-clip-btn').addEventListener('click', () => addClip('text', APP.time, 4, { text: "New Text", font: "'Outfit', sans-serif", size: 36, color: '#ffffff', bgColor: 'transparent', effect: 'none', speed: 5, x: 50, y: 50 }));
        document.getElementById('add-audio-clip-btn').addEventListener('click', () => addClip('audio', 0, APP.duration, { src: null, volume: 100 }));

        if (tlDeleteBtn) tlDeleteBtn.addEventListener('click', deleteSelectedClip);

        if (bgType) bgType.addEventListener('change', (e) => { const c = getClip(APP.selectedClipId); if(c) { c.bgType = e.target.value; updateMediaInspectorVisibility(); renderVideoFrame(); renderTimelineClips(); } });
        if (bgColorVal) bgColorVal.addEventListener('input', (e) => { const c = getClip(APP.selectedClipId); if(c) { c.color = e.target.value; bgColorHex.value = e.target.value; renderVideoFrame(); } });
        if (bgColorHex) bgColorHex.addEventListener('input', (e) => { const c = getClip(APP.selectedClipId); if(c && /^#[0-9A-F]{3,6}$/i.test(e.target.value)) { c.color = e.target.value; bgColorVal.value = e.target.value; renderVideoFrame(); } });
        if (bgGrad1) bgGrad1.addEventListener('input', (e) => { const c = getClip(APP.selectedClipId); if(c) { c.grad1 = e.target.value; renderVideoFrame(); } });
        if (bgGrad2) bgGrad2.addEventListener('input', (e) => { const c = getClip(APP.selectedClipId); if(c) { c.grad2 = e.target.value; renderVideoFrame(); } });
        if (bgGradAngle) bgGradAngle.addEventListener('input', (e) => { if(document.getElementById('grad-angle-val')) document.getElementById('grad-angle-val').innerText = e.target.value; const c = getClip(APP.selectedClipId); if(c) { c.angle = e.target.value; renderVideoFrame(); } });
        if (bgFileUpload) bgFileUpload.addEventListener('change', handleMediaUpload);
        if (textContent) textContent.addEventListener('input', (e) => { const c = getClip(APP.selectedClipId); if(c) { c.text = e.target.value; renderVideoFrame(); renderTimelineClips(); } });
        if (textFont) textFont.addEventListener('change', (e) => { const c = getClip(APP.selectedClipId); if(c) { c.font = e.target.value; renderVideoFrame(); } });
        if (textSize) textSize.addEventListener('input', (e) => { if(document.getElementById('text-size-val')) document.getElementById('text-size-val').innerText = e.target.value + 'px'; const c = getClip(APP.selectedClipId); if(c) { c.size = parseInt(e.target.value); renderVideoFrame(); } });
        if (textColor) textColor.addEventListener('input', (e) => { const c = getClip(APP.selectedClipId); if(c) { c.color = e.target.value; renderVideoFrame(); } });
        if (textBgColor) textBgColor.addEventListener('input', (e) => { const c = getClip(APP.selectedClipId); if(c) { c.bgColor = e.target.value; renderVideoFrame(); } });
        if (textEffect) textEffect.addEventListener('change', (e) => { const c = getClip(APP.selectedClipId); if(c) { c.effect = e.target.value; updateEffectSettingsVisibility(); renderVideoFrame(); } });
        if (effectSpeed) effectSpeed.addEventListener('input', (e) => { if(document.getElementById('effect-speed-val')) document.getElementById('effect-speed-val').innerText = e.target.value; const c = getClip(APP.selectedClipId); if(c) { c.speed = parseInt(e.target.value); renderVideoFrame(); } });
        
        if (btnBold) btnBold.addEventListener('click', () => { const c = getClip(APP.selectedClipId); if(c) { c.bold = !c.bold; btnBold.classList.toggle('active', c.bold); renderVideoFrame(); } });
        if (btnItalic) btnItalic.addEventListener('click', () => { const c = getClip(APP.selectedClipId); if(c) { c.italic = !c.italic; btnItalic.classList.toggle('active', c.italic); renderVideoFrame(); } });

        iconButtons.forEach(btn => btn.addEventListener('click', () => { const c = getClip(APP.selectedClipId); if (c) { c.text = (c.text || '') + ` <i class="fa-solid ${btn.getAttribute('data-icon')}"></i>`; textContent.value = c.text; renderVideoFrame(); renderTimelineClips(); } }));
        if (audioFileUpload) audioFileUpload.addEventListener('change', handleAudioUpload);
        if (audioVol) audioVol.addEventListener('input', (e) => { if(document.getElementById('audio-vol-val')) document.getElementById('audio-vol-val').innerText = e.target.value + '%'; const c = getClip(APP.selectedClipId); if(c) { c.volume = parseInt(e.target.value); if(c.audioObj) c.audioObj.volume = c.volume / 100; } });

        if (finishBtn) finishBtn.addEventListener('click', finishAndSaveHandler);
        if (closeOverlayBtn) closeOverlayBtn.addEventListener('click', () => overlay.classList.add('hidden'));

        // Handle Close Props Buttons
        document.querySelectorAll('.close-props-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                selectClip(null, null);
                // On mobile, close the sidebar to jump back to main window
                if (window.innerWidth <= 900) {
                    sidebar.classList.remove('open');
                }
            });
        });

        window.addEventListener('keydown', (e) => { if ((e.key === 'Delete' || e.key === 'Backspace') && document.activeElement.tagName === 'BODY' && APP.selectedClipId) { deleteSelectedClip(); } });
    }

    function deleteSelectedClip() {
        if (!APP.selectedClipId) return;
        const clip = getClip(APP.selectedClipId);
        if (clip) { 
            APP.tracks[clip.track] = APP.tracks[clip.track].filter(x => x.id !== clip.id); 
            if (clip.audioObj) { clip.audioObj.pause(); clip.audioObj.src = ''; }
            selectClip(null, null); renderTimelineClips(); renderVideoFrame();
        }
    }

    function updateRatioUI() { if (!videoFrame) return; const r = APP.ratio.split(':'); videoFrame.style.aspectRatio = `${r[0]} / ${r[1]}`; }
    function updateRuler() { const totalPixels = APP.duration * APP.zoom; document.querySelectorAll('.tracks-container, .ruler-container').forEach(el => { el.style.width = `${totalPixels}px`; el.style.minWidth = `${totalPixels}px`; }); const gridBg = `repeating-linear-gradient(90deg, transparent, transparent ${APP.zoom - 1}px, rgba(255,255,255,0.03) ${APP.zoom}px)`; document.querySelectorAll('.track-grid').forEach(el => el.style.background = gridBg); }
    function seekTo(time) { APP.time = Math.max(0, Math.min(APP.duration, time)); updatePlayheadUI(); renderVideoFrame(); if (APP.playing) syncAudioTime(); }
    function updatePlayheadUI() { const px = APP.time * APP.zoom; if (playhead) playhead.style.left = `${px}px`; if (playheadHandle) playheadHandle.style.left = `${px - 8}px`; const ts = (t) => { const m = Math.floor(t / 60).toString().padStart(2, '0'); const s = Math.floor(t % 60).toString().padStart(2, '0'); return `${m}:${s}`; }; if (tlTimeCounter) tlTimeCounter.innerText = `${ts(APP.time)} / ${ts(APP.duration)}`; if (playerTimeDisplay) playerTimeDisplay.innerText = `${ts(APP.time)}.${Math.floor((APP.time % 1) * 10)}`; }
    
    let lastTimestamp = 0;
    function playLoop(timestamp) { if (!APP.playing) return; if (!lastTimestamp) lastTimestamp = timestamp; const dt = (timestamp - lastTimestamp) / 1000; lastTimestamp = timestamp; APP.time += dt; if (APP.time >= APP.duration) { APP.time = APP.duration; togglePlayback(); } updatePlayheadUI(); renderVideoFrame(); requestAnimationFrame(playLoop); }
    function togglePlayback() { APP.playing = !APP.playing; if (tlPlayBtn) tlPlayBtn.innerHTML = APP.playing ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>'; if (APP.playing) { if (APP.time >= APP.duration) APP.time = 0; lastTimestamp = 0; syncAudioPlay(); requestAnimationFrame(playLoop); } else { syncAudioPause(); } }

    function addClip(trackType, start, len, props = {}) { const id = 'clip_' + Math.random().toString(36).substr(2, 9); const clip = { id, track: trackType, start, end: start + len, ...props }; APP.tracks[trackType].push(clip); renderTimelineClips(); selectClip(id, trackType); renderVideoFrame(); }
    function getClip(id) { for(let t in APP.tracks) { const c = APP.tracks[t].find(x => x.id === id); if (c) return c; } return null; }
    function selectClip(id, track) { 
        APP.selectedClipId = id; document.querySelectorAll('.clip-node').forEach(n => n.classList.remove('selected')); if (id) { const el = document.querySelector(`.clip-node[data-id="${id}"]`); if(el) el.classList.add('selected'); }
        document.querySelectorAll('.prop-section').forEach(p => p.classList.remove('active')); 

        if (tlDeleteBtn) tlDeleteBtn.style.display = id ? 'flex' : 'none';

        if (!id) { if(propEmpty) propEmpty.classList.add('active'); return; }
        const clip = getClip(id);
        if (track === 'media') { if(propMedia) propMedia.classList.add('active'); bgType.value = clip.bgType || 'color'; updateMediaInspectorVisibility(); if(bgColorVal) bgColorVal.value = clip.color || '#1a1a2e'; if(bgColorHex) bgColorHex.value = bgColorVal.value; if(bgGrad1) bgGrad1.value = clip.grad1 || '#10b981'; if(bgGrad2) bgGrad2.value = clip.grad2 || '#3b82f6'; if(bgGradAngle) bgGradAngle.value = clip.angle || 135; if(bgFileName) bgFileName.innerText = clip.fileName || ""; } else if (track === 'text') { if(propText) propText.classList.add('active'); textContent.value = clip.text || ''; textFont.value = clip.font || "'Outfit', sans-serif"; textSize.value = clip.size || 36; if(document.getElementById('text-size-val')) document.getElementById('text-size-val').innerText = textSize.value + 'px'; textColor.value = clip.color || "#ffffff"; if(textBgColor) textBgColor.value = clip.bgColor === 'transparent' ? '#000000' : clip.bgColor; textEffect.value = clip.effect || 'none'; 
        updateEffectSettingsVisibility();
        if(effectSpeed) { effectSpeed.value = clip.speed || 5; if(document.getElementById('effect-speed-val')) document.getElementById('effect-speed-val').innerText = effectSpeed.value; }
        btnBold.classList.toggle('active', clip.bold); btnItalic.classList.toggle('active', clip.italic); } else if (track === 'audio') { if(propAudio) propAudio.classList.add('active'); audioFileName.innerText = clip.fileName || ""; audioVol.value = clip.volume || 100; } }

    function updateMediaInspectorVisibility() { if(bgColorGroup) bgColorGroup.style.display = bgType.value === 'color' ? 'flex' : 'none'; if(bgGradGroup) bgGradGroup.style.display = bgType.value === 'gradient' ? 'flex' : 'none'; if(bgUploadGroup) bgUploadGroup.style.display = ['image', 'video'].includes(bgType.value) ? 'flex' : 'none'; }
    function updateEffectSettingsVisibility() { const hasMotion = ['scroll-left', 'scroll-right', 'scroll-up', 'scroll-down', 'marquee-left', 'marquee-right'].includes(textEffect.value); document.getElementById('effect-settings').style.display = hasMotion ? 'block' : 'none'; }
    function handleMediaUpload(e) { const file = e.target.files[0]; if(!file) return; const c = getClip(APP.selectedClipId); if(c) { c.fileName = file.name; if(bgFileName) bgFileName.innerText = file.name; const url = URL.createObjectURL(file); c.srcUrl = url; if (file.type.startsWith('video/')) { c.bgType = 'video'; c.videoObj = document.createElement('video'); c.videoObj.src = url; c.videoObj.muted = true; c.videoObj.loop = true; c.videoObj.playsInline = true; } else { c.bgType = 'image'; c.imgObj = new Image(); c.imgObj.src = url; } updateMediaInspectorVisibility(); renderTimelineClips(); renderVideoFrame(); } }
    function handleAudioUpload(e) { const file = e.target.files[0]; if(!file) return; const c = getClip(APP.selectedClipId); if(c) { c.fileName = file.name; if(audioFileName) audioFileName.innerText = file.name; c.audioObj = new Audio(URL.createObjectURL(file)); c.audioObj.volume = (c.volume || 100) / 100; } }
    function makeClipInteractive(el, clip) { el.addEventListener('mousedown', (e) => { e.preventDefault(); const startX = (e.touches ? e.touches[0].clientX : e.clientX); const initStart = clip.start; const initEnd = clip.end; const isL = e.target.classList.contains('left'); const isR = e.target.classList.contains('right'); const move = (me) => { const dx = ((me.touches ? me.touches[0].clientX : me.clientX) - startX) / APP.zoom; if (isL) clip.start = Math.max(0, Math.min(clip.end - 0.5, initStart + dx)); else if (isR) clip.end = Math.max(clip.start + 0.5, Math.min(APP.duration, initEnd + dx)); else { const dur = initEnd - initStart; clip.start = Math.max(0, Math.min(APP.duration - dur, initStart + dx)); clip.end = clip.start + dur; } el.style.left = `${clip.start * APP.zoom}px`; el.style.width = `${(clip.end - clip.start) * APP.zoom}px`; renderVideoFrame(); }; const stop = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', stop); renderTimelineClips(); }; document.addEventListener('mousemove', move); document.addEventListener('mouseup', stop); e.stopPropagation(); }); }
    function renderTimelineClips() { Object.keys(trackContents).forEach(track => { trackContents[track].innerHTML = ''; APP.tracks[track].forEach(clip => { const el = document.createElement('div'); el.className = `clip-node ${APP.selectedClipId === clip.id ? 'selected' : ''}`; el.style.left = `${clip.start * APP.zoom}px`; el.style.width = `${(clip.end - clip.start) * APP.zoom}px`; el.innerHTML = `<div class="clip-handle left"></div><span class="clip-innerText">${clip.text ? clip.text.split('\n')[0] : (clip.bgType || 'Clip')}</span><div class="clip-handle right"></div>`; el.addEventListener('click', () => selectClip(clip.id, track)); el.setAttribute('data-id', clip.id); makeClipInteractive(el, clip); trackContents[track].appendChild(el); }); }); }

    function renderVideoFrame() {
        const time = APP.time; frameBg.innerHTML = ''; frameObjects.innerHTML = '';
        APP.tracks.media.filter(c => time >= c.start && time <= c.end).forEach(m => { const el = document.createElement('div'); el.className = 'frame-layer'; if (m.bgType === 'color') el.style.backgroundColor = m.color; else if (m.bgType === 'gradient') el.style.background = `linear-gradient(${m.angle}deg, ${m.grad1}, ${m.grad2})`; else if (m.bgType === 'image' && m.srcUrl) { el.style.backgroundImage = `url(${m.srcUrl})`; el.style.backgroundSize = m.objectFit || 'cover'; el.style.backgroundPosition = 'center'; } else if (m.bgType === 'video' && m.videoObj) { m.videoObj.currentTime = time - m.start; m.videoObj.style.width = '100%'; m.videoObj.style.height = '100%'; m.videoObj.style.objectFit = m.objectFit || 'cover'; el.appendChild(m.videoObj); } frameBg.appendChild(el); });
        APP.tracks.text.filter(c => time >= c.start && time <= c.end).forEach(t => { 
            const el = document.createElement('div'); el.className = 'frame-obj-text'; el.innerHTML = t.text; 
            const dt = time - t.start; const spd = t.speed || 5;
            let tx = t.x, ty = t.y; 
            if (t.effect === 'scroll-left') tx -= dt * spd * 10; else if (t.effect === 'scroll-right') tx += dt * spd * 10; else if (t.effect === 'scroll-up') ty -= dt * spd * 10; else if (t.effect === 'scroll-down') ty += dt * spd * 10; else if (t.effect === 'marquee-left') tx = 110 - ((dt * spd * 20) % 120); else if (t.effect === 'marquee-right') tx = -10 + ((dt * spd * 20) % 120);
            el.style.cssText = `left: ${tx}%; top: ${ty}%; font-family: ${t.font}; font-size: ${t.size}px; color: ${t.color}; background-color: ${t.bgColor}; font-weight: ${t.bold ? 'bold' : 'normal'}; font-style: ${t.italic ? 'italic' : 'normal'}; transform: translate(-50%, -50%);`; 
            makeTextDraggable(el, t); frameObjects.appendChild(el); 
        });
    }

    function makeTextDraggable(el, clip) { el.addEventListener('mousedown', (e) => { if(clip.effect && clip.effect.includes('scroll')) return; e.preventDefault(); const sX = (e.touches ? e.touches[0].clientX : e.clientX), sY = (e.touches ? e.touches[0].clientY : e.clientY); const iX = clip.x, iY = clip.y; const mv = (me) => { const rect = frameObjects.getBoundingClientRect(); clip.x = iX + (((me.touches ? me.touches[0].clientX : me.clientX) - sX) / rect.width) * 100; clip.y = iY + (((me.touches ? me.touches[0].clientY : me.clientY) - sY) / rect.height) * 100; el.style.left = `${clip.x}%`; el.style.top = `${clip.y}%`; }; const st = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', st); }; document.addEventListener('mousemove', mv); document.addEventListener('mouseup', st); e.stopPropagation(); }); }
    function syncAudioPlay() { APP.tracks.audio.forEach(a => { if(a.audioObj && APP.time >= a.start && APP.time < a.end) { a.audioObj.currentTime = APP.time - a.start; a.audioObj.play().catch(()=>{}); } }); }
    function syncAudioPause() { APP.tracks.audio.forEach(a => a.audioObj?.pause()); }
    function syncAudioTime() { APP.tracks.audio.forEach(a => { if(a.audioObj) { if(APP.time >= a.start && APP.time < a.end) { if(a.audioObj.paused) a.audioObj.play().catch(()=>{}); const t = APP.time - a.start; if(Math.abs(a.audioObj.currentTime - t) > 0.1) a.audioObj.currentTime = t; } else a.audioObj.pause(); } }); }
    async function finishAndSaveHandler() { if(APP.playing) togglePlayback(); const format = exportFormat.value; overlay.classList.remove('hidden'); progressFill.style.width = '0%'; closeOverlayBtn.classList.add('hidden'); if (format === 'gif') await renderGifHandler(); else await renderVideoHandler(format); if(document.getElementById('generation-text')) document.getElementById('generation-text').innerText = "Project Saved Successfully!"; closeOverlayBtn.classList.remove('hidden'); }
    function renderVideoHandler(userFormat = 'webm') { return new Promise(resolve => { if(document.getElementById('generation-text')) document.getElementById('generation-text').innerText = `Processing HD ${userFormat.toUpperCase()} Video...`; const canvas = document.createElement('canvas'); let cw = 1080, ch = 1920; if(APP.ratio === '16:9') { cw = 1920; ch = 1080; } else if(APP.ratio === '1:1') { cw = 1080; ch = 1080; } canvas.width = cw; canvas.height = ch; const ctx = canvas.getContext('2d'); const stream = canvas.captureStream(30); let recorder; const type = userFormat === 'mp4' ? 'video/mp4' : 'video/webm'; const fallbackTypes = [type, 'video/webm; codecs=vp9', 'video/webm', 'video/mp4']; for(let m of fallbackTypes) { if(MediaRecorder.isTypeSupported(m)) { recorder = new MediaRecorder(stream, { mimeType: m }); break; } } if(!recorder) recorder = new MediaRecorder(stream); const chunks = []; recorder.ondataavailable = e => chunks.push(e.data); recorder.onstop = () => { const blob = new Blob(chunks, { type: recorder.mimeType }); const url = URL.createObjectURL(blob); const actualExt = recorder.mimeType.includes('mp4') ? 'mp4' : 'webm'; const a = document.createElement('a'); a.href = url; a.download = `Project_${Date.now()}.${actualExt}`; a.click(); resolve(); }; recorder.start(); processFrames(canvas, ctx, 30, (p) => { progressFill.style.width = `${p * 100}%`; }).then(() => recorder.stop()); }); }
    function renderGifHandler() { return new Promise(async resolve => { if(document.getElementById('generation-text')) document.getElementById('generation-text').innerText = "Processing GIF Animation..."; const fps = 12; const delay = 1000 / fps; const canvas = document.createElement('canvas'); let cw = 540, ch = 960; if(APP.ratio === '16:9') { cw = 960; ch = 540; } else if(APP.ratio === '1:1') { cw = 600; ch = 600; } canvas.width = cw; canvas.height = ch; const ctx = canvas.getContext('2d'); let workerUrl = 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js'; try { const resp = await fetch(workerUrl); const blob = await resp.blob(); workerUrl = URL.createObjectURL(blob); } catch (e) {} const gif = new GIF({ workers: 2, quality: 10, width: cw, height: ch, workerScript: workerUrl }); await processFrames(canvas, ctx, fps, (p) => { progressFill.style.width = `${p * 50}%`; }, (canv) => gif.addFrame(canv, { copy: true, delay: delay })); if(document.getElementById('generation-text')) document.getElementById('generation-text').innerText = "Compiling GIF..."; gif.on('progress', p => { progressFill.style.width = `${50 + p * 50}%`; }); gif.on('finished', blob => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `Project_${Date.now()}.gif`; a.click(); resolve(); }); gif.render(); }); }
    async function processFrames(canvas, ctx, fps, onProgress, onFrame) { const total = APP.duration * fps; for(let f = 0; f <= total; f++) { const time = f / fps; ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height); APP.tracks.media.filter(c => time >= c.start && time <= c.end).forEach(m => { ctx.save(); if(m.bgType === 'color') { ctx.fillStyle = m.color; ctx.fillRect(0, 0, canvas.width, canvas.height); } else if(m.bgType === 'gradient') { const grd = ctx.createLinearGradient(0, 0, canvas.width, canvas.height); grd.addColorStop(0, m.grad1); grd.addColorStop(1, m.grad2); ctx.fillStyle = grd; ctx.fillRect(0, 0, canvas.width, canvas.height); } else if(m.bgType === 'image' && m.imgObj) { ctx.drawImage(m.imgObj, 0, 0, canvas.width, canvas.height); } else if(m.bgType === 'video' && m.videoObj) { m.videoObj.currentTime = time - m.start; ctx.drawImage(m.videoObj, 0, 0, canvas.width, canvas.height); } ctx.restore(); }); APP.tracks.text.filter(c => time >= c.start && time <= c.end).forEach(t => { ctx.save(); const dt = time - t.start; const spd = t.speed || 5; let txp = t.x, typ = t.y; if (t.effect === 'scroll-left') txp -= dt * spd * 10; else if (t.effect === 'scroll-right') txp += dt * spd * 10; else if (t.effect === 'scroll-up') typ -= dt * spd * 10; else if (t.effect === 'scroll-down') typ += dt * spd * 10; else if (t.effect === 'marquee-left') txp = 110 - ((dt * spd * 20) % 120); else if (t.effect === 'marquee-right') txp = -10 + ((dt * spd * 20) % 120); const tx = (txp / 100) * canvas.width, ty = (typ / 100) * canvas.height; const fS = (t.size / 480) * canvas.height; ctx.font = `${t.bold ? 'bold' : ''} ${t.italic ? 'italic' : ''} ${fS}px ${t.font.split(',')[0].replace(/'/g,'')}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = t.color; t.text.split('\n').forEach((l, i) => { const cleaned = l.replace(/<i\b[^>]*>.*?<\/i>/gi, '★').replace(/<[^>]*>/g, ''); ctx.fillText(cleaned, tx, ty + (i - (t.text.split('\n').length-1)/2)*fS*1.2); }); ctx.restore(); }); if(onFrame) onFrame(canvas); if(onProgress) onProgress(f / total); if(f % 5 === 0) await new Promise(r => requestAnimationFrame(r)); } }

    init();
});
