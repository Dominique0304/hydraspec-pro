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
        visible: index === 0, // Seul le premier canal est visible par défaut
        color: DEFAULT_CHANNEL_COLORS[index % DEFAULT_CHANNEL_COLORS.length],
        yAxisPosition: index === 0 ? 'left' : 'right',  // Premier à gauche, autres à droite
        yMin: null,  // Auto
        yMax: null,  // Auto
        yAxisID: `y${index}`
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

        row.appendChild(visibleCell);
        row.appendChild(nameCell);
        row.appendChild(colorCell);
        row.appendChild(posCell);
        row.appendChild(yMinCell);
        row.appendChild(yMaxCell);

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
