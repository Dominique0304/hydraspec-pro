// =====================================
// SYSTÈME DE CONFIGURATION MULTI-CANAUX
// =====================================

// Couleurs par défaut pour les canaux
const DEFAULT_CHANNEL_COLORS = [
    '#FF0000',  // Rouge
    '#0000FF',  // Bleu
    '#00FF00',  // Vert
    '#FF8C00',  // Orange
    '#FF00FF',  // Magenta
    '#00FFFF',  // Cyan
    '#FFD700',  // Or
    '#8B00FF'   // Violet
];

// Initialiser la configuration des canaux
function initChannelConfig() {
    console.log("🎨 Initialisation de la configuration multi-canaux");

    if (!appState.availableColumns || appState.availableColumns.length === 0) {
        console.log("⚠️ Aucun canal disponible");
        return;
    }

    // Créer la configuration par défaut pour chaque canal
    appState.channelConfig = appState.availableColumns.map((col, index) => ({
        index: col.index,
        name: col.name,
        label: col.label,
        unit: col.unit || "",
        visible: true, // TOUS les canaux sont visibles par défaut
        color: DEFAULT_CHANNEL_COLORS[index % DEFAULT_CHANNEL_COLORS.length],
        lineWidth: 0.5,  // Épaisseur de ligne par défaut
        yAxisPosition: index === 0 ? 'left' : 'right',  // Premier à gauche, autres à droite
        yMin: null,  // Auto
        yMax: null,  // Auto
        yAxisID: `y${index}`,
        showFFT: index === 0  // Seul le premier canal affiche la FFT par défaut
    }));

    console.log("✅ Configuration initialisée pour", appState.channelConfig.length, "canaux");
}

// Ouvrir la modale de configuration
function openChannelConfig() {
    const modal = document.getElementById('channel-config-modal');
    if (!modal) {
        console.error("❌ Modale de configuration non trouvée");
        return;
    }

    // Mettre à jour le contenu de la modale
    updateChannelConfigUI();

    modal.style.display = 'flex';
}

