const fftCache = new Map();

// --- CHARTS INITIALIZATION ---
function initCharts() {
    const commonOptions = {
        responsive: true, 
        maintainAspectRatio: false, 
        animation: false,
        layout: { padding: { top: 20, right: 10, bottom: 0, left: 0 } },
        plugins: { legend: { display: false } },
        scales: { 
            x: { grid: { color: '#333' }, ticks: { color: '#aaa' } }, 
            y: { grid: { color: '#333' }, ticks: { color: '#aaa' } } 
        }
    };

// Time Chart
const ctxTime = document.getElementById('timeChart').getContext('2d');
appState.charts.time = new Chart(ctxTime, {
    type: 'line',
    data: { 
        labels: [], 
        datasets: [{ 
            label: 'P', 
            data: [], 
            borderColor: '#2196F3', 
            borderWidth: 1, 
            pointRadius: 0 
        }] 
    },
    options: { 
        ...commonOptions, 
        interaction: { mode: 'nearest', intersect: false },
        scales: { 
            x: {
                type: 'linear',
                grid: { color: '#333' },
                ticks: {
                    color: '#aaa',
                    font: {
                        size: 12,
                        weight: 'normal'
                    },
                    callback: function(v) {
                        return (v/1000 < 60) ? (v/1000).toFixed(2)+"s" : (v/1000).toFixed(0)+"s";
                    }
                }
            },
            y: {
                grid: { color: '#333' },
                ticks: {
                    color: '#aaa',
                    font: {
                        size: 12,
                        weight: 'normal'
                    }
                },
                // AJOUT DU TITRE DE L'AXE Y
                title: {
                    display: true,
                    text: 'Pression (Bar)', // Valeur par défaut
                    color: '#aaa',
                    font: {
                        size: 12,
                        weight: 'normal'
                    }
                }
            }
        }
    },
    plugins: [{
        id: 'cursors',
        afterDraw: (chart) => drawCursors(chart)
    }, {
        id: 'annotationConnectors',
        afterDatasetsDraw: (chart) => {
            if (typeof drawAnnotationConnectors === 'function') {
                drawAnnotationConnectors(chart);
            }
            // Mettre à jour les positions des boîtes d'annotation pour qu'elles suivent le graphique
            if (typeof updateAnnotationPositions === 'function') {
                updateAnnotationPositions(chart);
            }
        }
    }, {
        id: 'measureTool',
        afterDraw: (chart) => {
            if (typeof drawMeasurePoints === 'function') {
                drawMeasurePoints(chart);
            }
        }
    }]
});

    // Freq Chart
    const ctxFreq = document.getElementById('freqChart').getContext('2d');
    appState.charts.freq = new Chart(ctxFreq, {
        type: 'line',
        data: { 
            labels: [], 
            datasets: [{ 
                label: 'Amp', 
                data: [], 
                borderColor: '#4CAF50', 
                backgroundColor: 'rgba(76, 175, 80, 0.2)', 
                fill: true, 
                borderWidth: 1, 
                pointRadius: 0 
            }] 
        },
        options: { 
            ...commonOptions, 
            scales: { 
                y: { beginAtZero: true }, 
                x: { 
                    type: 'linear', 
                    min: 0, 
                    grid: { color: '#333' }, 
                    ticks: { color: '#aaa' } 
                } 
            } 
        },
        plugins: [{
            id: 'peakLabels',
            afterDatasetsDraw: (chart) => drawPeaks(chart)
        }]
    });

    // Spectrogram Chart
    const ctxSpectro = document.getElementById('spectroChart').getContext('2d');
    appState.charts.spectro = new Chart(ctxSpectro, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Spectrogram',
                data: [],
                pointRadius: 1,
                pointBackgroundColor: []
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: 'Temps (s)', color: '#aaa' },
                    grid: { color: '#333' },
                    ticks: { color: '#aaa' }
                },
                y: {
                    type: 'linear',
                    title: { display: true, text: 'Fréquence (Hz)', color: '#aaa' },
                    grid: { color: '#333' },
                    ticks: { color: '#aaa' }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `T: ${context.parsed.x.toFixed(2)}s, F: ${context.parsed.y.toFixed(1)}Hz, A: ${context.raw.v.toFixed(3)}`;
                        }
                    }
                }
            }
        }
    });
}

