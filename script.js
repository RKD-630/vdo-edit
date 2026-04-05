document.addEventListener('DOMContentLoaded', () => {
    
    // --- Application State NLE ---
    const APP = {
        zoom: 50, // Pixels per second
        duration: 20, // Total timeline duration in seconds
        time: 0, // Current playhead time 0 -> duration
        playing: false,
        selectedClipId: null,
        tracks: {
            media: [], // Backgrounds/Scenes
            text: [],  // Text Overlays
            audio: []  // Audio layer
        },
        clipboardIcons: [], // To track loaded fonts etc
    };

    // --- DOM Elements ---
    // Top workspace NLE
    const propEmpty = document.getElementById('prop-empty');
    const propMedia = document.getElementById('prop-media');
    const propText = document.getElementById('prop-text');
    const propAudio = document.getElementById('prop-audio');
    const btnDelete = document.getElementById('delete-clip-btn');

    const frameBg = document.getElementById('frame-bg');
    const frameObjects = document.getElementById('frame-objects');
    const videoFrame = document.getElementById('dynamic-video-frame');
    const playerTimeDisplay = document.getElementById('player-time-display');

    // Timeline workspace NLE
    const tlPlayBtn = document.getElementById('tl-play');
    const tlTimeCounter = document.getElementById('tl-time-counter');
    const tlZoom = document.getElementById('tl-zoom');
    
    const playhead = document.getElementById('playhead');
    const trackContents = {
        media: document.getElementById('content-media'),
        text: document.getElementById('content-text'),
        audio: document.getElementById('content-audio')
    };
    const tracksViewport = document.getElementById('tracks-viewport');
    
    // Media Properties NLE
    const bgType = document.getElementById('bg-type');
    const bgColorGroup = document.getElementById('bg-color-group');
    const bgGradGroup = document.getElementById('bg-grad-group');
    const bgUploadGroup = document.getElementById('bg-upload-group');
    const bgColorVal = document.getElementById('bg-color-val');
    const bgGrad1 = document.getElementById('bg-grad-1');
    const bgGrad2 = document.getElementById('bg-grad-2');
    const bgGradAngle = document.getElementById('bg-grad-angle');
    const bgFileUpload = document.getElementById('bg-file-upload');
    const bgFileName = document.getElementById('bg-file-name');

    // Text Properties NLE
    const textContent = document.getElementById('text-content');
    const textFont = document.getElementById('text-font');
    const textSize = document.getElementById('text-size');
    const textColor = document.getElementById('text-color');
    const textBgColor = document.getElementById('text-bg-color');
    const textEffect = document.getElementById('text-effect');
    const btnBold = document.getElementById('btn-bold');
    const btnItalic = document.getElementById('btn-italic');
    const iconButtons = document.querySelectorAll('.icon-insert-btn');

    // Audio Properties NLE
    const audioFileUpload = document.getElementById('audio-file-upload');
    const audioFileName = document.getElementById('audio-file-name');
    const audioVol = document.getElementById('audio-vol');

    // Rendering
    const generateBtnTop = document.getElementById('generate-video-btn');
    const generateBtnBot = document.querySelector('.sidebar-footer #generate-video-btn');
    const overlay = document.getElementById('generation-overlay');
    const progressFill = document.getElementById('progress-fill');
    const downloadVideoBtn = document.getElementById('download-video-btn');
    const closeOverlayBtn = document.getElementById('close-overlay-btn');

    // --- Init ---
    // Add default clips
    addClip('media', 0, 8, { bgType: 'color', color: '#1a1a2e' });
    addClip('text', 1, 6, { 
        text: "T2V Studio NLE\nCinematic Text", 
        font: "'Inter', sans-serif", 
        size: 36, color: "#ffffff", bgColor: "transparent", 
        effect: "none", bold: true, italic: false, x: 50, y: 50 
    });


    updateRuler();
    seekTo(0);

    // --- Timeline Interaction Logic ---
    function updateRuler() {
        const totalPixels = APP.duration * APP.zoom;
        document.querySelectorAll('.tracks-container, .ruler-container').forEach(el => {
            el.style.width = `${totalPixels}px`;
            el.style.minWidth = `${totalPixels}px`;
        });
        // Create repeating tick marks
        const gridBg = `repeating-linear-gradient(90deg, transparent, transparent ${APP.zoom - 1}px, rgba(255,255,255,0.1) ${APP.zoom}px)`;
        document.querySelectorAll('.track-grid').forEach(el => el.style.background = gridBg);
    }

    tlZoom.addEventListener('input', (e) => {
        APP.zoom = parseInt(e.target.value);
        updateRuler();
        renderTimelineClips();
        updatePlayheadUI();
    });

    // Playhead Drag
    let isDraggingPlayhead = false;
    playhead.addEventListener('mousedown', () => isDraggingPlayhead = true);
    document.addEventListener('mouseup', () => isDraggingPlayhead = false);
    
    tracksViewport.addEventListener('mousemove', (e) => {
        if (!isDraggingPlayhead) return;
        const rect = trackContents.media.parentElement.parentElement.getBoundingClientRect(); // .tracks-container
        let x = e.clientX - rect.left;
        let pTime = Math.max(0, Math.min(APP.duration, x / APP.zoom));
        seekTo(pTime);
    });

    tracksViewport.addEventListener('mousedown', (e) => {
        if(e.target.id === 'tl-ruler' || e.target.classList.contains('ruler-container')) {
             const rect = document.querySelector('.tracks-container').getBoundingClientRect();
             let x = e.clientX - rect.left;
             seekTo(Math.max(0, Math.min(APP.duration, x / APP.zoom)));
        }
    });

    function seekTo(time) {
        APP.time = time;
        updatePlayheadUI();
        renderVideoFrame();
    }

    function updatePlayheadUI() {
        const px = APP.time * APP.zoom;
        playhead.style.left = `${px}px`;
        const mins = Math.floor(APP.time / 60).toString().padStart(2, '0');
        const secs = Math.floor(APP.time % 60).toString().padStart(2, '0');
        const d_mins = Math.floor(APP.duration / 60).toString().padStart(2, '0');
        const d_secs = Math.floor(APP.duration % 60).toString().padStart(2, '0');
        tlTimeCounter.innerText = `${mins}:${secs} / ${d_mins}:${d_secs}`;
        playerTimeDisplay.innerText = `${mins}:${secs}.${Math.floor((APP.time%1)*10)}`;
    }

    // Playback
    let animFrame;
    let lastAnimTime;
    tlPlayBtn.addEventListener('click', togglePlayback);

    function togglePlayback() {
        APP.playing = !APP.playing;
        if (APP.playing) {
            tlPlayBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            if (APP.time >= APP.duration) seekTo(0);
            lastAnimTime = performance.now();
            syncAudioPlay();
            animFrame = requestAnimationFrame(playLoop);
        } else {
            tlPlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            syncAudioPause();
            cancelAnimationFrame(animFrame);
        }
    }

    function playLoop(timestamp) {
        if (!APP.playing) return;
        const dt = (timestamp - lastAnimTime) / 1000;
        lastAnimTime = timestamp;
        
        APP.time += dt;
        if (APP.time >= APP.duration) {
            APP.time = APP.duration;
            togglePlayback();
        }
        updatePlayheadUI();
        renderVideoFrame();
        
        if (APP.playing) animFrame = requestAnimationFrame(playLoop);
    }

    // --- Clip Management NLE ---
    function generateId() { return 'clip_' + Math.random().toString(36).substr(2, 9); }

    function addClip(trackType, start, len, props = {}) {
        const id = generateId();
        const clip = { id, track: trackType, start, end: start + len, ...props };
        APP.tracks[trackType].push(clip);
        
        // Handle audio object creation
        if (trackType === 'audio') {
            clip.audioObj = new Audio(props.src);
            clip.audioObj.volume = (props.volume !== undefined) ? props.volume / 100 : 1;
        }

        renderTimelineClips();
        seekTo(APP.time);
        selectClip(id, trackType);
    }

    function getClip(id) {
        for(let track in APP.tracks) {
            let c = APP.tracks[track].find(x => x.id === id);
            if (c) return c;
        }
        return null;
    }

    function renderTimelineClips() {
        for (let track in trackContents) {
            trackContents[track].innerHTML = '';
            APP.tracks[track].forEach(clip => {
                const el = document.createElement('div');
                el.className = `clip-node ${APP.selectedClipId === clip.id ? 'selected' : ''}`;
                el.dataset.id = clip.id;
                el.dataset.track = track;
                el.style.left = `${clip.start * APP.zoom}px`;
                el.style.width = `${(clip.end - clip.start) * APP.zoom}px`;

                let title = 'Clip';
                if(track === 'media') title = clip.bgType === 'color' ? 'Solid Scene' : (clip.bgType === 'gradient' ? 'Gradient Scene' : 'Media Scene');
                if(track === 'text') title = clip.text ? clip.text.split('\n')[0] : 'Text';
                if(track === 'audio') title = 'Audio Track';

                let icon = track === 'media' ? '<i class="fa-solid fa-image"></i>&nbsp;' : 
                          (track === 'text' ? '<i class="fa-solid fa-font"></i>&nbsp;' : '<i class="fa-solid fa-music"></i>&nbsp;');

                el.innerHTML = `
                    ${icon} <span class="clip-innerText">${title}</span>
                    <div class="clip-handle left"></div>
                    <div class="clip-handle right"></div>
                `;

                // Event Listeners for Drag/Resize
                makeClipInteractive(el, clip);
                
                el.addEventListener('mousedown', (e) => {
                    if(!e.target.classList.contains('clip-handle')) selectClip(clip.id, track);
                });

                trackContents[track].appendChild(el);
            });
        }
    }

    function makeClipInteractive(el, clip) {
        let isDragging = false, isResizingLeft = false, isResizingRight = false;
        let startX, initStart, initEnd;

        // Note: Timeline coordinates
        el.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('left')) isResizingLeft = true;
            else if (e.target.classList.contains('right')) isResizingRight = true;
            else isDragging = true;

            startX = e.clientX;
            initStart = clip.start;
            initEnd = clip.end;
            e.stopPropagation(); // prevent playhead jump
            if(!APP.playing) selectClip(clip.id, clip.track);
        });

        document.addEventListener('mousemove', (e) => {
            if(!isDragging && !isResizingLeft && !isResizingRight) return;
            
            const dx = (e.clientX - startX) / APP.zoom; // delta in seconds
            
            if (isDragging) {
                let nStart = initStart + dx;
                let nEnd = initEnd + dx;
                if (nStart < 0) { nStart = 0; nEnd = initEnd - initStart; }
                if (nEnd > APP.duration) { nEnd = APP.duration; nStart = APP.duration - (initEnd - initStart); } // Snap to end
                clip.start = nStart;
                clip.end = nEnd;
            } else if (isResizingLeft) {
                let nStart = initStart + dx;
                if (nStart < 0) nStart = 0;
                if (nStart >= clip.end - 0.5) nStart = clip.end - 0.5; // Min size 0.5s
                clip.start = nStart;
            } else if (isResizingRight) {
                let nEnd = initEnd + dx;
                if (nEnd > APP.duration) nEnd = APP.duration;
                if (nEnd <= clip.start + 0.5) nEnd = clip.start + 0.5;
                clip.end = nEnd;
            }

            el.style.left = `${clip.start * APP.zoom}px`;
            el.style.width = `${(clip.end - clip.start) * APP.zoom}px`;
            
            // Re-render
            if(!APP.playing) renderVideoFrame();
        });

        document.addEventListener('mouseup', () => {
            isDragging = false; isResizingLeft = false; isResizingRight = false;
        });
    }

    // Add buttons
    document.getElementById('add-media-clip-btn').addEventListener('click', () => {
        addClip('media', APP.time, 4, { bgType: 'color', color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0') });
    });
    document.getElementById('add-text-clip-btn').addEventListener('click', () => {
        addClip('text', APP.time, 4, { text: "New Text", font: "'Inter'", size: 30, color: '#fff', bgColor: 'transparent', effect: 'none', x: 50, y: 50 });
    });
    document.getElementById('add-audio-clip-btn').addEventListener('click', () => {
        addClip('audio', 0, APP.duration, { src: null, volume: 100 });
    });

    // Delete
    btnDelete.addEventListener('click', () => {
        if (!APP.selectedClipId) return;
        const clip = getClip(APP.selectedClipId);
        if (clip) {
             APP.tracks[clip.track] = APP.tracks[clip.track].filter(c => c.id !== clip.id);
             if (clip.audioObj) { clip.audioObj.pause(); clip.audioObj.src = ''; }
        }
        selectClip(null, null);
        renderTimelineClips();
        renderVideoFrame();
    });

    // --- Properties Inspector NLE ---
    function selectClip(id, track) {
        APP.selectedClipId = id;
        document.querySelectorAll('.clip-node').forEach(n => n.classList.remove('selected'));
        if (id) {
            const el = document.querySelector(`.clip-node[data-id="${id}"]`);
            if(el) el.classList.add('selected');
        }

        document.querySelectorAll('.prop-section').forEach(p => p.classList.remove('active'));
        btnDelete.style.display = id ? 'block' : 'none';

        if (!id) { propEmpty.classList.add('active'); return; }

        const clip = getClip(id);
        if (!clip) return;

        if (track === 'media') {
            propMedia.classList.add('active');
            bgType.value = clip.bgType || 'color';
            updateMediaInspectorVisibility();
            if(clip.bgType === 'color') bgColorVal.value = clip.color || '#000000';
            if(clip.bgType === 'gradient') {
                bgGrad1.value = clip.grad1 || '#ff0080';
                bgGrad2.value = clip.grad2 || '#7928ca';
                bgGradAngle.value = clip.angle || 135;
                document.getElementById('grad-angle-val').innerText = bgGradAngle.value;
            }
            if(clip.bgType === 'image' || clip.bgType === 'video') {
                bgFileName.innerText = clip.file ? clip.file.name : "No file loaded";
            }
        } 
        else if (track === 'text') {
            propText.classList.add('active');
            textContent.value = clip.text || '';
            textFont.value = clip.font || "'Inter', sans-serif";
            textSize.value = clip.size || 30;
            document.getElementById('text-size-val').innerText = textSize.value;
            textColor.value = rgb2hex(clip.color) || '#ffffff';
            textBgColor.value = clip.bgColor === 'transparent' ? '#000000' : (rgb2hex(clip.bgColor) || '#000000');
            textEffect.value = clip.effect || 'none';
            btnBold.classList.toggle('active', clip.bold);
            btnItalic.classList.toggle('active', clip.italic);
        }
        else if (track === 'audio') {
            propAudio.classList.add('active');
            audioFileName.innerText = clip.file ? clip.file.name : "No file loaded";
            audioVol.value = clip.volume !== undefined ? clip.volume : 100;
            document.getElementById('audio-vol-val').innerText = audioVol.value;
        }
    }

    // Media properties handlers
    function updateMediaInspectorVisibility() {
        bgColorGroup.style.display = bgType.value === 'color' ? 'flex' : 'none';
        bgGradGroup.style.display = bgType.value === 'gradient' ? 'flex' : 'none';
        bgUploadGroup.style.display = (bgType.value === 'image' || bgType.value === 'video') ? 'flex' : 'none';
    }
    bgType.addEventListener('change', (e) => {
        const c = getClip(APP.selectedClipId); if(c) { c.bgType = e.target.value; updateMediaInspectorVisibility(); renderVideoFrame(); renderTimelineClips(); }
    });
    bgColorVal.addEventListener('input', (e) => { const c = getClip(APP.selectedClipId); if(c) { c.color = e.target.value; renderVideoFrame(); } });
    bgGrad1.addEventListener('input', (e) => { const c = getClip(APP.selectedClipId); if(c) { c.grad1 = e.target.value; renderVideoFrame(); } });
    bgGrad2.addEventListener('input', (e) => { const c = getClip(APP.selectedClipId); if(c) { c.grad2 = e.target.value; renderVideoFrame(); } });
    bgGradAngle.addEventListener('input', (e) => { 
        document.getElementById('grad-angle-val').innerText = e.target.value;
        const c = getClip(APP.selectedClipId); if(c) { c.angle = e.target.value; renderVideoFrame(); } 
    });
    bgFileUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const c = getClip(APP.selectedClipId); 
        if(c) { 
            c.file = file; 
            bgFileName.innerText = file.name;
            const url = URL.createObjectURL(file);
            c.srcUrl = url;
            if (file.type.startsWith('video/')) {
                c.bgType = 'video';
                bgType.value = 'video';
                c.videoObj = document.createElement('video');
                c.videoObj.src = url;
                c.videoObj.muted = true;
                c.videoObj.loop = true;
            } else {
                c.bgType = 'image';
                bgType.value = 'image';
            }
            updateMediaInspectorVisibility();
            renderTimelineClips();
            renderVideoFrame();
        }
    });

    // Text Properties handlers
    textContent.addEventListener('input', (e) => { const c = getClip(APP.selectedClipId); if(c) { c.text = e.target.value; renderVideoFrame(); renderTimelineClips(); } });
    textFont.addEventListener('change', (e) => { const c = getClip(APP.selectedClipId); if(c) { c.font = e.target.value; renderVideoFrame(); } });
    textSize.addEventListener('input', (e) => { document.getElementById('text-size-val').innerText = e.target.value; const c = getClip(APP.selectedClipId); if(c) { c.size = e.target.value; renderVideoFrame(); } });
    textColor.addEventListener('input', (e) => { const c = getClip(APP.selectedClipId); if(c) { c.color = e.target.value; renderVideoFrame(); } });
    textBgColor.addEventListener('input', (e) => { const c = getClip(APP.selectedClipId); if(c) { c.bgColor = e.target.value; renderVideoFrame(); } });
    textEffect.addEventListener('change', (e) => { const c = getClip(APP.selectedClipId); if(c) { c.effect = e.target.value; renderVideoFrame(); } });
    btnBold.addEventListener('click', () => { const c = getClip(APP.selectedClipId); if(c) { c.bold = !c.bold; btnBold.classList.toggle('active', c.bold); renderVideoFrame(); } });
    btnItalic.addEventListener('click', () => { const c = getClip(APP.selectedClipId); if(c) { c.italic = !c.italic; btnItalic.classList.toggle('active', c.italic); renderVideoFrame(); } });

    // FontAwesome Icon Inserter NLE
    iconButtons.forEach(btn => {
        btn.addEventListener('click', () => {
             const iconClass = btn.getAttribute('data-icon');
             const c = getClip(APP.selectedClipId);
             if (c) {
                 // Append FontAwesome HTML structure
                 const iconHTML = `<i class="fa-solid ${iconClass}"></i>`;
                 c.text = (c.text || '') + ' ' + iconHTML;
                 textContent.value = c.text;
                 renderVideoFrame();
                 renderTimelineClips();
             }
        });
    });

    // Audio properties
    audioFileUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const c = getClip(APP.selectedClipId);
        if(c) {
            c.file = file;
            audioFileName.innerText = file.name;
            const url = URL.createObjectURL(file);
            c.src = url;
            if(!c.audioObj) c.audioObj = new Audio();
            c.audioObj.src = url;
        }
    });
    audioVol.addEventListener('input', (e) => {
        document.getElementById('audio-vol-val').innerText = e.target.value;
        const c = getClip(APP.selectedClipId);
        if(c) {
            c.volume = parseInt(e.target.value);
            if(c.audioObj) c.audioObj.volume = c.volume / 100;
        }
    });

    // Audio Sync
    function syncAudioPlay() {
        APP.tracks.audio.forEach(aClip => {
            if(aClip.audioObj && aClip.src && APP.time >= aClip.start && APP.time <= aClip.end) {
                // Determine offset
                const offset = APP.time - aClip.start;
                if(aClip.audioObj.readyState >= 2) {
                    aClip.audioObj.currentTime = offset;
                    aClip.audioObj.play().catch(e => console.log('Audio Autoplay policy:', e));
                }
            }
        });
        APP.tracks.media.forEach(mClip => {
             if (mClip.bgType === 'video' && mClip.videoObj && APP.time >= mClip.start && APP.time <= mClip.end) {
                  const offset = APP.time - mClip.start;
                  if(mClip.videoObj.readyState >= 2) {
                      mClip.videoObj.currentTime = offset;
                      mClip.videoObj.play();
                  }
             }
        });
    }
    function syncAudioPause() {
        APP.tracks.audio.forEach(aClip => { if(aClip.audioObj) aClip.audioObj.pause(); });
        APP.tracks.media.forEach(mClip => { if(mClip.bgType === 'video' && mClip.videoObj) mClip.videoObj.pause(); });
    }

    // --- Video Frame Rendering Engine NLE ---

    function getActiveClips(trackItems, time) {
        return trackItems.filter(c => time >= c.start && time <= c.end);
    }

    function renderVideoFrame() {
        // 1. Render Background NLE
        const activeMedia = getActiveClips(APP.tracks.media, APP.time);
        frameBg.innerHTML = '';
        
        if (activeMedia.length > 0) {
            // Take the topmost (last in array)
            const m = activeMedia[activeMedia.length - 1];
            if (m.bgType === 'color') {
                frameBg.style.background = m.color || '#1a1a2e';
            } else if (m.bgType === 'gradient') {
                frameBg.style.background = `linear-gradient(${m.angle || 135}deg, ${m.grad1 || '#ff0080'}, ${m.grad2 || '#7928ca'})`;
            } else if (m.bgType === 'image') {
                frameBg.style.background = `url(${m.srcUrl}) center/cover no-repeat`;
            } else if (m.bgType === 'video') {
                frameBg.style.background = '#000';
                if (m.videoObj) {
                    // Sync video strictly if not playing NLE
                    if (!APP.playing) {
                        m.videoObj.currentTime = APP.time - m.start;
                    }
                    m.videoObj.style.width = '100%';
                    m.videoObj.style.height = '100%';
                    m.videoObj.style.objectFit = 'cover';
                    frameBg.appendChild(m.videoObj);
                }
            }
        } else {
            frameBg.style.background = '#000000'; // Default black NLE NLE
        }

        // 2. Render Text Overlays NLE
        const activeText = getActiveClips(APP.tracks.text, APP.time);
        
        // Remove old texts NLE not active, add active NLE
        // To be safe and handle animations correctly, we can recreate them, 
        // but for editing drag we need to keep references.
        // We will just clear and reconstruct for simplicity.
        frameObjects.innerHTML = '';

        activeText.forEach(t => {
            const el = document.createElement('div');
            el.className = `frame-obj-text effect-${t.effect || 'none'}`;
            if (t.id === APP.selectedClipId) el.classList.add('selected');
            
            // To support FontAwesome HTML NLE
            el.innerHTML = t.text || ' ';
            
            el.style.fontFamily = t.font;
            el.style.fontSize = `${t.size}px`;
            el.style.color = t.color;
            if(t.bgColor !== 'transparent') el.style.backgroundColor = t.bgColor;
            el.style.fontWeight = t.bold ? 'bold' : 'normal';
            el.style.fontStyle = t.italic ? 'italic' : 'normal';
            el.style.left = `${t.x}%`;
            el.style.top = `${t.y}%`;

            // Setup draggable text directly on frame
            makeTextDraggable(el, t);
            
            const resizer = document.createElement('div');
            resizer.className = 'frame-obj-resizer';
            el.appendChild(resizer);

            frameObjects.appendChild(el);

            // CSS Animations handling NLE
            if (t.effect === 'typewriter' && APP.playing) {
                el.classList.add('anim-typewriter');
            } else if (t.effect === 'bounce' && APP.playing) {
                el.classList.add('anim-bounce');
            }
        });

        // 3. Audio logic handled syncAudioPlay NLE
    }

    function makeTextDraggable(el, clip) {
        let isDragging = false, startX, startY, initX, initY;
        
        el.addEventListener('mousedown', (e) => {
            if(e.target.classList.contains('frame-obj-resizer')) return; // Handle resizing here if needed
            isDragging = true;
            startX = e.clientX; startY = e.clientY;
            initX = clip.x; initY = clip.y;
            selectClip(clip.id, clip.track);
            e.stopPropagation();
        });

        document.addEventListener('mousemove', (e) => {
            if(!isDragging) return;
            // Frame is relative to viewport NLE NLE
            const rect = frameObjects.getBoundingClientRect();
            const dx = ((e.clientX - startX) / rect.width) * 100;
            const dy = ((e.clientY - startY) / rect.height) * 100;
            
            clip.x = initX + dx;
            clip.y = initY + dy;
            
            // Re-render
            el.style.left = `${clip.x}%`;
            el.style.top = `${clip.y}%`;
        });

        document.addEventListener('mouseup', () => isDragging = false);
    }


    // --- High Definition Render ---
    const renderVideoHandler = async () => {
        // Pause playback if running NLE
        if(APP.playing) togglePlayback();

        overlay.classList.remove('hidden');
        progressFill.style.width = '0%';
        document.getElementById('generation-text').innerText = "Initializing HD Render Engine...";
        document.querySelector('.spinner').style.display = 'block';
        downloadVideoBtn.classList.add('hidden');
        closeOverlayBtn.classList.add('hidden');

        // Target: 1080x1920 (HD Vertical) NLE NLE
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1920;
        const ctx = canvas.getContext('2d');
        const fps = 30; // Reduced to 30 for stability

        const videoStream = canvas.captureStream(fps);
        let finalTracks = [...videoStream.getVideoTracks()];
        
        // Handling audio is complex when rendering faster than real-time.
        // We will do real-time rendering logic to include Audio Web API cleanly. NLE
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const dest = audioCtx.createMediaStreamDestination();
        
        // Connect all audio objects to dest
        APP.tracks.audio.forEach(a => {
            if(a.audioObj) {
                 const src = audioCtx.createMediaElementSource(a.audioObj);
                 src.connect(dest);
                 src.connect(audioCtx.destination); // For monitoring
            }
        });

        if(dest.stream.getAudioTracks().length > 0) finalTracks.push(...dest.stream.getAudioTracks());
        const combinedStream = new MediaStream(finalTracks);

        let recorder;
        try { recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm; codecs=vp9' }); } 
        catch (e) { recorder = new MediaRecorder(combinedStream); }
        
        const chunks = [];
        recorder.ondataavailable = e => { if(e.data.size > 0) chunks.push(e.data); };
        
        let generatedBlobUrl = null;
        recorder.onstop = () => {
             const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
             generatedBlobUrl = URL.createObjectURL(blob);
             document.getElementById('generation-text').innerText = "HD Render Complete!";
             document.querySelector('.spinner').style.display = 'none';
             downloadVideoBtn.classList.remove('hidden');
             closeOverlayBtn.classList.remove('hidden');
             
             downloadVideoBtn.onclick = () => {
                 const a = document.createElement('a');
                 a.href = generatedBlobUrl;
                 a.download = `T2V_Studio_HD_${Date.now()}.webm`;
                 a.click();
             };
        };

        // Render loop
        // We will render in REAL TIME NLE
        document.getElementById('generation-text').innerText = "Rendering frames...";
        
        recorder.start();
        seekTo(0);
        syncAudioPlay(); // Start audios NLE

        let elapsedTime = 0;
        const frameInterval = 1000 / fps;
        let recording = true;

        async function renderFrameTick() {
            if(!recording) return;

            // Update app time
            seekTo(elapsedTime);
            
            // Capture DOM NLE NLE NLE NLE NLE
            // Use HTML2Canvas for text objects NLE
            try {
                 // Fast drawing backgrounds manually NLE
                 ctx.clearRect(0, 0, canvas.width, canvas.height);
                 
                 const activeMedia = getActiveClips(APP.tracks.media, APP.time);
                 if (activeMedia.length > 0) {
                     const m = activeMedia[activeMedia.length - 1];
                     if (m.bgType === 'color') {
                         ctx.fillStyle = m.color;
                         ctx.fillRect(0,0,canvas.width, canvas.height);
                     } else if(m.bgType === 'gradient') {
                         const grd = ctx.createLinearGradient(0,0, canvas.width, canvas.height);
                         grd.addColorStop(0, m.grad1); grd.addColorStop(1, m.grad2);
                         ctx.fillStyle = grd;
                         ctx.fillRect(0,0,canvas.width, canvas.height);
                     } else if((m.bgType === 'image' || m.bgType === 'video') && m.videoObj) {
                         // Drawing video to canvas NLE
                         // Keep it simple center/crop
                         ctx.drawImage(m.videoObj, 0, 0, canvas.width, canvas.height); 
                     }
                 }

                 // Draw text layer NLE NLE
                 const c = await html2canvas(frameObjects, {
                      scale: 1080 / frameObjects.clientWidth, // Scale up NLE
                      backgroundColor: null,
                      useCORS: true,
                      logging: false
                 });
                 ctx.drawImage(c, 0, 0, canvas.width, canvas.height);

            } catch(e) { console.error("Capture err:", e); }

            elapsedTime += frameInterval / 1000;
            progressFill.style.width = ((elapsedTime / APP.duration) * 100) + '%';

            if (elapsedTime >= APP.duration) {
                recording = false;
                recorder.stop();
                syncAudioPause(); // Stop audio NLE
            } else {
                // Schedule next
                setTimeout(renderFrameTick, frameInterval);
            }
        }

        renderFrameTick();
    };

    [generateBtnTop, generateBtnBot].forEach(btn => { if(btn) btn.addEventListener('click', renderVideoHandler); });

    closeOverlayBtn.addEventListener('click', () => {
        overlay.classList.add('hidden');
    });

    // Utilities
    function rgb2hex(rgb) {
        if(!rgb) return null;
        if(rgb.startsWith('#')) return rgb;
        if(!rgb.startsWith('rgb')) return '#ffffff';
        const a = rgb.split("(")[1].split(")")[0].split(",");
        const r = parseInt(a[0]).toString(16).padStart(2, '0');
        const g = parseInt(a[1]).toString(16).padStart(2, '0');
        const b = parseInt(a[2]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }

});