// Fermer la modale
function closeChannelConfig() {
    const modal = document.getElementById('channel-config-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Mettre à jour l'interface de configuration
function updateChannelConfigUI() {
    const tbody = document.getElementById('channel-config-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    // Ajouter une ligne pour chaque canal
    appState.channelConfig.forEach((config, index) => {
        const row = document.createElement('tr');

        // Checkbox visible
        const visibleCell = document.createElement('td');
        const visibleCheck = document.createElement('input');
        visibleCheck.type = 'checkbox';
        visibleCheck.checked = config.visible;
        visibleCheck.onchange = (e) => {
            config.visible = e.target.checked;
            updateTimeChart();
        };
        visibleCell.appendChild(visibleCheck);

        // Nom du canal
        const nameCell = document.createElement('td');
        nameCell.textContent = config.label;
        nameCell.style.fontWeight = 'bold';

        // Couleur
        const colorCell = document.createElement('td');
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = config.color;
        colorInput.onchange = (e) => {
            config.color = e.target.value;
            updateTimeChart();
        };
        colorCell.appendChild(colorInput);

        // Épaisseur de ligne
        const lineWidthCell = document.createElement('td');
        const lineWidthInput = document.createElement('input');
        lineWidthInput.type = 'number';
        lineWidthInput.min = '0.5';
        lineWidthInput.max = '10';
        lineWidthInput.step = '0.5';
        lineWidthInput.value = config.lineWidth;
        lineWidthInput.style.width = '60px';
        lineWidthInput.onchange = (e) => {
            config.lineWidth = parseFloat(e.target.value);
            updateTimeChart();
        };
        lineWidthCell.appendChild(lineWidthInput);

        // Position Y
        const posCell = document.createElement('td');
        const posSelect = document.createElement('select');
        ['left', 'right', 'hidden'].forEach(pos => {
            const option = document.createElement('option');
            option.value = pos;
            option.textContent = pos === 'left' ? 'Gauche' : pos === 'right' ? 'Droite' : 'Masquée';
            if (config.yAxisPosition === pos) option.selected = true;
            posSelect.appendChild(option);
        });
        posSelect.onchange = (e) => {
            config.yAxisPosition = e.target.value;
            updateTimeChart();
        };
        posCell.appendChild(posSelect);

        // Y Min
        const yMinCell = document.createElement('td');
        const yMinInput = document.createElement('input');
        yMinInput.type = 'number';
        yMinInput.step = '0.1';
        yMinInput.placeholder = 'Auto';
        yMinInput.value = config.yMin !== null ? config.yMin : '';
        yMinInput.style.width = '80px';
        yMinInput.onchange = (e) => {
            config.yMin = e.target.value === '' ? null : parseFloat(e.target.value);
            updateTimeChart();
        };
        yMinCell.appendChild(yMinInput);

        // Y Max
        const yMaxCell = document.createElement('td');
        const yMaxInput = document.createElement('input');
        yMaxInput.type = 'number';
        yMaxInput.step = '0.1';
        yMaxInput.placeholder = 'Auto';
        yMaxInput.value = config.yMax !== null ? config.yMax : '';
        yMaxInput.style.width = '80px';
        yMaxInput.onchange = (e) => {
            config.yMax = e.target.value === '' ? null : parseFloat(e.target.value);
            updateTimeChart();
        };
        yMaxCell.appendChild(yMaxInput);

        // Checkbox FFT
        const fftCell = document.createElement('td');
        fftCell.style.textAlign = 'center';
        const fftCheck = document.createElement('input');
        fftCheck.type = 'checkbox';
        fftCheck.checked = config.showFFT;
        fftCheck.onchange = (e) => {
            config.showFFT = e.target.checked;
            performAnalysis();
        };
        fftCell.appendChild(fftCheck);

        row.appendChild(visibleCell);
        row.appendChild(nameCell);
        row.appendChild(colorCell);
        row.appendChild(lineWidthCell);
        row.appendChild(posCell);
        row.appendChild(yMinCell);
        row.appendChild(yMaxCell);
        row.appendChild(fftCell);

        tbody.appendChild(row);
    });

    // Mettre à jour le sélecteur d'axe X
    updateXAxisSelector();
}

// Mettre à jour le sélecteur d'axe X
function updateXAxisSelector() {
    const select = document.getElementById('x-axis-channel-select');
    if (!select) return;

    select.innerHTML = '';

    // Option temps (par défaut)
    const timeOption = document.createElement('option');
    timeOption.value = '0';
    timeOption.textContent = 'Temps (ms)';
    select.appendChild(timeOption);

    // Options pour chaque canal
    appState.availableColumns.forEach((col, index) => {
        const option = document.createElement('option');
        option.value = (index + 1).toString();
        option.textContent = col.label;
        select.appendChild(option);
    });

    select.value = appState.xAxisChannel.toString();
    select.onchange = (e) => {
        appState.xAxisChannel = parseInt(e.target.value);
        updateTimeChart();
    };
}

// Appliquer la configuration et fermer
function applyChannelConfig() {
    console.log("✅ Configuration des canaux appliquée");
    updateTimeChart();
    closeChannelConfig();
}

// Réinitialiser la configuration par défaut
function resetChannelConfig() {
    if (!confirm('Réinitialiser la configuration des canaux à leur état par défaut ?')) {
        return;
    }

    // Réinitialiser
    initChannelConfig();
    updateChannelConfigUI();
    updateTimeChart();

    console.log("🔄 Configuration réinitialisée");
}

// Mettre à jour le graphique temporel avec multi-canaux
function updateTimeChartMultiChannel() {
    const chart = appState.charts.time;

    if (!chart || !appState.channelConfig || appState.channelConfig.length === 0) {
        console.log("⚠️ Pas de configuration multi-canaux, utilisation du mode simple");
        return false; // Retourner false pour utiliser le mode simple
    }

    console.log("🎨 Mise à jour du graphique en mode multi-canaux");

    // Obtenir les canaux visibles
    const visibleChannels = appState.channelConfig.filter(config => config.visible);

    if (visibleChannels.length === 0) {
        console.log("⚠️ Aucun canal visible");
        return false;
    }

    // Déterminer les données de l'axe X
    let xData;
    if (appState.xAxisChannel === 0) {
        // Utiliser le temps
        xData = appState.fullDataTime;
    } else {
        // Utiliser un autre canal
        const xChannelIndex = appState.availableColumns[appState.xAxisChannel - 1].index;
        xData = appState.allColumnData[xChannelIndex];
    }

    // Downsampling si nécessaire
    let downsampleStep = 1;
    if (xData.length > 15000) {
        downsampleStep = Math.ceil(xData.length / 15000);
    }

    const downsampledX = downsampleStep > 1 ? xData.filter((_, i) => i % downsampleStep === 0) : Array.from(xData);

    // Créer les datasets pour chaque canal visible
    chart.data.labels = downsampledX;
    chart.data.datasets = visibleChannels.map(config => {
        const channelData = appState.allColumnData[config.index];
        const downsampledY = downsampleStep > 1 ? channelData.filter((_, i) => i % downsampleStep === 0) : Array.from(channelData);

        return {
            label: config.label,
            data: downsampledY,
            borderColor: config.color,
            backgroundColor: config.color + '20',
            borderWidth: config.lineWidth,
            pointRadius: 0,
            fill: false,
            yAxisID: config.yAxisID
        };
    });

    // Configurer les échelles X
    chart.options.scales.x.min = downsampledX[0];
    chart.options.scales.x.max = downsampledX[downsampledX.length - 1];

    // Label de l'axe X
    if (appState.xAxisChannel === 0) {
        chart.options.scales.x.title.text = 'Temps (ms)';
    } else {
        const xChannelConfig = appState.availableColumns[appState.xAxisChannel - 1];
        chart.options.scales.x.title.text = xChannelConfig.label + (xChannelConfig.unit ? ` (${xChannelConfig.unit})` : '');
    }

    // Supprimer les anciennes échelles Y (sauf 'y' qu'on va recréer pour compatibilité)
    const oldScales = Object.keys(chart.options.scales).filter(key => key !== 'x');
    oldScales.forEach(key => {
        delete chart.options.scales[key];
    });

    // Créer les échelles Y pour chaque canal visible
    visibleChannels.forEach((config, index) => {
        const channelData = appState.allColumnData[config.index];

        // Calculer min/max
        let yMin, yMax;
        if (config.yMin !== null && config.yMax !== null) {
            yMin = config.yMin;
            yMax = config.yMax;
        } else {
            const dataMin = Math.min(...channelData);
            const dataMax = Math.max(...channelData);
            const range = dataMax - dataMin;
            yMin = config.yMin !== null ? config.yMin : dataMin - range * 0.1;
            yMax = config.yMax !== null ? config.yMax : dataMax + range * 0.1;
        }

        // Créer l'échelle Y
        chart.options.scales[config.yAxisID] = {
            type: 'linear',
            position: config.yAxisPosition,
            display: config.yAxisPosition !== 'hidden',
            min: yMin,
            max: yMax,
            grid: {
                color: '#333',
                drawOnChartArea: config.yAxisPosition === 'left' // Seulement la première échelle affiche la grille
            },
            ticks: {
                color: config.color,
                font: {
                    size: 12,
                    weight: 'normal'
                }
            },
            title: {
                display: true,
                text: config.label + (config.unit ? ` (${config.unit})` : ''),
                color: config.color,
                font: {
                    size: 13,
                    weight: 'normal'
                }
            }
        };
    });

    // IMPORTANT: Créer une échelle 'y' pour compatibilité avec curseurs et annotations
    // Cette échelle est un alias de la première échelle visible
    if (visibleChannels.length > 0) {
        const firstChannel = visibleChannels[0];
        const firstChannelData = appState.allColumnData[firstChannel.index];

        // Calculer min/max pour la première échelle
        let yMin, yMax;
        if (firstChannel.yMin !== null && firstChannel.yMax !== null) {
            yMin = firstChannel.yMin;
            yMax = firstChannel.yMax;
        } else {
            const dataMin = Math.min(...firstChannelData);
            const dataMax = Math.max(...firstChannelData);
            const range = dataMax - dataMin;
            yMin = firstChannel.yMin !== null ? firstChannel.yMin : dataMin - range * 0.1;
            yMax = firstChannel.yMax !== null ? firstChannel.yMax : dataMax + range * 0.1;
        }

        // Créer l'échelle 'y' pour compatibilité
        chart.options.scales.y = {
            type: 'linear',
            position: 'left',
            display: false, // Cachée car on affiche déjà y0
            min: yMin,
            max: yMax
        };
    }

    chart.update();

    // Mettre à jour les annotations
    if (typeof updateAnnotationsDisplay === 'function') {
        setTimeout(updateAnnotationsDisplay, 50);
    }

    return true; // Mode multi-canaux activé
}
