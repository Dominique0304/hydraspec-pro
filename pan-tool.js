// =====================================
// OUTIL DE DÉPLACEMENT (PAN)
// =====================================

// État de l'outil de déplacement
let panState = {
    active: false,
    dragging: false,
    lastX: 0,
    lastY: 0
};

// Activer/désactiver l'outil de déplacement
function togglePanTool() {
    panState.active = !panState.active;

    const btn = document.getElementById('pan-tool-btn');

    if (panState.active) {
        btn.style.background = 'var(--accent-green)';
        btn.innerHTML = '<i class="fas fa-arrows-alt"></i> Outil Actif';
        setStatus("Outil de déplacement activé - Cliquez et glissez pour déplacer");
    } else {
        btn.style.background = 'var(--accent-blue)';
        btn.innerHTML = '<i class="fas fa-arrows-alt"></i> Déplacement';
        panState.dragging = false;
        setStatus("Outil de déplacement désactivé");
    }
}

// Gérer le clic pour le pan
function handlePanClick(event, chart) {
    if (!panState.active) return false;

    panState.dragging = true;
    panState.lastX = event.clientX;
    panState.lastY = event.clientY;
    return true; // L'outil a géré le clic
}

// Gérer le déplacement
function handlePanDrag(event, chart, canvas) {
    if (!panState.active || !panState.dragging) return false;

    const dx = event.clientX - panState.lastX;
    const dy = event.clientY - panState.lastY;

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

    panState.lastX = event.clientX;
    panState.lastY = event.clientY;
    chart.update('none');

    // Mise à jour immédiate des champs de zoom
    if (typeof updateZoomInputs === 'function') {
        updateZoomInputs();
    }

    return true; // L'outil a géré le mouvement
}

// Terminer le déplacement
function handlePanMouseUp() {
    if (panState.dragging) {
        panState.dragging = false;
        return true;
    }
    return false;
}