// --- RESIZERS ---
function setupResizers() {
    setupResizer('resizer1', 'time-container');
    setupResizer('resizer2', 'freq-container');
}

function setupResizer(resizerId, panelId) {
    const resizer = document.getElementById(resizerId);
    const panel = document.getElementById(panelId);
    let isResizing = false;
    let startY, startHeight;

    resizer.addEventListener('mousedown', function(e) {
        isResizing = true;
        startY = e.clientY;
        startHeight = parseInt(document.defaultView.getComputedStyle(panel).height, 10);
        document.body.style.cursor = 'ns-resize';
        e.preventDefault();
    });

    document.addEventListener('mousemove', function(e) {
        if (!isResizing) return;
        
        const dy = e.clientY - startY;
        const newHeight = startHeight + dy;
        
        // Limiter la hauteur minimale et maximale
        if (newHeight > 100 && newHeight < window.innerHeight - 200) {
            panel.style.height = newHeight + 'px';
            
            // Redimensionner les graphiques après un petit délai
            setTimeout(() => {
                if (appState.charts.time) appState.charts.time.resize();
                if (appState.charts.freq) appState.charts.freq.resize();
                if (appState.charts.spectro) appState.charts.spectro.resize();
            }, 10);
        }
    });

    document.addEventListener('mouseup', function() {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = 'default';
        }
    });
}

// --- DRAWING HELPERS ---
function drawCursors(chart) {
    if (!appState.fullDataTime.length) return;

    // Ne pas afficher les curseurs si le graphique fréquentiel est masqué
    if (typeof uiState !== 'undefined' && !uiState.freqVisible) return;

    const ctx = chart.ctx;
    const xAxis = chart.scales.x;
    const yAxis = chart.scales.y;

    const xStart = xAxis.getPixelForValue(appState.cursorStart * 1000);
    const xEnd = xAxis.getPixelForValue(appState.cursorEnd * 1000);

    ctx.save();
    
    // Zone de sélection
    ctx.fillStyle = 'rgba(76, 175, 80, 0.1)';
    ctx.fillRect(xStart, yAxis.top, xEnd - xStart, yAxis.bottom - yAxis.top);
    
    // Curseur vert (début) - ligne plus épaisse
    ctx.beginPath();
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]); // Pointillés plus espacés
    ctx.moveTo(xStart, yAxis.top);
    ctx.lineTo(xStart, yAxis.bottom);
    ctx.stroke();
    
    // Curseur rouge (fin) - ligne plus épaisse
    ctx.beginPath();
    ctx.strokeStyle = '#f44336';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]); // Pointillés plus espacés
    ctx.moveTo(xEnd, yAxis.top);
    ctx.lineTo(xEnd, yAxis.bottom);
    ctx.stroke();
    
    ctx.restore();
}

function drawPeaks(chart) {
    const ctx = chart.ctx;
    const xAxis = chart.scales.x;
    const yAxis = chart.scales.y;

    ctx.save();
    ctx.textAlign = 'center';
    const theme = document.body.getAttribute('data-theme');
    ctx.fillStyle = theme === 'light' ? '#000000' : (theme === 'steampunk' ? '#d4af37' : '#e0e0e0');
    ctx.font = 'bold 12px sans-serif';

    const threshold = parseInt(document.getElementById('peak-threshold').value);
    if(!chart.data.datasets[0].data.length) return;
    
    let maxAmp = 0;
    const data = chart.data.datasets[0].data;
    for(let i=0; i<data.length; i++) if(data[i].y > maxAmp) maxAmp = data[i].y;

    const limit = maxAmp * (100 - threshold) / 100;

    appState.allPeaks.forEach(peak => {
        if (peak.amp > limit) {
            const x = xAxis.getPixelForValue(peak.freq);
            const y = yAxis.getPixelForValue(peak.amp);
            const yPos = Math.max(y - 5, 12); 
            if(x >= xAxis.left && x <= xAxis.right) {
                ctx.fillText(`${peak.freq.toFixed(1)}Hz`, x, yPos);
            }
        }
    });
    ctx.restore();
}

