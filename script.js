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
        designer: {
            bgType: 'solid',
            bgColor: '#6366f1',
            grad1: '#6366f1',
            grad2: '#a855f7',
            angle: 135,
            text: 'DESIGNER TEXT',
            font: "'Outfit'",
            bold: true,
            italic: false,
            underline: false,
            color: '#ffffff',
            bgColorText: '#00000000',
            shadow: 0,
            blur: 0,
            glow: 0,
            ratio: '9:16',
            fontSize: 48,
            wrapText: true,
            image: null,
            filters: {
                brightness: 100,
                contrast: 100,
                sharpness: 0,
                hue: 0,
                sketch: 0
            },
            currentFilter: 'brightness',
            frame: 'square'
        }
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
    const textAnimation = document.getElementById('text-animation');
    const effectSpeed = document.getElementById('effect-speed');
    const btnBold = document.getElementById('btn-bold');
    const btnItalic = document.getElementById('btn-italic');
    const iconButtons = document.querySelectorAll('.icon-insert-btn');

    const audioFileUpload = document.getElementById('audio-file-upload');
    const audioFileName = document.getElementById('audio-file-name');
    const audioVol = document.getElementById('audio-vol');
    const textBgTrans = document.getElementById('text-bg-transparent');
    const textWrap = document.getElementById('text-wrap');

    const dsFontSize = document.getElementById('ds-font-size');
    const dsFontSizeVal = document.getElementById('ds-font-size-val');
    const dsTextWrap = document.getElementById('ds-text-wrap');

    const videoRatioBtn = document.getElementById('video-ratio-btn');
    const timelineDurationInput = document.getElementById('timeline-duration');
    const tlSplitBtn = document.getElementById('tl-split-btn');
    const finishBtn = document.getElementById('finish-and-save-btn');
    const exportFormat = document.getElementById('export-format');
    const overlay = document.getElementById('generation-overlay');
    const progressFill = document.getElementById('progress-fill');
    const closeOverlayBtn = document.getElementById('close-overlay-btn');

    // --- Image Size UI Helpers (module-level so handleMediaUpload can call them) ---
    function updateStudioImgCustomSize() {
        const fitSel = document.getElementById('studio-img-fit');
        const customDiv = document.getElementById('studio-img-custom-size');
        if (fitSel && customDiv) {
            customDiv.style.display = fitSel.value === 'custom' ? 'block' : 'none';
        }
    }

    // --- Initialization ---
    function init() {
        addClip('media', 0, 10, { bgType: 'gradient', grad1: '#10b981', grad2: '#3b82f6', angle: 135 });
        addClip('text', 1, 8, { 
            text: "TEXT TO VIDEO\nSTUDIO PRO", 
            font: "'Outfit', sans-serif", 
            size: 48, color: "#ffffff", bgColor: "transparent", 
            effect: "none", animation: "none", bold: true, italic: false, wrap: true, x: 50, y: 50, speed: 5
        });

        updateRuler();
        updateRatioUI();
        seekTo(0);
        setupEventListeners();
        setupResizers();
    }

    function setupResizers() {
        const resizerX = document.getElementById('resizer-sidebar');
        const resizerY = document.getElementById('resizer-timeline');
        
        let isResizingX = false;
        let isResizingY = false;

        if (resizerX) {
            resizerX.addEventListener('mousedown', (e) => {
                isResizingX = true;
                resizerX.classList.add('active');
                document.body.style.cursor = 'col-resize';
                e.preventDefault();
            });
        }
        
        if (resizerY) {
            resizerY.addEventListener('mousedown', (e) => {
                isResizingY = true;
                resizerY.classList.add('active');
                document.body.style.cursor = 'row-resize';
                e.preventDefault();
            });
        }

        document.addEventListener('mousemove', (e) => {
            if (!isResizingX && !isResizingY) return;
            
            if (isResizingX) {
                // Adjust sidebar width
                const newWidth = (e.clientX / window.innerWidth) * 100;
                if (newWidth > 15 && newWidth < 80) { // Keep bounds between 15% and 80%
                    document.documentElement.style.setProperty('--sidebar-width', newWidth + '%');
                }
            }
            
            if (isResizingY) {
                // Adjust timeline height
                const newHeight = window.innerHeight - e.clientY;
                const minH = 100; // minimum pixels
                const maxH = window.innerHeight * 0.7; // max 70% of screen
                if (newHeight > minH && newHeight < maxH) {
                    document.documentElement.style.setProperty('--timeline-height', newHeight + 'px');
                }
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizingX) {
                isResizingX = false;
                if(resizerX) resizerX.classList.remove('active');
            }
            if (isResizingY) {
                isResizingY = false;
                if(resizerY) resizerY.classList.remove('active');
            }
            document.body.style.cursor = '';
        });
    }

    function setupEventListeners() {
        if (sidebarToggle) sidebarToggle.addEventListener('click', () => {
            if (window.innerWidth > 900) {
                sidebar.classList.toggle('closed');
            } else {
                sidebar.classList.toggle('open');
                document.querySelector('.top-workspace').classList.toggle('menu-open', sidebar.classList.contains('open'));
            }
            
            // If opening and nothing is selected, show the first text clip by default
            if((sidebar.classList.contains('open') || !sidebar.classList.contains('closed')) && !APP.selectedClipId) {
                const firstText = APP.tracks.text[0];
                if(firstText) selectClip(firstText.id, 'text');
            }
        });

        // Theme Toggle Logic
        const themeToggle = document.getElementById('theme-toggle');
        const themeIcon = document.getElementById('theme-icon');
        let isLight = false;
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                isLight = !isLight;
                if (isLight) {
                    document.body.classList.add('light-theme');
                    themeIcon.className = 'fa-solid fa-moon';
                } else {
                    document.body.classList.remove('light-theme');
                    themeIcon.className = 'fa-solid fa-sun';
                }
            });
        }

        if (newProjectBtn) newProjectBtn.addEventListener('click', () => { if(confirm("Start a new project? Unsaved changes will be lost.")) window.location.reload(); });
        if (videoRatioBtn) videoRatioBtn.addEventListener('change', (e) => { APP.ratio = e.target.value; updateRatioUI(); renderVideoFrame(); });
        
        if (tlZoom) tlZoom.addEventListener('input', (e) => { APP.zoom = parseInt(e.target.value); updateRuler(); renderTimelineClips(); updatePlayheadUI(); });
        
        if (timelineDurationInput) timelineDurationInput.addEventListener('change', (e) => {
            const val = parseInt(e.target.value);
            if (val > 0) {
                APP.duration = val;
                updateRuler();
                seekTo(Math.min(APP.time, APP.duration));
                renderTimelineClips();
            } else {
                e.target.value = APP.duration;
            }
        });

        if (tlSplitBtn) tlSplitBtn.addEventListener('click', splitSelectedClip);

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
        
        const safeAddEvent = (id, event, handler) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener(event, handler);
        };

        safeAddEvent('add-media-clip-btn', 'click', () => addClip('media', APP.time, 5, { bgType: 'color', color: '#1a1a2e', objectFit: 'cover' }));
        safeAddEvent('add-text-clip-btn', 'click', () => addClip('text', APP.time, 4, { text: "New Text", font: "'Outfit', sans-serif", size: 36, color: '#ffffff', bgColor: 'transparent', effect: 'none', animation: 'none', speed: 5, wrap: true, x: 50, y: 50 }));
        safeAddEvent('add-audio-clip-btn', 'click', () => addClip('audio', 0, APP.duration, { src: null, volume: 100 }));

        if (tlDeleteBtn) tlDeleteBtn.addEventListener('click', deleteSelectedClip);

        if (bgType) bgType.addEventListener('change', (e) => { const c = getClip(APP.selectedClipId); if(c) { c.bgType = e.target.value; updateMediaInspectorVisibility(); renderVideoFrame(); renderTimelineClips(); } });
        if (bgColorVal) bgColorVal.addEventListener('input', (e) => { const c = getClip(APP.selectedClipId); if(c) { c.color = e.target.value; bgColorHex.value = e.target.value; renderVideoFrame(); } });
        if (bgColorHex) bgColorHex.addEventListener('input', (e) => { const c = getClip(APP.selectedClipId); if(c && /^#[0-9A-F]{3,6}$/i.test(e.target.value)) { c.color = e.target.value; bgColorVal.value = e.target.value; renderVideoFrame(); } });
        if (bgGrad1) bgGrad1.addEventListener('input', (e) => { const c = getClip(APP.selectedClipId); if(c) { c.grad1 = e.target.value; renderVideoFrame(); } });
        if (bgGrad2) bgGrad2.addEventListener('input', (e) => { const c = getClip(APP.selectedClipId); if(c) { c.grad2 = e.target.value; renderVideoFrame(); } });
        if (bgGradAngle) bgGradAngle.addEventListener('input', (e) => { if(document.getElementById('grad-angle-val')) document.getElementById('grad-angle-val').innerText = e.target.value; const c = getClip(APP.selectedClipId); if(c) { c.angle = e.target.value; renderVideoFrame(); } });
        if (bgFileUpload) bgFileUpload.addEventListener('change', handleMediaUpload);
        if (textContent) textContent.addEventListener('input', (e) => { const c = getClip(APP.selectedClipId); if(c) { c.text = e.target.value; renderVideoFrame(); renderTimelineClips(); } });
        if (textFont) textFont.addEventListener('change', (e) => { 
            const c = getClip(APP.selectedClipId); 
            if(c) { 
                const customEl = document.getElementById('text-font-custom');
                if (e.target.value === 'custom') {
                    customEl.style.display = 'block';
                    c.font = customEl.value || "'Outfit'";
                } else {
                    customEl.style.display = 'none';
                    c.font = e.target.value; 
                }
                renderVideoFrame(); 
            } 
        });
        if (document.getElementById('text-font-custom')) document.getElementById('text-font-custom').addEventListener('input', (e) => {
            const c = getClip(APP.selectedClipId);
            if (c && textFont.value === 'custom') {
                c.font = e.target.value;
                renderVideoFrame();
            }
        });
        if (textSize) textSize.addEventListener('input', (e) => { if(document.getElementById('text-size-val')) document.getElementById('text-size-val').innerText = e.target.value + 'px'; const c = getClip(APP.selectedClipId); if(c) { c.size = parseInt(e.target.value); renderVideoFrame(); } });
        if (textColor) textColor.addEventListener('input', (e) => { const c = getClip(APP.selectedClipId); if(c) { c.color = e.target.value; renderVideoFrame(); } });
        if (textBgColor) textBgColor.addEventListener('input', (e) => { const c = getClip(APP.selectedClipId); if(c) { c.bgColor = e.target.value; if(textBgTrans) textBgTrans.checked = false; renderVideoFrame(); } });
        if (textBgTrans) textBgTrans.addEventListener('change', (e) => { const c = getClip(APP.selectedClipId); if(c) { c.bgColor = e.target.checked ? 'transparent' : textBgColor.value; renderVideoFrame(); } });
        if (textWrap) textWrap.addEventListener('change', (e) => { const c = getClip(APP.selectedClipId); if(c) { c.wrap = e.target.checked; renderVideoFrame(); } });
        if (textEffect) textEffect.addEventListener('change', (e) => { const c = getClip(APP.selectedClipId); if(c) { c.effect = e.target.value; updateEffectSettingsVisibility(); renderVideoFrame(); } });
        if (textAnimation) textAnimation.addEventListener('change', (e) => { const c = getClip(APP.selectedClipId); if(c) { c.animation = e.target.value; updateEffectSettingsVisibility(); renderVideoFrame(); } });
        
        const vfxIntensity = document.getElementById('vfx-intensity');
        if (vfxIntensity) vfxIntensity.addEventListener('input', (e) => {
            const c = getClip(APP.selectedClipId);
            if (c) {
                c.intensity = parseInt(e.target.value);
                const valEl = document.getElementById('vfx-intensity-val');
                if (valEl) valEl.innerText = c.intensity;
                renderVideoFrame();
            }
        });

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
                    document.querySelector('.top-workspace').classList.remove('menu-open');
                }
            });
        });

        // --- Core Font Loader Logic ---
        async function loadFontFile(file, isDesigner = false) {
            if (!file) return;
            const fontName = file.name.split('.')[0].replace(/[^a-z0-9]/gi, '_');
            const reader = new FileReader();

            reader.onload = async (e) => {
                const fontBuffer = e.target.result;
                const fontFace = new FontFace(fontName, fontBuffer);
                
                try {
                    const loadedFace = await fontFace.load();
                    document.fonts.add(loadedFace);
                    console.log(`Font loaded: ${fontName}`);
                    
                    // Add to both selects
                    const selects = [document.getElementById('text-font'), document.getElementById('ds-font')];
                    selects.forEach(select => {
                        if (select) {
                            // Check if font already in list
                            let exists = false;
                            for(let i=0; i<select.options.length; i++) if(select.options[i].value === fontName) exists = true;
                            
                            if(!exists) {
                                const opt = document.createElement('option');
                                opt.value = fontName;
                                opt.innerText = `${file.name.split('.')[0]} (Uploaded)`;
                                select.insertBefore(opt, select.querySelector('option[value="custom"]'));
                            }
                            
                            // Select it for the current tab
                            if((isDesigner && select.id === 'ds-font') || (!isDesigner && select.id === 'text-font')) {
                                select.value = fontName;
                            }
                        }
                    });

                    // Update State and Preview
                    if (isDesigner) {
                        APP.designer.font = fontName;
                        renderDesignerPreview();
                    } else {
                        const c = getClip(APP.selectedClipId);
                        if (c) {
                            c.font = fontName;
                            // Hide custom input if it was open
                            const customEl = document.getElementById('text-font-custom');
                            if(customEl) customEl.style.display = 'none';
                            renderVideoFrame();
                        }
                    }
                } catch (err) {
                    console.error("Font loading failed:", err);
                    alert("Failed to load font file. Please check if the file is valid.");
                }
            };
            reader.readAsArrayBuffer(file);
        }

        if (document.getElementById('text-font-upload')) {
            document.getElementById('text-font-upload').addEventListener('change', (e) => loadFontFile(e.target.files[0], false));
        }
        if (document.getElementById('ds-font-upload')) {
            document.getElementById('ds-font-upload').addEventListener('change', (e) => loadFontFile(e.target.files[0], true));
        }

        window.addEventListener('keydown', (e) => { if ((e.key === 'Delete' || e.key === 'Backspace') && document.activeElement.tagName === 'BODY' && APP.selectedClipId) { deleteSelectedClip(); } });

        // Sidebar Toggle & Close logic
        const toggleSidebar = () => {
            if (window.innerWidth > 900) {
                sidebar.classList.toggle('closed');
            } else {
                sidebar.classList.toggle('open');
            }
        };

        if (sidebarToggle) {
            // Already handled above, but keeping for consistency if needed elsewhere
        }
        
        const closeSidebarBtn = document.getElementById('close-sidebar-btn');
        if (closeSidebarBtn) {
            closeSidebarBtn.addEventListener('click', () => {
                sidebar.classList.remove('open');
                sidebar.classList.add('closed');
                document.querySelector('.top-workspace').classList.remove('menu-open');
            });
        }

        // Individual Tab Close Buttons
        document.querySelectorAll('.close-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.innerWidth > 900) {
                    sidebar.classList.add('closed');
                } else {
                    sidebar.classList.remove('open');
                    document.querySelector('.top-workspace').classList.remove('menu-open');
                }
            });
        });

        // --- Sidebar Tab Switching ---
        document.querySelectorAll('.tab-btn').forEach(btn => {
            const handleTabClick = () => {
                const tab = btn.getAttribute('data-tab');
                const appContainer = document.querySelector('.app-container');
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tab}`));

                // Open sidebar if it was closed
                if (window.innerWidth > 900) {
                    sidebar.classList.remove('closed');
                } else {
                    sidebar.classList.add('open');
                    document.querySelector('.top-workspace').classList.add('menu-open');
                }
                
                if (tab === 'designer') {
                    appContainer.classList.add('designer-mode');
                    renderDesignerPreview();
                } else {
                    appContainer.classList.remove('designer-mode');
                    renderVideoFrame();
                }
            };
            btn.addEventListener('click', handleTabClick);
        });

        // --- Merge Tab Logic ---
        const mergeVideoUpload = document.getElementById('merge-video-upload');
        const mergeAudioUpload = document.getElementById('merge-audio-upload');
        const mergeImageUpload = document.getElementById('merge-image-upload');
        const mergeExportBtn = document.getElementById('merge-export-btn');

        if (mergeVideoUpload) {
            mergeVideoUpload.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const url = URL.createObjectURL(file);
                const videoObj = document.createElement('video');
                videoObj.src = url;
                videoObj.muted = true;
                videoObj.loop = true;
                videoObj.playsInline = true;
                videoObj.onloadedmetadata = () => {
                    const dur = Math.min(10, videoObj.duration) || 5;
                    addClip('media', APP.time, dur, { 
                        bgType: 'video', 
                        videoObj: videoObj, 
                        srcUrl: url, 
                        fileName: file.name,
                        objectFit: 'cover'
                    });
                    // Switch to STUDIO tab to show properties
                    document.querySelector('.tab-btn[data-tab="editor"]').click();
                };
            });
        }

        if (mergeAudioUpload) {
            mergeAudioUpload.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const url = URL.createObjectURL(file);
                const audioObj = new Audio(url);
                audioObj.volume = 1;
                audioObj.onloadedmetadata = () => {
                    const dur = audioObj.duration || 10;
                    addClip('audio', APP.time, dur, { 
                        src: url, 
                        audioObj: audioObj, 
                        srcUrl: url,
                        fileName: file.name, 
                        volume: 100 
                    });
                    document.querySelector('.tab-btn[data-tab="editor"]').click();
                };
            });
        }

        if (mergeImageUpload) {
            mergeImageUpload.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const url = URL.createObjectURL(file);
                const isGif = file.type === 'image/gif';
                const imgObj = new Image();
                imgObj.src = url;
                imgObj.onload = () => {
                    const clipId = addClip('media', APP.time, 5, { 
                        bgType: 'image', 
                        imgObj: imgObj, 
                        srcUrl: url, 
                        fileName: file.name,
                        isGif: isGif,
                        objectFit: 'cover',
                        imgFit: 'cover',
                        imgWidth: 100,
                        imgHeight: 100,
                        imgPosX: 50,
                        imgPosY: 50
                    });
                    // Show the merge image size panel
                    const panel = document.getElementById('merge-image-size-panel');
                    if (panel) panel.style.display = 'block';
                    const fitSel = document.getElementById('merge-img-fit');
                    if (fitSel) fitSel.value = 'cover';
                    updateMergeImgCustomSize();
                    document.querySelector('.tab-btn[data-tab="editor"]').click();
                };
            });
        }

        // --- Studio Image Size Panel Listeners ---
        const studioImgFit = document.getElementById('studio-img-fit');
        if (studioImgFit) studioImgFit.addEventListener('change', (e) => {
            const c = getClip(APP.selectedClipId);
            if (c) { c.imgFit = e.target.value; updateStudioImgCustomSize(); renderVideoFrame(); }
        });

        const studioImgWidth = document.getElementById('studio-img-width');
        if (studioImgWidth) studioImgWidth.addEventListener('input', (e) => {
            const c = getClip(APP.selectedClipId);
            if (c) { c.imgWidth = parseInt(e.target.value); document.getElementById('studio-img-w-val').innerText = e.target.value + '%'; renderVideoFrame(); }
        });
        const studioImgHeight = document.getElementById('studio-img-height');
        if (studioImgHeight) studioImgHeight.addEventListener('input', (e) => {
            const c = getClip(APP.selectedClipId);
            if (c) { c.imgHeight = parseInt(e.target.value); document.getElementById('studio-img-h-val').innerText = e.target.value + '%'; renderVideoFrame(); }
        });
        const studioImgX = document.getElementById('studio-img-x');
        if (studioImgX) studioImgX.addEventListener('input', (e) => {
            const c = getClip(APP.selectedClipId);
            if (c) { c.imgPosX = parseInt(e.target.value); document.getElementById('studio-img-x-val').innerText = e.target.value + '%'; renderVideoFrame(); }
        });
        const studioImgY = document.getElementById('studio-img-y');
        if (studioImgY) studioImgY.addEventListener('input', (e) => {
            const c = getClip(APP.selectedClipId);
            if (c) { c.imgPosY = parseInt(e.target.value); document.getElementById('studio-img-y-val').innerText = e.target.value + '%'; renderVideoFrame(); }
        });
        const studioImgSizeBtn = document.getElementById('studio-img-size-btn');
        if (studioImgSizeBtn) studioImgSizeBtn.addEventListener('click', () => {
            // Toggle the custom size panel or just a visual confirm flash
            const customDiv = document.getElementById('studio-img-custom-size');
            const fitSel = document.getElementById('studio-img-fit');
            if (fitSel) fitSel.value = fitSel.value === 'custom' ? 'cover' : 'custom';
            updateStudioImgCustomSize();
            const c = getClip(APP.selectedClipId);
            if (c) { c.imgFit = document.getElementById('studio-img-fit').value; renderVideoFrame(); }
        });

        // --- Merge Image Size Panel Listeners ---
        function updateMergeImgCustomSize() {
            const fitSel = document.getElementById('merge-img-fit');
            const customDiv = document.getElementById('merge-img-custom-size');
            if (fitSel && customDiv) {
                customDiv.style.display = fitSel.value === 'custom' ? 'block' : 'none';
            }
        }

        const mergeImgFit = document.getElementById('merge-img-fit');
        if (mergeImgFit) mergeImgFit.addEventListener('change', (e) => {
            const c = getClip(APP.selectedClipId);
            if (c && c.bgType === 'image') { c.imgFit = e.target.value; updateMergeImgCustomSize(); renderVideoFrame(); }
        });
        const mergeImgWidth = document.getElementById('merge-img-width');
        if (mergeImgWidth) mergeImgWidth.addEventListener('input', (e) => {
            const c = getClip(APP.selectedClipId);
            if (c) { c.imgWidth = parseInt(e.target.value); document.getElementById('merge-img-w-val').innerText = e.target.value + '%'; renderVideoFrame(); }
        });
        const mergeImgHeight = document.getElementById('merge-img-height');
        if (mergeImgHeight) mergeImgHeight.addEventListener('input', (e) => {
            const c = getClip(APP.selectedClipId);
            if (c) { c.imgHeight = parseInt(e.target.value); document.getElementById('merge-img-h-val').innerText = e.target.value + '%'; renderVideoFrame(); }
        });
        const mergeImgX = document.getElementById('merge-img-x');
        if (mergeImgX) mergeImgX.addEventListener('input', (e) => {
            const c = getClip(APP.selectedClipId);
            if (c) { c.imgPosX = parseInt(e.target.value); document.getElementById('merge-img-x-val').innerText = e.target.value + '%'; renderVideoFrame(); }
        });
        const mergeImgY = document.getElementById('merge-img-y');
        if (mergeImgY) mergeImgY.addEventListener('input', (e) => {
            const c = getClip(APP.selectedClipId);
            if (c) { c.imgPosY = parseInt(e.target.value); document.getElementById('merge-img-y-val').innerText = e.target.value + '%'; renderVideoFrame(); }
        });
        const mergeImgApplyBtn = document.getElementById('merge-img-apply-btn');
        if (mergeImgApplyBtn) mergeImgApplyBtn.addEventListener('click', () => {
            renderVideoFrame();
            // Switch to Studio to show live result
            document.querySelector('.tab-btn[data-tab="editor"]').click();
        });

        if (mergeExportBtn) {
            mergeExportBtn.addEventListener('click', () => {
                const formatSelect = document.getElementById('export-format');
                if (formatSelect) {
                    formatSelect.value = 'mp4';
                }
                finishAndSaveHandler();
            });
        }

        // --- Designer Event Listeners ---
        const dsInputs = {
            'ds-bg-type': 'bgType', 'ds-bg-color': 'bgColor', 'ds-bg-grad1': 'grad1', 
            'ds-bg-grad2': 'grad2', 'ds-bg-angle': 'angle', 'ds-text-content': 'text',
            'ds-font': 'font', 'ds-text-color': 'color', 'ds-text-bg': 'bgColorText',
            'ds-fx-shadow': 'shadow', 'ds-fx-blur': 'blur', 'ds-fx-glow': 'glow',
            'ds-font-size': 'fontSize'
        };

        Object.entries(dsInputs).forEach(([id, key]) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', (e) => {
                if (id === 'ds-font') {
                    const customEl = document.getElementById('ds-font-custom');
                    if (e.target.value === 'custom') {
                        customEl.style.display = 'block';
                        APP.designer.font = customEl.value || "'Outfit'";
                    } else {
                        customEl.style.display = 'none';
                        APP.designer[key] = e.target.value;
                    }
                } else {
                    APP.designer[key] = e.target.value;
                }
                
                if (id === 'ds-bg-type') {
                    document.getElementById('ds-bg-solid-ctrl').style.display = e.target.value === 'solid' ? 'flex' : 'none';
                    document.getElementById('ds-bg-grad-ctrl').style.display = e.target.value === 'gradient' ? 'flex' : 'none';
                }
                if (id === 'ds-font-size') {
                    if (dsFontSizeVal) dsFontSizeVal.innerText = `${e.target.value}px`;
                }
                renderDesignerPreview();
            });
        });

        document.querySelectorAll('.frame-sel-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.frame-sel-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                APP.designer.frame = btn.getAttribute('data-frame');
                renderDesignerPreview();
            });
        });

        if (document.getElementById('ds-font-custom')) document.getElementById('ds-font-custom').addEventListener('input', (e) => {
            if (document.getElementById('ds-font').value === 'custom') {
                APP.designer.font = e.target.value;
                renderDesignerPreview();
            }
        });

        if (dsTextWrap) dsTextWrap.addEventListener('change', (e) => {
            APP.designer.wrapText = e.target.checked;
            renderDesignerPreview();
        });

        document.getElementById('ds-btn-bold').addEventListener('click', () => { APP.designer.bold = !APP.designer.bold; document.getElementById('ds-btn-bold').classList.toggle('active', APP.designer.bold); renderDesignerPreview(); });
        document.getElementById('ds-btn-italic').addEventListener('click', () => { APP.designer.italic = !APP.designer.italic; document.getElementById('ds-btn-italic').classList.toggle('active', APP.designer.italic); renderDesignerPreview(); });
        document.getElementById('ds-btn-underline').addEventListener('click', () => { APP.designer.underline = !APP.designer.underline; document.getElementById('ds-btn-underline').classList.toggle('active', APP.designer.underline); renderDesignerPreview(); });

        document.getElementById('ds-image-upload').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                APP.designer.image = URL.createObjectURL(file);
                // Pre-load image object for download
                APP.designer.imgObj = new Image();
                APP.designer.imgObj.src = APP.designer.image;
                renderDesignerPreview();
            }
        });

        // --- Master Adjustment Slider Logic ---
        const masterSlider = document.getElementById('ds-master-slider');
        const masterLabel = document.getElementById('ds-master-label');
        const masterVal = document.getElementById('ds-master-val');

        document.querySelectorAll('.filter-sel-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.getAttribute('data-filter');
                APP.designer.currentFilter = filter;
                
                // Update UI active state
                document.querySelectorAll('.filter-sel-btn').forEach(b => b.classList.toggle('active', b === btn));
                
                // Update Slider based on filter range
                masterLabel.innerText = filter.toUpperCase();
                let min = 0, max = 100, val = APP.designer.filters[filter];
                if (filter === 'brightness' || filter === 'contrast') max = 200;
                else if (filter === 'hue') max = 360;
                
                masterSlider.min = min;
                masterSlider.max = max;
                masterSlider.value = val;
                
                const unit = filter === 'hue' ? 'deg' : (filter === 'sharpness' ? '' : '%');
                masterVal.innerText = val + unit;
            });
        });

        if (masterSlider) {
            masterSlider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value);
                const filter = APP.designer.currentFilter;
                APP.designer.filters[filter] = val;
                
                const unit = filter === 'hue' ? 'deg' : (filter === 'sharpness' ? '' : '%');
                masterVal.innerText = val + unit;
                
                renderDesignerPreview();
            });
        }

        document.querySelectorAll('.ratio-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                APP.designer.ratio = btn.getAttribute('data-ratio');
                updateRatioUI_Designer();
            });
        });

        document.getElementById('ds-download-btn').addEventListener('click', downloadDesignerDesign);
    }

    function updateRatioUI_Designer() {
        const r = APP.designer.ratio.split(':');
        videoFrame.style.aspectRatio = `${r[0]} / ${r[1]}`;
    }

    function renderDesignerPreview() {
        if (document.querySelector('.tab-btn[data-tab="designer"]').classList.contains('active')) {
            frameBg.innerHTML = '';
            frameObjects.innerHTML = '';
            
            const ds = APP.designer;
            const bg = document.createElement('div');
            bg.className = 'frame-layer';
            
            if (ds.bgType === 'solid') {
                bg.style.backgroundColor = ds.bgColor;
            } else {
                bg.style.background = `linear-gradient(${ds.angle}deg, ${ds.grad1}, ${ds.grad2})`;
            }

            if (ds.image) {
                const img = document.createElement('div');
                img.style.position = 'absolute';
                img.style.top = '0'; img.style.left = '0'; img.style.width = '100%'; img.style.height = '100%';
                img.style.backgroundImage = `url(${ds.image})`;
                img.style.backgroundSize = 'cover';
                img.style.backgroundPosition = 'center';
                
                // Apply frame
                img.className = `frame-layer frame-${ds.frame}`;
                if (ds.frame === 'heart') {
                    img.style.width = '200px';
                    img.style.height = '200px';
                    img.style.top = '50%'; img.style.left = '50%';
                    img.style.transform = 'translate(-50%, -50%) scale(2)';
                }
                
                // Apply filters
                let filterStr = `brightness(${ds.filters.brightness}%) contrast(${ds.filters.contrast}%) hue-rotate(${ds.filters.hue}deg)`;
                if (ds.filters.sketch > 0) filterStr += ` grayscale(${ds.filters.sketch}%) contrast(${100 + ds.filters.sketch}%)`;
                if (ds.filters.sharpness > 0) filterStr += ` contrast(${100 + ds.filters.sharpness}%) saturate(${100 + ds.filters.sharpness}%)`;
                img.style.filter = filterStr;
                bg.appendChild(img);
            }
            frameBg.appendChild(bg);

            const txt = document.createElement('div');
            txt.className = 'frame-obj-text';
            txt.innerText = ds.text;
            
            let style = `
                left: 50%; top: 50%; transform: translate(-50%, -50%);
                font-family: ${ds.font}, sans-serif;
                font-size: ${ds.fontSize}px;
                color: ${ds.color};
                background-color: ${ds.bgColorText};
                padding: 15px 30px;
                border-radius: 12px;
                font-weight: ${ds.bold ? 'bold' : 'normal'};
                font-style: ${ds.italic ? 'italic' : 'normal'};
                text-decoration: ${ds.underline ? 'underline' : 'none'};
                text-align: center;
                word-break: break-word;
                white-space: ${ds.wrapText ? 'pre-wrap' : 'nowrap'};
                width: ${ds.wrapText ? '80%' : 'auto'};
                transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            `;

            let shadows = [];
            if (ds.glow > 0) {
                const glowColor = ds.color || '#fff';
                shadows.push(`0 0 ${ds.glow/2}px ${glowColor}`);
                shadows.push(`0 0 ${ds.glow}px ${glowColor}`);
                shadows.push(`0 0 ${ds.glow * 1.5}px ${glowColor}`);
            }
            if (ds.shadow > 0) {
                shadows.push(`${ds.shadow/4}px ${ds.shadow/4}px ${ds.shadow}px rgba(0,0,0,0.8)`);
            }
            if (shadows.length) style += `text-shadow: ${shadows.join(', ')};`;
            
            let filters = [];
            if (ds.blur > 0) filters.push(`blur(${ds.blur}px)`);
            if (filters.length) style += `filter: ${filters.join(' ')};`;

            txt.style.cssText = style;
            frameObjects.appendChild(txt);
        }
    }

    async function downloadDesignerDesign() {
        const ds = APP.designer;
        const canvas = document.createElement('canvas');
        const [rw, rh] = ds.ratio.split(':').map(Number);
        
        // High quality export size base (e.g. 1080p width/height)
        const base = 2000;
        canvas.width = (rw >= rh) ? base : base * (rw / rh);
        canvas.height = (rw >= rh) ? base * (rh / rw) : base;

        const ctx = canvas.getContext('2d');
        const [w, h] = [canvas.width, canvas.height];

        // Frame Clipping Logic for Download
        if (ds.frame && ds.frame !== 'square') {
            ctx.beginPath();
            if (ds.frame === 'circle') {
                ctx.arc(w/2, h/2, Math.min(w, h)/2, 0, Math.PI * 2);
            } else if (ds.frame === 'rounded') {
                const r = Math.min(w, h) * 0.15;
                ctx.roundRect(0, 0, w, h, r);
            } else if (ds.frame === 'hexagon') {
                ctx.moveTo(w * 0.25, 0); ctx.lineTo(w * 0.75, 0); ctx.lineTo(w, h * 0.5); 
                ctx.lineTo(w * 0.75, h); ctx.lineTo(w * 0.25, h); ctx.lineTo(0, h * 0.5); 
                ctx.closePath();
            } else if (ds.frame === 'heart') {
                // Approximate heart shape for canvas
                const top = h * 0.2;
                ctx.moveTo(w * 0.5, h * 0.9);
                ctx.bezierCurveTo(w * 0.2, h * 0.7, 0, h * 0.5, 0, h * 0.3);
                ctx.bezierCurveTo(0, h * 0.1, w * 0.2, 0, w * 0.5, h * 0.2);
                ctx.bezierCurveTo(w * 0.8, 0, w, h * 0.1, w, h * 0.3);
                ctx.bezierCurveTo(w, h * 0.5, w * 0.8, h * 0.7, w * 0.5, h * 0.9);
            }
            ctx.clip();
        }

        // 1. Draw Background
        if (ds.bgType === 'solid') {
            ctx.fillStyle = ds.bgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
            const rad = (ds.angle * Math.PI) / 180;
            const x2 = Math.cos(rad) * canvas.width;
            const y2 = Math.sin(rad) * canvas.height;
            const grd = ctx.createLinearGradient(0, 0, x2, y2);
            grd.addColorStop(0, ds.grad1);
            grd.addColorStop(1, ds.grad2);
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // 2. Draw Image if exists
        if (ds.image && ds.imgObj) {
            ctx.save();
            // Complex part: Drawing image with filters to canvas
            let filterStr = `brightness(${ds.filters.brightness}%) contrast(${ds.filters.contrast}%) hue-rotate(${ds.filters.hue}deg)`;
            if (ds.filters.sketch > 0) filterStr += ` grayscale(${ds.filters.sketch}%) contrast(${100 + ds.filters.sketch}%)`;
            if (ds.filters.sharpness > 0) filterStr += ` contrast(${100 + ds.filters.sharpness}%) saturate(${100 + ds.filters.sharpness}%)`;
            ctx.filter = filterStr;
            
            const iw = ds.imgObj.width, ih = ds.imgObj.height;
            const scale = Math.max(canvas.width / iw, canvas.height / ih);
            const x = (canvas.width - iw * scale) / 2;
            const y = (canvas.height - ih * scale) / 2;
            ctx.drawImage(ds.imgObj, x, y, iw * scale, ih * scale);
            ctx.restore();
        }

        // 3. Draw Text
        ctx.save();
        const fontSize = (ds.fontSize / 480) * canvas.height; // Proportional font size
        const fontName = ds.font.replace(/'/g, '');
        ctx.font = `${ds.bold ? 'bold' : ''} ${ds.italic ? 'italic' : ''} ${fontSize}px ${fontName}, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const tx = canvas.width / 2;
        const ty = canvas.height / 2;

        const words = ds.text.split(' ');
        const lines = [];
        if (ds.wrapText) {
            let currentLine = words[0];
            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const width = ctx.measureText(currentLine + " " + word).width;
                if (width < canvas.width * 0.8) {
                    currentLine += " " + word;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
            lines.push(currentLine);
        } else {
            lines.push(ds.text);
        }

        // Visual effects for export
        let shadows = [];
        if (ds.glow > 0) {
            shadows.push({ blur: ds.glow, color: ds.color });
        }
        if (ds.shadow > 0) {
            shadows.push({ blur: ds.shadow, color: 'rgba(0,0,0,0.8)', ox: ds.shadow/4, oy: ds.shadow/4 });
        }

        if (shadows.length > 0) {
            shadows.forEach(s => {
                ctx.shadowBlur = s.blur * (canvas.height / 500);
                ctx.shadowColor = s.color;
                ctx.shadowOffsetX = (s.ox || 0) * (canvas.height / 500);
                ctx.shadowOffsetY = (s.oy || 0) * (canvas.height / 500);
                ctx.fillStyle = ds.color;
                ctx.fillText(ds.text, tx, ty);
            });
        }

        ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
        if (ds.blur > 0) ctx.filter = `blur(${ds.blur * (canvas.height / 500)}px)`;

        // Draw background box for text if exists
        if (ds.bgColorText !== 'transparent' && ds.bgColorText !== '#00000000') {
            const maxLineWidth = Math.max(...lines.map(l => ctx.measureText(l).width));
            const totalHeight = lines.length * fontSize * 1.2;
            const padding = fontSize * 0.5;
            ctx.fillStyle = ds.bgColorText;
            ctx.fillRect(tx - maxLineWidth/2 - padding, ty - totalHeight/2 - padding, maxLineWidth + padding*2, totalHeight + padding*2);
        }

        ctx.fillStyle = ds.color;
        lines.forEach((line, index) => {
            const lineY = ty + (index - (lines.length - 1) / 2) * fontSize * 1.2;
            if (ds.underline) {
                const metrics = ctx.measureText(line);
                ctx.fillRect(tx - metrics.width/2, lineY + fontSize/2, metrics.width, fontSize * 0.1);
            }
            ctx.fillText(line, tx, lineY);
        });
        ctx.restore();

        // 4. Download Trigger
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `Design_${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
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

    function splitSelectedClip() {
        if (!APP.selectedClipId) return;
        const clip = getClip(APP.selectedClipId);
        if (clip && APP.time > clip.start && APP.time < clip.end) {
            const oldEnd = clip.end;
            const newDuration = APP.time - clip.start;
            
            // Create a duplicate with the same properties but different start/end
            const splitId = 'clip_' + Math.random().toString(36).substr(2, 9);
            const splitClip = JSON.parse(JSON.stringify(clip));
            
            // Note: JSON stringify loses object references (images/audio). We need to copy them manually.
            splitClip.id = splitId;
            splitClip.start = APP.time;
            splitClip.end = oldEnd;
            
            // Update the original clip ending
            clip.end = APP.time;
            
            // For audio/media objects, some extra care is needed but for state-base it's enough.
            // If they are media/audio, clone reference
            if (clip.videoObj) splitClip.videoObj = clip.videoObj;
            if (clip.imgObj) splitClip.imgObj = clip.imgObj;
            if (clip.audioObj) {
                splitClip.audioObj = new Audio(clip.audioObj.src);
                splitClip.audioObj.volume = clip.audioObj.volume;
            }
            
            APP.tracks[clip.track].push(splitClip);
            selectClip(splitId, clip.track);
            renderTimelineClips();
            renderVideoFrame();
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
        if (track === 'media') { 
            if(propMedia) propMedia.classList.add('active'); 
            bgType.value = clip.bgType || 'color'; 
            updateMediaInspectorVisibility(); 
            if(bgColorVal) bgColorVal.value = clip.color || '#1a1a2e'; 
            if(bgColorHex) bgColorHex.value = bgColorVal.value; 
            if(bgGrad1) bgGrad1.value = clip.grad1 || '#10b981'; 
            if(bgGrad2) bgGrad2.value = clip.grad2 || '#3b82f6'; 
            if(bgGradAngle) bgGradAngle.value = clip.angle || 135; 
            if(bgFileName) bgFileName.innerText = clip.fileName || '';
            // Restore image size panel
            const studioSizePanel = document.getElementById('studio-image-size-panel');
            if (studioSizePanel) {
                if (clip.bgType === 'image') {
                    studioSizePanel.style.display = 'block';
                    const fitSel = document.getElementById('studio-img-fit');
                    if (fitSel) fitSel.value = clip.imgFit || 'cover';
                    const wEl = document.getElementById('studio-img-width'); if (wEl) wEl.value = clip.imgWidth || 100;
                    const hEl = document.getElementById('studio-img-height'); if (hEl) hEl.value = clip.imgHeight || 100;
                    const xEl = document.getElementById('studio-img-x'); if (xEl) xEl.value = clip.imgPosX || 50;
                    const yEl = document.getElementById('studio-img-y'); if (yEl) yEl.value = clip.imgPosY || 50;
                    const wV = document.getElementById('studio-img-w-val'); if (wV) wV.innerText = (clip.imgWidth || 100) + '%';
                    const hV = document.getElementById('studio-img-h-val'); if (hV) hV.innerText = (clip.imgHeight || 100) + '%';
                    const xV = document.getElementById('studio-img-x-val'); if (xV) xV.innerText = (clip.imgPosX || 50) + '%';
                    const yV = document.getElementById('studio-img-y-val'); if (yV) yV.innerText = (clip.imgPosY || 50) + '%';
                    updateStudioImgCustomSize();
                } else {
                    studioSizePanel.style.display = 'none';
                }
            }
        } else if (track === 'text') { if(propText) propText.classList.add('active'); textContent.value = clip.text || ''; 
        
        let foundFont = false;
        for (let i = 0; i < textFont.options.length; i++) {
            if (textFont.options[i].value === clip.font) {
                textFont.selectedIndex = i;
                foundFont = true;
                break;
            }
        }
        const customEl = document.getElementById('text-font-custom');
        if (!foundFont && clip.font) {
            textFont.value = 'custom';
            if (customEl) {
                customEl.value = clip.font.replace(/'/g, '');
                customEl.style.display = 'block';
            }
        } else {
            if (customEl) customEl.style.display = 'none';
        }

        textSize.value = clip.size || 36; if(document.getElementById('text-size-val')) document.getElementById('text-size-val').innerText = textSize.value + 'px'; textColor.value = clip.color || "#ffffff";
        if(textBgColor) textBgColor.value = (clip.bgColor === 'transparent' || !clip.bgColor) ? '#000000' : clip.bgColor;
        if(textBgTrans) textBgTrans.checked = clip.bgColor === 'transparent';
        if(textWrap) textWrap.checked = clip.wrap !== false; 
        textEffect.value = clip.effect || 'none'; 
        textAnimation.value = clip.animation || 'none'; 
        updateEffectSettingsVisibility();
        if(effectSpeed) { effectSpeed.value = clip.speed || 5; if(document.getElementById('effect-speed-val')) document.getElementById('effect-speed-val').innerText = effectSpeed.value; }
        btnBold.classList.toggle('active', clip.bold); btnItalic.classList.toggle('active', clip.italic); } else if (track === 'audio') { if(propAudio) propAudio.classList.add('active'); audioFileName.innerText = clip.fileName || ""; audioVol.value = clip.volume || 100; } }

    function updateMediaInspectorVisibility() { if(bgColorGroup) bgColorGroup.style.display = bgType.value === 'color' ? 'flex' : 'none'; if(bgGradGroup) bgGradGroup.style.display = bgType.value === 'gradient' ? 'flex' : 'none'; if(bgUploadGroup) bgUploadGroup.style.display = ['image', 'video'].includes(bgType.value) ? 'flex' : 'none'; }
    function updateEffectSettingsVisibility() { 
        const motionList = ['scroll-left', 'scroll-right', 'scroll-up', 'scroll-down', 'marquee-left', 'marquee-right', 'zoom-in', 'zoom-out', 'unfold-reveal', 'fold-reveal', 'typewriter', 'bounce', 'spin', 'drop', 'wave'];
        const hasMotion = motionList.includes(textAnimation.value) || ['fade-scale', 'staggered-slide'].includes(textEffect.value); 
        const effectSettings = document.getElementById('effect-settings');
        if (effectSettings) effectSettings.style.display = hasMotion ? 'block' : 'none'; 

        const intensityGroup = document.getElementById('vfx-intensity-group');
        const c = getClip(APP.selectedClipId);
        if (intensityGroup && c) {
            const hasIntensity = ['glow', 'shadow', 'outline'].includes(c.effect);
            intensityGroup.style.display = hasIntensity ? 'block' : 'none';
            if (hasIntensity) {
                const label = document.getElementById('vfx-intensity-label');
                const slider = document.getElementById('vfx-intensity');
                const valE = document.getElementById('vfx-intensity-val');
                
                if (c.effect === 'glow') { label.innerText = 'Glow Spread'; slider.max = 50; }
                else if (c.effect === 'shadow') { label.innerText = 'Shadow Distance'; slider.max = 30; }
                else if (c.effect === 'outline') { label.innerText = 'Outline Width'; slider.max = 10; }
                
                slider.value = c.intensity || 10;
                valE.innerText = slider.value;
            }
        }
    }
    function handleMediaUpload(e) { 
        const file = e.target.files[0]; 
        if(!file) return; 
        const c = getClip(APP.selectedClipId); 
        if(c) { 
            c.fileName = file.name; 
            if(bgFileName) bgFileName.innerText = file.name; 
            const url = URL.createObjectURL(file); 
            c.srcUrl = url; 
            if (file.type.startsWith('video/')) { 
                c.bgType = 'video'; 
                c.videoObj = document.createElement('video'); 
                c.videoObj.src = url; 
                c.videoObj.muted = true; 
                c.videoObj.loop = true; 
                c.videoObj.playsInline = true; 
                document.getElementById('studio-image-size-panel').style.display = 'none';
            } else { 
                c.bgType = 'image'; 
                c.imgObj = new Image(); 
                c.imgObj.src = url; 
                // For GIF, also keep the URL for tag-based rendering
                c.isGif = file.type === 'image/gif';
                // Set default image sizing
                if (!c.imgFit) c.imgFit = 'cover';
                if (!c.imgWidth) c.imgWidth = 100;
                if (!c.imgHeight) c.imgHeight = 100;
                if (!c.imgPosX) c.imgPosX = 50;
                if (!c.imgPosY) c.imgPosY = 50;
                // Show image size panel
                const panel = document.getElementById('studio-image-size-panel');
                if (panel) panel.style.display = 'block';
                const fitSel = document.getElementById('studio-img-fit');
                if (fitSel) fitSel.value = c.imgFit || 'cover';
                updateStudioImgCustomSize();
            } 
            updateMediaInspectorVisibility(); 
            renderTimelineClips(); 
            renderVideoFrame(); 
        } 
    }
    function handleAudioUpload(e) { const file = e.target.files[0]; if(!file) return; const c = getClip(APP.selectedClipId); if(c) { c.fileName = file.name; if(audioFileName) audioFileName.innerText = file.name; c.audioObj = new Audio(URL.createObjectURL(file)); c.audioObj.volume = (c.volume || 100) / 100; } }
    function makeClipInteractive(el, clip) { el.addEventListener('mousedown', (e) => { e.preventDefault(); const startX = (e.touches ? e.touches[0].clientX : e.clientX); const initStart = clip.start; const initEnd = clip.end; const isL = e.target.classList.contains('left'); const isR = e.target.classList.contains('right'); const move = (me) => { const dx = ((me.touches ? me.touches[0].clientX : me.clientX) - startX) / APP.zoom; if (isL) clip.start = Math.max(0, Math.min(clip.end - 0.5, initStart + dx)); else if (isR) clip.end = Math.max(clip.start + 0.5, Math.min(APP.duration, initEnd + dx)); else { const dur = initEnd - initStart; clip.start = Math.max(0, Math.min(APP.duration - dur, initStart + dx)); clip.end = clip.start + dur; } el.style.left = `${clip.start * APP.zoom}px`; el.style.width = `${(clip.end - clip.start) * APP.zoom}px`; renderVideoFrame(); }; const stop = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', stop); renderTimelineClips(); }; document.addEventListener('mousemove', move); document.addEventListener('mouseup', stop); e.stopPropagation(); }); }
    function renderTimelineClips() { Object.keys(trackContents).forEach(track => { trackContents[track].innerHTML = ''; APP.tracks[track].forEach(clip => { const el = document.createElement('div'); el.className = `clip-node ${APP.selectedClipId === clip.id ? 'selected' : ''}`; el.style.left = `${clip.start * APP.zoom}px`; el.style.width = `${(clip.end - clip.start) * APP.zoom}px`; el.innerHTML = `<div class="clip-handle left"></div><span class="clip-innerText">${clip.text ? clip.text.split('\n')[0] : (clip.bgType || 'Clip')}</span><div class="clip-handle right"></div>`; el.addEventListener('click', () => selectClip(clip.id, track)); el.setAttribute('data-id', clip.id); makeClipInteractive(el, clip); trackContents[track].appendChild(el); }); }); }

    function renderVideoFrame() {
        if (document.querySelector('.tab-btn[data-tab="designer"]').classList.contains('active')) {
            renderDesignerPreview();
            return;
        }
        const time = APP.time; frameBg.innerHTML = ''; frameObjects.innerHTML = '';
        APP.tracks.media.filter(c => time >= c.start && time <= c.end).forEach(m => { 
            const el = document.createElement('div'); 
            el.className = 'frame-layer'; 
            if (m.bgType === 'color') el.style.backgroundColor = m.color; 
            else if (m.bgType === 'gradient') el.style.background = `linear-gradient(${m.angle}deg, ${m.grad1}, ${m.grad2})`; 
            else if (m.bgType === 'image' && m.srcUrl) { 
                if (m.isGif) {
                    // Use an <img> tag for animated GIF support
                    const gifImg = document.createElement('img');
                    gifImg.src = m.srcUrl;
                    gifImg.style.position = 'absolute';
                    if (!m.imgFit || m.imgFit === 'cover') {
                        gifImg.style.width = '100%';
                        gifImg.style.height = '100%';
                        gifImg.style.objectFit = 'cover';
                        gifImg.style.objectPosition = 'center';
                    } else if (m.imgFit === 'contain') {
                        gifImg.style.width = '100%';
                        gifImg.style.height = '100%';
                        gifImg.style.objectFit = 'contain';
                        gifImg.style.objectPosition = 'center';
                    } else if (m.imgFit === 'fill') {
                        gifImg.style.width = '100%';
                        gifImg.style.height = '100%';
                        gifImg.style.objectFit = 'fill';
                    } else if (m.imgFit === 'custom') {
                        gifImg.style.width = `${m.imgWidth || 100}%`;
                        gifImg.style.height = `${m.imgHeight || 100}%`;
                        gifImg.style.left = `${m.imgPosX || 50}%`;
                        gifImg.style.top = `${m.imgPosY || 50}%`;
                        gifImg.style.transform = 'translate(-50%, -50%)';
                        gifImg.style.objectFit = 'fill';
                    }
                    el.appendChild(gifImg);
                } else if (m.imgFit === 'custom') {
                    el.style.backgroundImage = `url(${m.srcUrl})`;
                    el.style.backgroundSize = `${m.imgWidth || 100}% ${m.imgHeight || 100}%`;
                    el.style.backgroundPosition = `${m.imgPosX || 50}% ${m.imgPosY || 50}%`;
                    el.style.backgroundRepeat = 'no-repeat';
                } else {
                    el.style.backgroundImage = `url(${m.srcUrl})`;
                    el.style.backgroundSize = m.imgFit || m.objectFit || 'cover'; 
                    el.style.backgroundPosition = 'center'; 
                }
            } else if (m.bgType === 'video' && m.videoObj) { 
                m.videoObj.currentTime = time - m.start; 
                m.videoObj.style.width = '100%'; 
                m.videoObj.style.height = '100%'; 
                m.videoObj.style.objectFit = m.objectFit || 'cover'; 
                el.appendChild(m.videoObj); 
            } 
            frameBg.appendChild(el); 
        });
        APP.tracks.text.filter(c => time >= c.start && time <= c.end).forEach(t => { 
            const dt = time - t.start; const spd = t.speed || 5;
            const anim = t.animation || t.effect; // Support legacy clips that used t.effect for motion
            const el = document.createElement('div'); el.className = 'frame-obj-text'; 
            
            let textToDisplay = t.text;
            if (anim === 'typewriter') {
                const chars = Math.floor(dt * spd * 10);
                if (chars < textToDisplay.length) textToDisplay = textToDisplay.substring(0, chars);
            }
            el.innerHTML = textToDisplay;

            let tx = t.x, ty = t.y; 
            if (anim === 'scroll-left') tx -= dt * spd * 10; 
            else if (anim === 'scroll-right') tx += dt * spd * 10; 
            else if (anim === 'scroll-up') ty -= dt * spd * 10; 
            else if (anim === 'scroll-down') ty += dt * spd * 10; 
            else if (anim === 'marquee-left') tx = 110 - (dt * spd * 20); 
            else if (anim === 'marquee-right') tx = -10 + (dt * spd * 20);
            else if (anim === 'drop') ty = (dt < 1) ? ty - (1 - dt)*50 : ty;
            else if (anim === 'wave') ty += Math.sin(dt * spd) * 10;

            // Apply Visual Style Effects
            let styleCss = `left: ${tx}%; top: ${ty}%; font-family: ${t.font}; font-size: ${t.size}px; color: ${t.color}; background-color: ${t.bgColor}; font-weight: ${t.bold ? 'bold' : 'normal'}; font-style: ${t.italic ? 'italic' : 'normal'}; transform: translate(-50%, -50%); white-space: ${t.wrap !== false ? 'pre-wrap' : 'nowrap'}; width: ${t.wrap !== false ? '80%' : 'auto'};`;
            
            let transform = 'translate(-50%, -50%)';
            if (anim === 'zoom-in') {
                const scale = 0.5 + (dt * spd * 0.2); // Start small, grow
                transform += ` scale(${scale})`;
            } else if (anim === 'zoom-out') {
                const scale = Math.max(0.1, 2.0 - (dt * spd * 0.2)); // Start large, shrink
                transform += ` scale(${scale})`;
            } else if (anim === 'unfold-reveal') {
                const reveal = Math.min(1, dt * spd * 0.2);
                styleCss += `clip-path: inset(0% 0% ${100 - (reveal * 100)}% 0%); opacity: ${Math.min(1, reveal * 2)};`;
            } else if (anim === 'fold-reveal') {
                const reveal = Math.min(1, dt * spd * 0.2);
                styleCss += `clip-path: inset(0% ${50 - (reveal * 50)}% 0% ${50 - (reveal * 50)}%); opacity: ${Math.min(1, reveal * 2)};`;
            } else if (anim === 'spin') {
                const angle = dt * spd * 45;
                transform += ` rotate(${angle}deg)`;
            } else if (anim === 'bounce') {
                const bounceY = Math.abs(Math.sin(dt * spd * 2)) * -20;
                transform += ` translateY(${bounceY}px)`;
            }

            styleCss += `transform: ${transform};`;

            const intens = t.intensity || 10;
            if (t.effect === 'glow') {
                styleCss += `text-shadow: 0 0 ${intens/2}px ${t.color}, 0 0 ${intens}px ${t.color}, 0 0 ${intens * 1.5}px ${t.color};`;
            } else if (t.effect === 'shadow') {
                styleCss += `text-shadow: ${intens/2}px ${intens/2}px ${intens}px rgba(0,0,0,0.8);`;
            } else if (t.effect === 'outline') {
                styleCss += `-webkit-text-stroke: ${intens/5}px #000; text-stroke: ${intens/5}px #000;`;
            } else if (t.effect === 'fade-scale') {
                const prog = Math.min(1, dt / 0.5); // 0.5s entrance
                styleCss += `opacity: ${prog}; transform: translate(-50%, -50%) scale(${0.5 + 0.5 * prog});`;
            }
            
            el.style.cssText = styleCss; 
            makeTextDraggable(el, t); frameObjects.appendChild(el); 
        });
    }

    function makeTextDraggable(el, clip) { el.addEventListener('mousedown', (e) => { 
        const anim = clip.animation || clip.effect;
        if(anim && (anim.includes('scroll') || anim.includes('marquee'))) return; 
        e.preventDefault(); const sX = (e.touches ? e.touches[0].clientX : e.clientX), sY = (e.touches ? e.touches[0].clientY : e.clientY); const iX = clip.x, iY = clip.y; const mv = (me) => { const rect = frameObjects.getBoundingClientRect(); clip.x = iX + (((me.touches ? me.touches[0].clientX : me.clientX) - sX) / rect.width) * 100; clip.y = iY + (((me.touches ? me.touches[0].clientY : me.clientY) - sY) / rect.height) * 100; el.style.left = `${clip.x}%`; el.style.top = `${clip.y}%`; }; const st = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', st); }; document.addEventListener('mousemove', mv); document.addEventListener('mouseup', st); e.stopPropagation(); }); }
    function syncAudioPlay() { APP.tracks.audio.forEach(a => { if(a.audioObj && APP.time >= a.start && APP.time < a.end) { a.audioObj.currentTime = APP.time - a.start; a.audioObj.play().catch(()=>{}); } }); }
    function syncAudioPause() { APP.tracks.audio.forEach(a => a.audioObj?.pause()); }
    function syncAudioTime() { APP.tracks.audio.forEach(a => { if(a.audioObj) { if(APP.time >= a.start && APP.time < a.end) { if(a.audioObj.paused) a.audioObj.play().catch(()=>{}); const t = APP.time - a.start; if(Math.abs(a.audioObj.currentTime - t) > 0.1) a.audioObj.currentTime = t; } else a.audioObj.pause(); } }); }
    async function finishAndSaveHandler() { if(APP.playing) togglePlayback(); const format = exportFormat.value; overlay.classList.remove('hidden'); progressFill.style.width = '0%'; closeOverlayBtn.classList.add('hidden'); if (format === 'gif') await renderGifHandler(); else await renderVideoHandler(format); if(document.getElementById('generation-text')) document.getElementById('generation-text').innerText = "Project Saved Successfully!"; closeOverlayBtn.classList.remove('hidden'); }
    function renderVideoHandler(userFormat = 'webm') { return new Promise(resolve => { if(document.getElementById('generation-text')) document.getElementById('generation-text').innerText = `Processing HD ${userFormat.toUpperCase()} Video...`; const canvas = document.createElement('canvas'); let cw = 1080, ch = 1920; if(APP.ratio === '16:9') { cw = 1920; ch = 1080; } else if(APP.ratio === '1:1') { cw = 1080; ch = 1080; } canvas.width = cw; canvas.height = ch; const ctx = canvas.getContext('2d'); const stream = canvas.captureStream(30); let recorder; const type = userFormat === 'mp4' ? 'video/mp4' : 'video/webm'; const fallbackTypes = [type, 'video/webm; codecs=vp9', 'video/webm', 'video/mp4']; for(let m of fallbackTypes) { if(MediaRecorder.isTypeSupported(m)) { recorder = new MediaRecorder(stream, { mimeType: m }); break; } } if(!recorder) recorder = new MediaRecorder(stream); const chunks = []; recorder.ondataavailable = e => chunks.push(e.data); recorder.onstop = () => { const blob = new Blob(chunks, { type: recorder.mimeType }); const url = URL.createObjectURL(blob); const actualExt = recorder.mimeType.includes('mp4') ? 'mp4' : 'webm'; const a = document.createElement('a'); a.href = url; a.download = `Project_${Date.now()}.${actualExt}`; a.click(); resolve(); }; recorder.start(); processFrames(canvas, ctx, 30, (p) => { progressFill.style.width = `${p * 100}%`; }).then(() => recorder.stop()); }); }
    function renderGifHandler() { return new Promise(async resolve => { if(document.getElementById('generation-text')) document.getElementById('generation-text').innerText = "Processing GIF Animation..."; const fps = 12; const delay = 1000 / fps; const canvas = document.createElement('canvas'); let cw = 540, ch = 960; if(APP.ratio === '16:9') { cw = 960; ch = 540; } else if(APP.ratio === '1:1') { cw = 600; ch = 600; } canvas.width = cw; canvas.height = ch; const ctx = canvas.getContext('2d'); let workerUrl = 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js'; try { const resp = await fetch(workerUrl); const blob = await resp.blob(); workerUrl = URL.createObjectURL(blob); } catch (e) {} const gif = new GIF({ workers: 2, quality: 10, width: cw, height: ch, workerScript: workerUrl }); await processFrames(canvas, ctx, fps, (p) => { progressFill.style.width = `${p * 50}%`; }, (canv) => gif.addFrame(canv, { copy: true, delay: delay })); if(document.getElementById('generation-text')) document.getElementById('generation-text').innerText = "Compiling GIF..."; gif.on('progress', p => { progressFill.style.width = `${50 + p * 50}%`; }); gif.on('finished', blob => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `Project_${Date.now()}.gif`; a.click(); resolve(); }); gif.render(); }); }
    async function processFrames(canvas, ctx, fps, onProgress, onFrame) { const total = APP.duration * fps; for(let f = 0; f <= total; f++) { const time = f / fps; ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height); APP.tracks.media.filter(c => time >= c.start && time <= c.end).forEach(m => { ctx.save(); if(m.bgType === 'color') { ctx.fillStyle = m.color; ctx.fillRect(0, 0, canvas.width, canvas.height); } else if(m.bgType === 'gradient') { const grd = ctx.createLinearGradient(0, 0, canvas.width, canvas.height); grd.addColorStop(0, m.grad1); grd.addColorStop(1, m.grad2); ctx.fillStyle = grd; ctx.fillRect(0, 0, canvas.width, canvas.height); } else if(m.bgType === 'image' && m.imgObj) { ctx.drawImage(m.imgObj, 0, 0, canvas.width, canvas.height); } else if(m.bgType === 'video' && m.videoObj) { m.videoObj.currentTime = time - m.start; ctx.drawImage(m.videoObj, 0, 0, canvas.width, canvas.height); } ctx.restore(); }); APP.tracks.text.filter(c => time >= c.start && time <= c.end).forEach(t => { ctx.save(); const dt = time - t.start; const spd = t.speed || 5;
            let txp = t.x, typ = t.y; 
            const anim = t.animation || t.effect;
            if (anim === 'scroll-left') txp -= dt * spd * 10; 
            else if (anim === 'scroll-right') txp += dt * spd * 10; 
            else if (anim === 'scroll-up') typ -= dt * spd * 10; 
            else if (anim === 'scroll-down') typ += dt * spd * 10; 
            else if (anim === 'marquee-left') txp = 110 - (dt * spd * 20); 
            else if (anim === 'marquee-right') txp = -10 + (dt * spd * 20);
            else if (anim === 'drop') typ = (dt < 1) ? typ - (1 - dt)*50 : typ;
            else if (anim === 'wave') typ += Math.sin(dt * spd) * 10;
            const tx = (txp / 100) * canvas.width, ty = (typ / 100) * canvas.height;
            const fS = (t.size / 480) * canvas.height;
            ctx.font = `${t.bold ? 'bold' : ''} ${t.italic ? 'italic' : ''} ${fS}px ${t.font.split(',')[0].replace(/'/g,'')}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Apply Visual Style for Export
            if (anim === 'zoom-in') {
                const scale = 0.5 + (dt * spd * 0.2);
                ctx.translate(tx, ty);
                ctx.scale(scale, scale);
                ctx.translate(-tx, -ty);
            } else if (anim === 'zoom-out') {
                const scale = Math.max(0.1, 2.0 - (dt * spd * 0.2));
                ctx.translate(tx, ty);
                ctx.scale(scale, scale);
                ctx.translate(-tx, -ty);
            } else if (anim === 'unfold-reveal') {
                const reveal = Math.min(1, dt * spd * 0.2);
                ctx.beginPath();
                ctx.rect(0, 0, canvas.width, ty + (reveal * canvas.height * 0.5)); // Simple reveal rect
                ctx.clip();
                ctx.globalAlpha = Math.min(1, reveal * 2);
            } else if (anim === 'fold-reveal') {
                const reveal = Math.min(1, dt * spd * 0.2);
                const rectW = canvas.width * reveal;
                ctx.beginPath();
                ctx.rect((canvas.width - rectW)/2, 0, rectW, canvas.height);
                ctx.clip();
                ctx.globalAlpha = Math.min(1, reveal * 2);
            } else if (anim === 'spin') {
                const angle = (dt * spd * 45) * Math.PI / 180;
                ctx.translate(tx, ty);
                ctx.rotate(angle);
                ctx.translate(-tx, -ty);
            } else if (anim === 'bounce') {
                const bounceY = Math.abs(Math.sin(dt * spd * 2)) * -20;
                ctx.translate(0, bounceY * (canvas.height/500));
            }

            const intens = t.intensity || 10;
            if (t.effect === 'glow') {
                ctx.shadowBlur = intens;
                ctx.shadowColor = t.color;
            } else if (t.effect === 'shadow') {
                ctx.shadowBlur = intens;
                ctx.shadowColor = 'rgba(0,0,0,0.8)';
                ctx.shadowOffsetX = intens/2;
                ctx.shadowOffsetY = intens/2;
            } else if (t.effect === 'fade-scale') {
                ctx.globalAlpha = Math.min(1, dt / 0.5);
            }
            // Outline implementation for canvas
            if (t.effect === 'outline') {
                ctx.strokeStyle = '#000';
                ctx.lineWidth = (fS * 0.05) * (intens / 10);
            }

            ctx.fillStyle = t.color;
            
            let linesToDraw = [];
            let textForExport = t.text;
            if (anim === 'typewriter') {
                const chars = Math.floor(dt * spd * 10);
                if (chars < textForExport.length) textForExport = textForExport.substring(0, chars);
            }
            if (t.wrap !== false) {
                const words = textForExport.split(' ');
                let currentLine = words[0] || '';
                for (let i = 1; i < words.length; i++) {
                    const word = words[i];
                    const width = ctx.measureText(currentLine + " " + word).width;
                    if (width < canvas.width * 0.8) {
                        currentLine += " " + word;
                    } else {
                        linesToDraw.push(currentLine);
                        currentLine = word;
                    }
                }
                linesToDraw.push(currentLine);
            } else {
                linesToDraw = t.text.split('\n');
            }

            linesToDraw.forEach((l, i) => {
                const cleaned = l.replace(/<i\b[^>]*>.*?<\/i>/gi, '★').replace(/<[^>]*>/g, '');
                const lineY = ty + (i - (linesToDraw.length-1)/2)*fS*1.2;
                if (t.effect === 'outline') ctx.strokeText(cleaned, tx, lineY);
                ctx.fillText(cleaned, tx, lineY);
            });
            ctx.restore(); }); if(onFrame) onFrame(canvas); if(onProgress) onProgress(f / total); if(f % 5 === 0) await new Promise(r => requestAnimationFrame(r)); } }

    init();
});
