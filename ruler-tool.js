// =====================================
// OUTIL DE MESURE SIMPLE (RÈGLE)
// =====================================

// État de l'outil règle
let rulerState = {
    active: false,
    point: null,  // {x: valeur en ms, y: valeur en unité}
    dragging: false
};

// Activer/désactiver l'outil
function toggleRulerTool() {
    rulerState.active = !rulerState.active;

    const btn = document.getElementById('ruler-tool-btn');
    const results = document.getElementById('ruler-results');

    if (rulerState.active) {
        btn.style.background = 'var(--accent-green)';
        btn.innerHTML = '<i class="fas fa-ruler"></i> Outil Actif (cliquez 1 point)';
        results.style.display = 'block';
        setStatus("Outil Mesurer activé - Cliquez sur le graphique pour placer le point");
    } else {
        btn.style.background = 'var(--accent-blue)';
        btn.innerHTML = '<i class="fas fa-ruler"></i> Mesurer';
        results.style.display = 'none';
        rulerState.point = null;
        appState.charts.time.update('none');
        setStatus("Outil Mesurer désactivé");
    }
}

// Effacer la mesure
function clearRuler() {
    rulerState.point = null;
    document.getElementById('ruler-x').textContent = '--';
    document.getElementById('ruler-y').textContent = '--';
    appState.charts.time.update('none');
    setStatus("Mesure effacée");
}

// Gérer le clic sur le graphique pour placer le point
function handleRulerClick(event, chart) {
    if (!rulerState.active) return false;

    const rect = chart.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Convertir les coordonnées pixel en valeurs
    const xValue = chart.scales.x.getValueForPixel(x);
    const yValue = chart.scales.y.getValueForPixel(y);

    // Vérifier si on clique près du point existant pour le déplacer
    const tolerance = 10; // pixels

    if (rulerState.point) {
        const xPixel = chart.scales.x.getPixelForValue(rulerState.point.x);
        const yPixel = chart.scales.y.getPixelForValue(rulerState.point.y);
        const dist = Math.sqrt((x - xPixel)**2 + (y - yPixel)**2);

        if (dist < tolerance) {
            rulerState.dragging = true;
            return true;
        }
    }

    // Placer ou remplacer le point
    rulerState.point = { x: xValue, y: yValue };
    updateRulerResults();
    setStatus("Point placé - Glissez pour ajuster ou utilisez Effacer");

    chart.update('none');
    return true;
}

// Gérer le déplacement du point
function handleRulerDrag(event, chart, canvas) {
    if (!rulerState.active || !rulerState.dragging) return false;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const xValue = chart.scales.x.getValueForPixel(x);
    const yValue = chart.scales.y.getValueForPixel(y);

    rulerState.point = { x: xValue, y: yValue };
    updateRulerResults();
    chart.update('none');

    return true;
}

// Gérer le relâchement de la souris
function handleRulerMouseUp() {
    if (!rulerState.active) return false;

    if (rulerState.dragging) {
        rulerState.dragging = false;
        setStatus("Point ajusté");
        return true;
    }

    return false;
}

// Mettre à jour l'affichage des résultats
function updateRulerResults() {
    if (!rulerState.point) return;

    const xDisplay = rulerState.point.x >= 1
        ? `${rulerState.point.x.toFixed(3)}s`
        : `${(rulerState.point.x * 1000).toFixed(3)}ms`;

    const yDisplay = rulerState.point.y.toFixed(2);

    document.getElementById('ruler-x').textContent = xDisplay;
    document.getElementById('ruler-y').textContent = yDisplay;
}

// Dessiner le point et les lignes sur le graphique
function drawRulerPoint(chart) {
    if (!rulerState.active || !rulerState.point) return;

    const ctx = chart.ctx;
    const xAxis = chart.scales.x;
    const yAxis = chart.scales.y;

    const x = xAxis.getPixelForValue(rulerState.point.x);
    const y = yAxis.getPixelForValue(rulerState.point.y);

    ctx.save();

    // Dessiner les lignes en pointillés cyan
    ctx.strokeStyle = '#4ECDC4'; // Cyan
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    // Ligne verticale
    ctx.beginPath();
    ctx.moveTo(x, xAxis.top);
    ctx.lineTo(x, xAxis.bottom);
    ctx.stroke();

    // Ligne horizontale
    ctx.beginPath();
    ctx.moveTo(xAxis.left, y);
    ctx.lineTo(xAxis.right, y);
    ctx.stroke();

    ctx.setLineDash([]);

    // Dessiner le point (cercle cyan avec centre blanc)
    ctx.fillStyle = '#4ECDC4';
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Centre du point
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, 2 * Math.PI);
    ctx.fill();

    ctx.restore();
}