// --- INTERACTIONS ---
function setupCanvasInteractions() {
    const canvas = document.getElementById('timeChart');
    const freqCanvas = document.getElementById('freqChart');

    // Gestion du zoom avec la molette (existant)
    canvas.addEventListener('wheel', (e) => { 
        e.preventDefault(); 
        handleZoom(appState.charts.time, e); 
    });
    
    freqCanvas.addEventListener('wheel', (e) => { 
        e.preventDefault(); 
        handleFreqZoom(appState.charts.freq, e); 
    });

// Gestion du clic souris
canvas.addEventListener('mousedown', (e) => {
    const chart = appState.charts.time;

    // Priorité 1: Outil de déplacement
    if (typeof handlePanClick === 'function') {
        if (handlePanClick(e, chart)) {
            return; // L'outil de déplacement a géré le clic
        }
    }

    // Priorité 2: Outil de mesure
    if (typeof handleMeasureClick === 'function') {
        if (handleMeasureClick(e, chart)) {
            return; // L'outil de mesure a géré le clic
        }
    }

    const rect = canvas.getBoundingClientRect();
    const xPixel = e.clientX - rect.left; // Position X en pixels
    const yPixel = e.clientY - rect.top;  // Position Y en pixels

    // Tolérance en pixels - ajustable selon vos préférences
    const pixelTol = 120; // 12 pixels de tolérance (plus facile à cliquer)

    // Vérifier si on est dans la zone Y du graphique
    const chartTop = chart.scales.y.top;
    const chartBottom = chart.scales.y.bottom;
    const isInChartY = yPixel >= chartTop && yPixel <= chartBottom;

    if (!isInChartY) return; // Ignorer les clics en dehors du graphique verticalement
    
    // Calculer les positions des curseurs en pixels
    const cursorStartPixel = chart.scales.x.getPixelForValue(appState.cursorStart * 1000);
    const cursorEndPixel = chart.scales.x.getPixelForValue(appState.cursorEnd * 1000);
    
    // Distances en pixels aux curseurs
    const distToStartPx = Math.abs(xPixel - cursorStartPixel);
    const distToEndPx = Math.abs(xPixel - cursorEndPixel);

    if (e.shiftKey) {
        // Shift + clic entre curseurs → déplacer les 2 curseurs
        const isBetweenCursors = xPixel > cursorStartPixel && xPixel < cursorEndPixel;
        
        if (isBetweenCursors) {
            appState.isDragging = true;
            appState.dragTarget = 'both';
            appState.dragStartX = e.clientX;
            appState.dragStartCursorStart = appState.cursorStart;
            appState.dragStartCursorEnd = appState.cursorEnd;
        }
        // Shift + clic ailleurs → PAN (déplacement de la vue)
        else {
            appState.isDragging = true;
            appState.dragTarget = 'pan';
            appState.lastX = e.clientX;
            appState.lastY = e.clientY;
        }
    } else {
        // Sans Shift → seulement déplacer les curseurs individuels
        // Vérifier la proximité avec la tolérance en pixels
        if (distToStartPx <= pixelTol && distToStartPx <= distToEndPx) { 
            appState.isDragging = true; 
            appState.dragTarget = 'start'; 
            console.log("Attrapé curseur début", {distToStartPx, pixelTol});
        }
        else if (distToEndPx <= pixelTol && distToEndPx <= distToStartPx) { 
            appState.isDragging = true; 
            appState.dragTarget = 'end'; 
            console.log("Attrapé curseur fin", {distToEndPx, pixelTol});
        }
        // Si on ne clique pas assez près d'un curseur, ne rien faire
        // (le pan sans Shift n'est plus possible)
    }
});

    // Gestion du déplacement souris
    canvas.addEventListener('mousemove', (e) => {
        const chart = appState.charts.time;

        // Priorité 1: Gérer le drag de l'outil de déplacement
        if (typeof handlePanDrag === 'function') {
            if (handlePanDrag(e, chart, canvas)) {
                return; // L'outil de déplacement a géré le mouvement
            }
        }

        // Priorité 2: Gérer le drag de l'outil de mesure
        if (typeof handleMeasureDrag === 'function') {
            if (handleMeasureDrag(e, chart)) {
                return; // L'outil de mesure a géré le mouvement
            }
        }

        if (!appState.isDragging) return;
        const rect = canvas.getBoundingClientRect();
        
        if (appState.dragTarget === 'pan') {
            const dx = e.clientX - appState.lastX;
            const dy = e.clientY - appState.lastY;

            // Déplacement horizontal
            const dxVal = (chart.scales.x.max - chart.scales.x.min) * (dx / canvas.width);
            chart.options.scales.x.min -= dxVal;
            chart.options.scales.x.max -= dxVal;

            // Déplacement vertical sur TOUTES les échelles Y
            Object.keys(chart.scales).forEach(scaleKey => {
                if (scaleKey.startsWith('y')) {
                    const scale = chart.scales[scaleKey];
                    const dyVal = (scale.max - scale.min) * (dy / canvas.height);
                    chart.options.scales[scaleKey].min += dyVal;
                    chart.options.scales[scaleKey].max += dyVal;
                }
            });

            appState.lastX = e.clientX;
            appState.lastY = e.clientY;
            chart.update('none');

            // Mise à jour immédiate des champs de zoom
            updateZoomInputs();
        }
        else if (appState.dragTarget === 'both') {
            const dx = e.clientX - appState.dragStartX;
            const dxVal = (chart.scales.x.max - chart.scales.x.min) * (dx / canvas.width) / 1000;
            
            const newStart = appState.dragStartCursorStart + dxVal;
            const newEnd = appState.dragStartCursorEnd + dxVal;
            
            const maxTime = appState.fullDataTime[appState.fullDataTime.length-1] / 1000;
            if (newStart >= 0 && newEnd <= maxTime) {
                appState.cursorStart = newStart;
                appState.cursorEnd = newEnd;
                updateStats();
                chart.update('none');
                
                // Mettre à jour l'analyse FFT en temps réel
                if(!appState.fftTimeout) {
                    appState.fftTimeout = setTimeout(() => { 
                        performAnalysis(); 
                        appState.fftTimeout = null; 
                    }, 50);
                }
            }
        }
        else {
            let newVal = chart.scales.x.getValueForPixel(e.clientX - rect.left) / 1000;
            newVal = Math.max(0, Math.min(newVal, appState.fullDataTime[appState.fullDataTime.length-1]/1000));
            
            const minGap = 0.01;
            
            if (appState.dragTarget === 'start') {
                newVal = Math.min(newVal, appState.cursorEnd - minGap);
                appState.cursorStart = newVal;
            }
            else if (appState.dragTarget === 'end') {
                newVal = Math.max(newVal, appState.cursorStart + minGap);
                appState.cursorEnd = newVal;
            }
            
            updateStats();
            chart.update('none');
            
            // ⚡ CORRECTION : Remettre le timeout FFT pour les curseurs individuels
            if(!appState.fftTimeout) {
                appState.fftTimeout = setTimeout(() => { 
                    performAnalysis(); 
                    appState.fftTimeout = null; 
                }, 50);
            }
        }
    });

    // Gestion du relâchement souris (existant)
    window.addEventListener('mouseup', () => {
        // Priorité 1: Gérer le relâchement de l'outil de déplacement
        if (typeof handlePanMouseUp === 'function') {
            handlePanMouseUp();
        }

        // Priorité 2: Gérer le relâchement de l'outil de mesure
        if (typeof handleMeasureMouseUp === 'function') {
            handleMeasureMouseUp();
        }

        if(appState.isDragging) {
            appState.isDragging = false;
            appState.dragTarget = null;
            // Mise à jour finale des champs de zoom
            updateZoomInputs();
        }
    });
}

