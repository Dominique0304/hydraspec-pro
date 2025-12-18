// =====================================
// OUTIL DE TRACKING (TRAQUER)
// =====================================

// État de l'outil de tracking
let trackState = {
    active: false,
    currentX: null,  // Position X actuelle du curseur
    values: {},      // Valeurs Y pour chaque dataset
    locked: false,   // Si true, le curseur est fixé (ne suit pas la souris)
    dragging: false  // Si true, on est en train de dragger le curseur
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
    trackState.locked = false;
    trackState.dragging = false;
    document.getElementById('track-values').innerHTML = '';
    appState.charts.time.update('none');
    setStatus("Tracking effacé");
}

// Gérer le clic pour fixer le curseur
function handleTrackClick(event, chart) {
    if (!trackState.active) return false;

    const rect = chart.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const xAxis = chart.scales.x;
    const isInChart = x >= xAxis.left && x <= xAxis.right;

    if (!isInChart) return false;

    const xValue = xAxis.getValueForPixel(x);

    // Si le curseur est déjà fixé, vérifier si on clique près de lui pour le dragger
    if (trackState.locked && trackState.currentX !== null) {
        const cursorPixel = xAxis.getPixelForValue(trackState.currentX);
        const distance = Math.abs(x - cursorPixel);
        const tolerance = 15; // pixels

        if (distance <= tolerance) {
            // On clique sur le curseur → commencer le drag
            trackState.dragging = true;
            return true;
        } else {
            // On clique ailleurs → déplacer le curseur immédiatement
            trackState.currentX = xValue;
            updateTrackValues(chart);
            return true;
        }
    } else {
        // Pas encore de curseur fixé → fixer à cette position
        trackState.currentX = xValue;
        trackState.locked = true;
        updateTrackValues(chart);
        setStatus("Curseur Traquer fixé - Cliquez dessus pour le déplacer");
        return true;
    }
}

// Gérer le relâchement de la souris
function handleTrackMouseUp() {
    if (!trackState.active) return false;

    if (trackState.dragging) {
        trackState.dragging = false;
        setStatus("Curseur Traquer repositionné");
        return true;
    }

    return false;
}

// Gérer le mouvement de la souris pour le tracking
function handleTrackMove(event, chart, canvas) {
    if (!trackState.active) return false;

    // IMPORTANT: Ne pas intercepter si on est en train de dragger autre chose (curseurs, etc.)
    if (appState.isDragging) return false;

    // Si le curseur est fixé et qu'on ne drag pas, ne rien faire
    if (trackState.locked && !trackState.dragging) return false;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;

    // Vérifier si on est dans la zone du graphique
    const xAxis = chart.scales.x;
    const isInChart = x >= xAxis.left && x <= xAxis.right;

    if (!isInChart) return false;

    // Convertir la position pixel en valeur X
    const xValue = xAxis.getValueForPixel(x);
    trackState.currentX = xValue;

    // Mettre à jour les valeurs
    updateTrackValues(chart);

    return false;  // Ne pas bloquer les autres événements (curseurs, etc.)
}

// Calculer et mettre à jour les valeurs Y pour la position X actuelle
function updateTrackValues(chart) {
    trackState.values = {};

    const xValue = trackState.currentX;
    console.log('📍 Track - Position X:', xValue.toFixed(3), 'Datasets:', chart.data.datasets.length);

    chart.data.datasets.forEach((dataset, index) => {
        if (!dataset.hidden && dataset.data && dataset.data.length > 0) {
            // Vérifier le format des données
            const firstPoint = dataset.data[0];
            let yValue = null;

            if (typeof firstPoint === 'object' && firstPoint !== null && 'x' in firstPoint) {
                // Format objet {x, y}
                yValue = interpolateValue(dataset.data, xValue);
            } else {
                // Format simple [y1, y2, y3, ...] - utiliser les labels du chart
                yValue = interpolateValueFromLabels(chart, dataset.data, xValue);
            }

            console.log('   Dataset:', dataset.label, 'yAxisID:', dataset.yAxisID, 'yValue:', yValue);

            if (yValue !== null) {
                trackState.values[dataset.label] = {
                    value: yValue,
                    color: dataset.borderColor,
                    yAxisID: dataset.yAxisID || 'y'
                };
            }
        }
    });

    console.log('📊 Track values:', Object.keys(trackState.values).length, 'channels');

    // Mettre à jour l'affichage
    updateTrackResults();
    chart.update('none');
}

