// =====================================
// OUTIL DE TRACKING (TRAQUER)
// =====================================

// État de l'outil de tracking
let trackState = {
    active: false,
    currentX: null,  // Position X actuelle du curseur
    values: {}       // Valeurs Y pour chaque dataset
};

// Activer/désactiver l'outil
function toggleTrackTool() {
    trackState.active = !trackState.active;

    const btn = document.getElementById('track-tool-btn');
    const results = document.getElementById('track-results');

    if (trackState.active) {
        btn.style.background = 'var(--accent-green)';
        btn.innerHTML = '<i class="fas fa-crosshairs"></i> Outil Actif (déplacez la souris)';
        results.style.display = 'block';
        setStatus("Outil Traquer activé - Déplacez la souris sur le graphique");
    } else {
        btn.style.background = 'var(--accent-blue)';
        btn.innerHTML = '<i class="fas fa-crosshairs"></i> Traquer';
        results.style.display = 'none';
        trackState.currentX = null;
        trackState.values = {};
        appState.charts.time.update('none');
        setStatus("Outil Traquer désactivé");
    }
}

// Effacer le tracking
function clearTrack() {
    trackState.currentX = null;
    trackState.values = {};
    document.getElementById('track-values').innerHTML = '';
    appState.charts.time.update('none');
    setStatus("Tracking effacé");
}

// Gérer le mouvement de la souris pour le tracking
function handleTrackMove(event, chart, canvas) {
    if (!trackState.active) return false;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Vérifier si on est dans la zone du graphique
    const xAxis = chart.scales.x;
    const isInChart = x >= xAxis.left && x <= xAxis.right;

    if (!isInChart) {
        trackState.currentX = null;
        trackState.values = {};
        chart.update('none');
        return true;
    }

    // Convertir la position pixel en valeur X
    const xValue = xAxis.getValueForPixel(x);
    trackState.currentX = xValue;

    // Calculer les valeurs Y pour chaque dataset visible
    trackState.values = {};

    chart.data.datasets.forEach((dataset, index) => {
        if (!dataset.hidden && dataset.data && dataset.data.length > 0) {
            // Trouver les deux points les plus proches de xValue pour interpoler
            const yValue = interpolateValue(dataset.data, xValue);

            if (yValue !== null) {
                trackState.values[dataset.label] = {
                    value: yValue,
                    color: dataset.borderColor,
                    yAxisID: dataset.yAxisID || 'y'
                };
            }
        }
    });

    // Mettre à jour l'affichage
    updateTrackResults();
    chart.update('none');

    return true;
}

// Interpoler la valeur Y à une position X donnée
function interpolateValue(data, xTarget) {
    if (!data || data.length === 0) return null;

    // Trouver les deux points encadrant xTarget
    let left = null;
    let right = null;

    for (let i = 0; i < data.length; i++) {
        const point = data[i];
        const x = point.x;

        if (x <= xTarget) {
            left = point;
        }
        if (x >= xTarget && right === null) {
            right = point;
            break;
        }
    }

    // Si on a trouvé les deux points, interpoler
    if (left && right) {
        if (left.x === right.x) {
            return left.y;
        }

        // Interpolation linéaire
        const ratio = (xTarget - left.x) / (right.x - left.x);
        return left.y + ratio * (right.y - left.y);
    }

    // Si on est avant le premier point
    if (!left && right) {
        return right.y;
    }

    // Si on est après le dernier point
    if (left && !right) {
        return left.y;
    }

    return null;
}

// Mettre à jour l'affichage des résultats dans le panneau
function updateTrackResults() {
    const container = document.getElementById('track-values');

    if (Object.keys(trackState.values).length === 0) {
        container.innerHTML = '<div style="color:var(--text-muted); font-style:italic;">Aucune donnée</div>';
        return;
    }

    let html = '';
    Object.keys(trackState.values).forEach(label => {
        const data = trackState.values[label];
        html += `
            <div class="control-row" style="margin-bottom:4px;">
                <span style="color:${data.color};">${label}:</span>
                <span style="color:var(--accent-green); font-weight:bold;">${data.value.toFixed(2)}</span>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Dessiner le curseur de tracking et les annotations
function drawTrackCursor(chart) {
    if (!trackState.active || trackState.currentX === null) return;

    const ctx = chart.ctx;
    const xAxis = chart.scales.x;
    const x = xAxis.getPixelForValue(trackState.currentX);

    // Vérifier que x est dans les limites
    if (x < xAxis.left || x > xAxis.right) return;

    ctx.save();

    // Dessiner la ligne verticale en pointillés violet
    ctx.strokeStyle = '#9C27B0'; // Violet/Purple
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    ctx.beginPath();
    ctx.moveTo(x, xAxis.top);
    ctx.lineTo(x, xAxis.bottom);
    ctx.stroke();

    ctx.setLineDash([]);

    // Compter les axes à gauche et à droite pour calculer les offsets
    const leftAxes = [];
    const rightAxes = [];

    Object.keys(chart.scales).forEach(scaleKey => {
        if (!scaleKey.startsWith('y')) return;
        const scale = chart.scales[scaleKey];
        if (scale.options && scale.options.display !== false) {
            if (scale.options.position === 'left') {
                leftAxes.push(scaleKey);
            } else if (scale.options.position === 'right') {
                rightAxes.push(scaleKey);
            }
        }
    });

    // Dessiner les annotations sur chaque axe Y pour chaque dataset
    Object.keys(trackState.values).forEach(label => {
        const data = trackState.values[label];
        const yAxisID = data.yAxisID;
        const yScale = chart.scales[yAxisID];

        if (!yScale) {
            console.log('⚠️ Échelle non trouvée:', yAxisID);
            return;
        }

        const yPixel = yScale.getPixelForValue(data.value);

        // Déterminer la position de l'annotation
        let axisXPos;
        let offset = 0;

        if (yScale.options.position === 'left') {
            const axisIndex = leftAxes.indexOf(yAxisID);
            offset = axisIndex * 60;
            axisXPos = xAxis.left - 50 - offset;
        } else if (yScale.options.position === 'right') {
            const axisIndex = rightAxes.indexOf(yAxisID);
            offset = axisIndex * 60;
            axisXPos = xAxis.right + 50 + offset;
        } else {
            console.log('⚠️ Position non définie pour:', yAxisID);
            return;
        }

        ctx.save();
        ctx.translate(axisXPos, yPixel);
        ctx.rotate(-Math.PI / 2);

        // Rectangle violet avec bordure
        ctx.fillStyle = '#E1BEE7'; // Violet clair
        ctx.fillRect(-30, -10, 60, 20);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(-30, -10, 60, 20);

        // Texte
        ctx.fillStyle = '#000';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const valueText = data.value.toFixed(2);
        ctx.fillText(valueText, 0, 0);

        ctx.restore();

        // Dessiner un petit cercle à l'intersection
        ctx.fillStyle = data.color;
        ctx.beginPath();
        ctx.arc(x, yPixel, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
    });

    ctx.restore();
}