function handleZoom(chart, e) {
    const zoomFactor = 1.1;
    const direction = e.deltaY > 0 ? 1 : -1;
    const rangeX = chart.scales.x.max - chart.scales.x.min;
    const centerX = (chart.scales.x.min + chart.scales.x.max) / 2;

    const zoomX = !e.ctrlKey;
    const zoomY = !e.shiftKey;

    if (zoomX) {
        const newRangeX = direction > 0 ? rangeX * zoomFactor : rangeX / zoomFactor;
        if(newRangeX > 0.000001) {
            chart.options.scales.x.min = centerX - newRangeX / 2;
            chart.options.scales.x.max = centerX + newRangeX / 2;
        }
    }

    if (zoomY) {
        // Zoomer sur TOUTES les échelles Y (y, y0, y1, y2...)
        Object.keys(chart.scales).forEach(scaleKey => {
            if (scaleKey.startsWith('y')) {
                const scale = chart.scales[scaleKey];
                const rangeY = scale.max - scale.min;
                const centerY = (scale.min + scale.max) / 2;
                const newRangeY = direction > 0 ? rangeY * zoomFactor : rangeY / zoomFactor;

                if(newRangeY > 0.000001) {
                    chart.options.scales[scaleKey].min = centerY - newRangeY / 2;
                    chart.options.scales[scaleKey].max = centerY + newRangeY / 2;
                }
            }
        });
    }

    chart.update('none');

    // METTRE À JOUR LES CHAMPS DE ZOOM APRÈS CHAQUE ZOOM
    setTimeout(updateZoomInputs, 10);
}
function handleFreqZoom(chart, e) {
    const zoomFactor = 1.1;
    const direction = e.deltaY > 0 ? 1 : -1;
    const currentMax = chart.scales.x.max;
    const newMax = direction > 0 ? currentMax * zoomFactor : currentMax / zoomFactor;
    
    if(newMax > 1) {
        chart.options.scales.x.min = 0;
        chart.options.scales.x.max = newMax;
        chart.update('none');
    }
}