// Interpoler la valeur Y à partir des labels du chart (format simple)
function interpolateValueFromLabels(chart, dataArray, xTarget) {
    if (!dataArray || dataArray.length === 0) {
        console.log('⚠️ interpolateValueFromLabels: data vide');
        return null;
    }

    const labels = chart.data.labels;
    if (!labels || labels.length === 0) {
        console.log('⚠️ interpolateValueFromLabels: labels vides');
        return null;
    }

    console.log('🔍 Labels - Premier:', labels[0], 'Dernier:', labels[labels.length - 1], 'xTarget:', xTarget);

    // Trouver les deux indices encadrant xTarget
    let leftIdx = -1;
    let rightIdx = -1;

    for (let i = 0; i < labels.length; i++) {
        const labelX = parseFloat(labels[i]);

        if (labelX <= xTarget) {
            leftIdx = i;
        }
        if (labelX >= xTarget && rightIdx === -1) {
            rightIdx = i;
            break;
        }
    }

    console.log('🔍 Indices - left:', leftIdx, 'right:', rightIdx);

    // Si on a trouvé les deux indices, interpoler
    if (leftIdx >= 0 && rightIdx >= 0 && leftIdx < dataArray.length && rightIdx < dataArray.length) {
        const x1 = parseFloat(labels[leftIdx]);
        const x2 = parseFloat(labels[rightIdx]);
        const y1 = dataArray[leftIdx];
        const y2 = dataArray[rightIdx];

        if (x1 === x2) {
            return y1;
        }

        // Interpolation linéaire
        const ratio = (xTarget - x1) / (x2 - x1);
        const result = y1 + ratio * (y2 - y1);
        console.log('✅ Interpolation réussie:', result);
        return result;
    }

    // Si on est avant le premier point
    if (leftIdx === -1 && rightIdx >= 0 && rightIdx < dataArray.length) {
        return dataArray[rightIdx];
    }

    // Si on est après le dernier point
    if (leftIdx >= 0 && leftIdx < dataArray.length && rightIdx === -1) {
        return dataArray[leftIdx];
    }

    console.log('⚠️ interpolateValueFromLabels: aucun point trouvé');
    return null;
}

// Interpoler la valeur Y à une position X donnée (format objet {x, y})
function interpolateValue(data, xTarget) {
    if (!data || data.length === 0) {
        console.log('⚠️ interpolateValue: data vide');
        return null;
    }

    // Debug: afficher le format des données
    if (data.length > 0) {
        console.log('🔍 Premier point:', data[0], 'xTarget:', xTarget);
        console.log('🔍 Dernier point:', data[data.length - 1]);
    }

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

    console.log('🔍 Interpolation - left:', left, 'right:', right);

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

    console.log('⚠️ interpolateValue: aucun point trouvé');
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

    // Dessiner la ligne verticale en pointillés VERT traversant tout le graphique
    ctx.strokeStyle = '#4CAF50'; // Vert
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]); // Pointillés bien visibles

    // Trouver les limites Y du graphique (toutes les échelles)
    let topY = Infinity;
    let bottomY = -Infinity;
    Object.keys(chart.scales).forEach(scaleKey => {
        if (scaleKey.startsWith('y')) {
            const scale = chart.scales[scaleKey];
            if (scale.top < topY) topY = scale.top;
            if (scale.bottom > bottomY) bottomY = scale.bottom;
        }
    });

    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x, bottomY);
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

        // Rotation différente selon le côté : gauche -90°, droite +90° (pour lire de bas en haut)
        if (yScale.options.position === 'left') {
            ctx.rotate(-Math.PI / 2); // -90° : se lit de bas en haut
        } else {
            ctx.rotate(Math.PI / 2);  // +90° : se lit de bas en haut
        }

        // Rectangle blanc avec bordure de la couleur du dataset
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-30, -10, 60, 20);
        ctx.strokeStyle = data.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(-30, -10, 60, 20);

        // Texte dans la couleur du dataset
        ctx.fillStyle = data.color;
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