// --- CHART DATA UPDATES ---
function updateTimeChart() {
    // Essayer le mode multi-canaux d'abord
    if (typeof updateTimeChartMultiChannel === 'function') {
        const multiChannelSuccess = updateTimeChartMultiChannel();
        if (multiChannelSuccess) {
            // Mode multi-canaux utilisé avec succès
            document.getElementById('display-n').textContent = appState.fullDataTime.length;
            setTimeout(updateZoomInputs, 10);
            return;
        }
    }

    // Sinon, utiliser le mode simple (un seul canal)
    const chart = appState.charts.time;
    let t = appState.fullDataTime;
    let v = appState.fullDataPressure;
    if(t.length > 15000) {
        const step = Math.ceil(t.length/15000);
        t = t.filter((_,i)=>i%step===0);
        v = v.filter((_,i)=>i%step===0);
    }
    chart.data.labels = Array.from(t);
    chart.data.datasets[0].data = Array.from(v);

    // Réinitialiser les échelles X et Y
    chart.options.scales.x.min = t[0];
    chart.options.scales.x.max = t[t.length-1];

    // Calculer les limites Y automatiquement
    const minY = Math.min(...v);
    const maxY = Math.max(...v);
    const rangeY = maxY - minY;
    chart.options.scales.y.min = minY - rangeY * 0.1;
    chart.options.scales.y.max = maxY + rangeY * 0.1;

    // METTRE À JOUR LE LABEL DE L'AXE Y SI DISPONIBLE
    if (appState.yAxisLabel) {
        chart.options.scales.y.title.text = appState.yAxisLabel;
    }

    chart.update();
    document.getElementById('display-n').textContent = appState.fullDataTime.length;

    // Mettre à jour les champs de zoom
    setTimeout(updateZoomInputs, 10);

    // ✅ NOUVEAU : Mettre à jour les annotations
    if (typeof updateAnnotationsDisplay === 'function') {
        setTimeout(updateAnnotationsDisplay, 50);
    }
}
function updateStats() {
    const t = appState.fullDataTime;
    const v = appState.fullDataPressure;
    const i1 = t.findIndex(val => val >= appState.cursorStart*1000);
    let i2 = t.findIndex(val => val >= appState.cursorEnd*1000);
    if(i2 === -1) i2 = t.length;
    if(i1 >= i2) return;
    
    const slice = v.slice(i1, i2);
    let min=Infinity, max=-Infinity, sum=0, sqSum=0;
    for(let x of slice) {
        if(x<min) min=x;
        if(x>max) max=x;
        sum+=x;
        sqSum+=x*x;
    }
    const mean = sum/slice.length;
    const rms = Math.sqrt(sqSum/slice.length);
    const std = Math.sqrt(slice.reduce((a,b)=>a+(b-mean)**2,0)/slice.length);

    document.getElementById('stat-min').textContent = min.toFixed(2);
    document.getElementById('stat-max').textContent = max.toFixed(2);
    document.getElementById('stat-mean').textContent = mean.toFixed(2);
    document.getElementById('stat-std').textContent = std.toFixed(2);
 document.getElementById('res-rms').textContent = rms.toFixed(1) + " " + appState.yAxisLabel;
}

// Fonction helper pour calculer la FFT d'un canal
function computeFFTForChannel(raw, N, win, res) {
    const mean = raw.reduce((a,b)=>a+b,0)/raw.length;

    const input = new Float32Array(N);
    for(let i=0; i<N; i++) {
        if(i<raw.length) {
            let w = 1;
            if(win==='hanning') w=0.5*(1-Math.cos(2*Math.PI*i/(raw.length-1)));
            else if(win==='hamming') w=0.54-0.46*Math.cos(2*Math.PI*i/(raw.length-1));
            else if(win==='blackman') w=0.42-0.5*Math.cos(2*Math.PI*i/(raw.length-1))+0.08*Math.cos(4*Math.PI*i/(raw.length-1));
            input[i] = (raw[i]-mean)*w;
        }
    }

    const re = new Float32Array(input);
    const im = new Float32Array(N).fill(0);

    // FFT
    let j=0;
    for(let i=0; i<N; i++) {
        if(i<j) { [re[i],re[j]]=[re[j],re[i]]; [im[i],im[j]]=[im[j],im[i]]; }
        let m=N>>1; while(j>=m && m>0){ j-=m; m>>=1; } j+=m;
    }
    for(let m=2; m<=N; m<<=1) {
        let wr = Math.cos(-2*Math.PI/m);
        let wi = Math.sin(-2*Math.PI/m);
        for(let k=0; k<N; k+=m) {
            let w_r=1, w_i=0;
            for(let j=0; j<m/2; j++) {
                let tr=w_r*re[k+j+m/2]-w_i*im[k+j+m/2];
                let ti=w_r*im[k+j+m/2]+w_i*re[k+j+m/2];
                re[k+j+m/2]=re[k+j]-tr; im[k+j+m/2]=im[k+j]-ti;
                re[k+j]+=tr; im[k+j]+=ti;
                let temp=w_r*wr-w_i*wi; w_i=w_r*wi+w_i*wr; w_r=temp;
            }
        }
    }

    const mags = [];
    const peaks = [];
    let maxV=0, maxI=0;

    for(let i=0; i<N/2; i++) {
        const mag = 2*Math.sqrt(re[i]**2 + im[i]**2)/raw.length;
        mags.push({x: i*res, y: mag});
        if(i>1 && mag > mags[i-1].y) {
            if(mag > maxV) { maxV=mag; maxI=i; }
        }
    }

    for(let i=1; i<mags.length-1; i++) {
        if(mags[i].y > mags[i-1].y && mags[i].y > mags[i+1].y) {
            peaks.push({freq: mags[i].x, amp: mags[i].y});
        }
    }

    return {
        mags,
        peaks,
        peakFreq: maxI*res,
        peakAmp: maxV
    };
}

function performAnalysis() {
    console.log("📊 performAnalysis called - Cursors:", appState.cursorStart, "s to", appState.cursorEnd, "s");

    const t = appState.fullDataTime;
    const cursorStartMs = appState.cursorStart * 1000;
    const cursorEndMs = appState.cursorEnd * 1000;

    console.log("📍 Analyzing data between CURSORS:", cursorStartMs.toFixed(2), "ms to", cursorEndMs.toFixed(2), "ms");

    const i1 = t.findIndex(val => val >= cursorStartMs);
    let i2 = t.findIndex(val => val >= cursorEndMs);

    if(i2 === -1) i2 = t.length;

    console.log("Found indices:", i1, "to", i2, "out of", t.length, "points");

    if(i1 === -1 || i1 >= i2) {
        console.log("Invalid selection - skipping analysis");
        return;
    }

    // Mode multi-canaux
    if (appState.channelConfig && appState.channelConfig.length > 0) {
        const fftChannels = appState.channelConfig.filter(config => config.showFFT);

        if (fftChannels.length === 0) {
            // Aucun canal FFT sélectionné, vider le graphique
            appState.charts.freq.data.datasets = [];
            appState.charts.freq.update('none');
            return;
        }

        const N = parseInt(document.getElementById('fft-size').value);
        const win = document.getElementById('window-func').value;
        const res = appState.fs/N;

        // Calculer la FFT pour chaque canal sélectionné
        appState.charts.freq.data.datasets = fftChannels.map(config => {
            const channelData = appState.allColumnData[config.index];
            const raw = Array.from(channelData.slice(i1, i2));

            if(raw.length < 10) {
                return null;
            }

            const result = computeFFTForChannel(raw, N, win, res);

            return {
                label: config.label,
                data: result.mags,
                borderColor: config.color,
                backgroundColor: config.color + '20',
                borderWidth: config.lineWidth || 1,
                pointRadius: 0,
                fill: false
            };
        }).filter(dataset => dataset !== null);

        // Mettre à jour le pic principal (du premier canal)
        if (fftChannels.length > 0) {
            const firstChannelData = appState.allColumnData[fftChannels[0].index];
            const raw = Array.from(firstChannelData.slice(i1, i2));

            if(raw.length >= 10) {
                const result = computeFFTForChannel(raw, N, win, res);
                appState.allPeaks = result.peaks;
                appState.peakFreq = result.peakFreq;
                appState.peakAmp = result.peakAmp;
                document.getElementById('res-peak').textContent = appState.peakFreq.toFixed(1)+" Hz";
                document.getElementById('res-amp').textContent = appState.peakAmp.toFixed(1) + " : " + fftChannels[0].unit;
            }
        }

        appState.charts.freq.update('none');
        console.log("✅ FFT Multi-Channel Analysis Completed");
        return;
    }

    // Mode simple (ancien comportement)
    const v = appState.fullDataPressure;
    const raw = Array.from(v.slice(i1, i2));
    console.log("Data slice length:", raw.length);

    if(raw.length < 10) {
        console.log("Not enough data points - skipping analysis");
        return;
    }

    const N = parseInt(document.getElementById('fft-size').value);
    const win = document.getElementById('window-func').value;
    const res = appState.fs/N;

    const result = computeFFTForChannel(raw, N, win, res);

    appState.allPeaks = result.peaks;
    appState.peakFreq = result.peakFreq;
    appState.peakAmp = result.peakAmp;
    document.getElementById('res-peak').textContent = appState.peakFreq.toFixed(1)+" Hz";
    document.getElementById('res-amp').textContent = appState.peakAmp.toFixed(1) + " : " + appState.yAxisLabel;

    appState.charts.freq.data.datasets[0].data = result.mags;
    appState.charts.freq.update('none');

    console.log("✅ FFT Analysis Completed - Peak:", appState.peakFreq.toFixed(1), "Hz");
}

// Ajouter cette fonction pour gérer le redimensionnement quand un graphique est masqué
function updateChartSizes() {
    // Cette fonction est maintenant dans app.js, mais on peut laisser un alias ici
    if (typeof window.updateChartSizes === 'function') {
        window.updateChartSizes();
    }
}

 // Le reste du code reste identique...

function centerCursors() {
    console.log("🎯 centerCursors() called");

    const chart = appState.charts.time;
    if (!chart || !appState.fullDataTime.length) {
        console.error("❌ Cannot center cursors: chart or data not ready");
        setStatus("Aucune donnée à centrer");
        return;
    }

    // 1. Obtenir les limites VISIBLES sur l'axe X (en millisecondes)
    const visibleMin = chart.options.scales.x.min;  // Valeur minimale visible
    const visibleMax = chart.options.scales.x.max;  // Valeur maximale visible

    console.log("📏 Visible min:", visibleMin, "ms =", (visibleMin/1000).toFixed(3), "s");
    console.log("📏 Visible max:", visibleMax, "ms =", (visibleMax/1000).toFixed(3), "s");
    
    // 2. Calculer la largeur visible sur l'axe X
    const visibleWidth = visibleMax - visibleMin;  // en millisecondes
    
    console.log("DEBUG - Largeur visible:", visibleWidth, "ms =", visibleWidth/1000, "s");
    
    // 3. Calculer 10% de cette largeur (avec un minimum de 20ms = 0.02s)
    const tenPercentMs = Math.max(visibleWidth * 0.10, 20);  // 10% avec minimum 20ms
    const halfSpacingMs = tenPercentMs / 2;
    
    console.log("DEBUG - 10% de largeur:", tenPercentMs, "ms =", tenPercentMs/1000, "s");
    
    // 4. Calculer le centre de la fenêtre visible
    const viewportCenterMs = (visibleMin + visibleMax) / 2;
    
    console.log("DEBUG - Centre:", viewportCenterMs, "ms =", viewportCenterMs/1000, "s");
    
    // 5. Calculer les nouvelles positions (convertir en secondes)
    const newStart = (viewportCenterMs - halfSpacingMs) / 1000;  // en secondes
    const newEnd = (viewportCenterMs + halfSpacingMs) / 1000;    // en secondes
    
    console.log("DEBUG - Nouveau début:", newStart, "s");
    console.log("DEBUG - Nouveau fin:", newEnd, "s");
    
    // 6. Vérifier les limites totales des données
    const totalDuration = appState.fullDataTime[appState.fullDataTime.length - 1] / 1000;
    
    console.log("DEBUG - Durée totale:", totalDuration, "s");
    
    // 7. Appliquer les nouvelles positions (avec vérification)
    if (newStart >= 0 && newEnd <= totalDuration && newStart < newEnd) {
        appState.cursorStart = newStart;
        appState.cursorEnd = newEnd;

        console.log("✅ Cursors centered successfully:", newStart.toFixed(3), "s to", newEnd.toFixed(3), "s");

        // Mettre à jour les statistiques et le graphique
        updateStats();
        if (chart && chart.update) {
            chart.update('none');
        }

        const visibleSeconds = (visibleWidth / 1000).toFixed(3);
        const spacingSeconds = (tenPercentMs / 1000).toFixed(3);
        setStatus(`Curseurs centrés: ${spacingSeconds}s (10% de ${visibleSeconds}s visible)`);
    } else {
        // Ajustement si hors limites
        const adjustedStart = Math.max(0, newStart);
        const adjustedEnd = Math.min(totalDuration, newEnd);
        
        if (adjustedStart < adjustedEnd) {
            appState.cursorStart = adjustedStart;
            appState.cursorEnd = adjustedEnd;
            setStatus("Curseurs centrés (ajustés aux limites)");
        } else {
            // Fallback: centre des données complètes avec 10% de la durée totale
            const totalWidth = totalDuration * 1000;  // en ms
            const fallbackSpacing = Math.max(totalWidth * 0.10, 100) / 1000;  // 10% en secondes
            const totalCenter = totalDuration / 2;
            
            appState.cursorStart = Math.max(0, totalCenter - fallbackSpacing/2);
            appState.cursorEnd = Math.min(totalDuration, totalCenter + fallbackSpacing/2);
            setStatus("Curseurs centrés sur données complètes");
        }
    }
    
    // 8. Mettre à jour l'affichage
    chart.update('none');
    updateStats();
    
    // 9. Déclencher l'analyse FFT
    if (!appState.fftTimeout) {
        appState.fftTimeout = setTimeout(() => { 
            performAnalysis(); 
            appState.fftTimeout = null; 
        }, 50);
    }
    
    console.log("DEBUG - Curseurs mis à jour:", appState.cursorStart, "s à", appState.cursorEnd, "s");
}