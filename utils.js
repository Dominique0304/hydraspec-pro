// --- UTILITY FUNCTIONS ---

// --- SIGNAL GENERATOR ---
function addFreqRow(f = 50, a = 1, p = 0) {
    const div = document.createElement('div');
    div.className = 'row-removable';
    div.innerHTML = `<input type="number" class="gen-f" value="${f}"><input type="number" class="gen-a" value="${a}"><input type="number" class="gen-p" value="${p}"><button onclick="this.parentElement.remove()" class="btn-small" style="background:#f44336;">&times;</button>`;
    document.getElementById('freq-inputs-container').appendChild(div);
}

function generateSignal() {
    const fs = parseFloat(document.getElementById('gen-fs').value);
    const duration = parseFloat(document.getElementById('gen-duration').value);
    const noise = parseFloat(document.getElementById('gen-noise').value);
    const dc = parseFloat(document.getElementById('gen-dc').value);

    appState.fs = fs;
    appState.timeIncrement = 1000 / fs; // Calcul de l'incrément
    document.getElementById('display-fs').textContent = fs + " Hz";
    document.getElementById('manual-step').value = (1000 / fs).toFixed(2);
    document.getElementById('display-increment').textContent = appState.timeIncrement.toFixed(2) + " ms";

    const n = Math.floor(fs * duration);
    const t = new Float32Array(n);
    const v = new Float32Array(n);
    const rows = document.querySelectorAll('#freq-inputs-container .row-removable');

    for (let i = 0; i < n; i++) {
        const time = i / fs;
        t[i] = time * 1000;
        let val = dc;
        rows.forEach(r => {
            val += parseFloat(r.querySelector('.gen-a').value) * Math.sin(2 * Math.PI * parseFloat(r.querySelector('.gen-f').value) * time + parseFloat(r.querySelector('.gen-p').value) * Math.PI / 180);
        });
        v[i] = val + (Math.random() - 0.5) * 2 * noise;
    }
    appState.fullDataTime = t;
    appState.fullDataPressure = v;
    appState.cursorStart = duration * 0.2;
    appState.cursorEnd = duration * 0.8;

    // RÉINITIALISER LE LABEL POUR LES SIGNAUX GÉNÉRÉS
    appState.yAxisLabel = "Pression (Bar)";

    updateTimeChart();
    updateStats();
    performAnalysis();
    updateSpectrogram();
    closeModal('genModal');

    // RÉINITIALISER LE SYSTÈME DE COLONNES
    appState.availableColumns = [];
    appState.currentColumnIndex = 0;
    appState.allColumnData = [];
    appState.yAxisLabel = "Pression (Bar)";

    // MASQUER LE SÉLECTEUR DE COLONNES
    const selectorRow = document.getElementById('column-selector-row');
    if (selectorRow) selectorRow.style.display = 'none';

    updateTimeChart();
    updateStats();
    performAnalysis();
    updateSpectrogram();
    closeModal('genModal');
}

// --- FILE HANDLING ---
function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const content = e.target.result;
            const lines = content.split('\n').filter(l => l.trim());

            if (lines.length < 2) {
                setStatus("Fichier CSV invalide");
                return;
            }

            // METTRE À JOUR LE TITRE AVEC LE NOM DU FICHIER
            const fileNameWithoutExtension = file.name.replace(/\.[^/.]+$/, "");
            setAcquisitionTitle(fileNameWithoutExtension);

            // Détection du séparateur
            const firstLine = lines[0];
            let separator = firstLine.includes(';') ? ';' :
                firstLine.includes(',') ? ',' :
                    firstLine.includes('\t') ? '\t' : ';';

            // Vérifier l'en-tête
            const hasHeader = isNaN(parseFloat(firstLine.split(separator)[0]));

            // Extraire les noms de colonnes
            let columnNames = [];
            let startLine = 0;

            if (hasHeader) {
                columnNames = firstLine.split(separator).map(part => part.trim());
                startLine = 1;
                console.log("Colonnes détectées:", columnNames);
            } else {
                const firstData = lines[0].split(separator);
                columnNames = ['Temps'];
                for (let i = 1; i < firstData.length; i++) {
                    columnNames.push(`Colonne ${i}`);
                }
            }

            // Préparer le stockage des données
            const allData = Array.from({ length: columnNames.length }, () => []);
            let validLines = 0;

            // Parser les données
            for (let i = startLine; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const parts = line.split(separator);
                if (parts.length >= columnNames.length) {
                    let isValid = true;

                    for (let j = 0; j < columnNames.length; j++) {
                        const val = parseFloat(parts[j].replace(',', '.'));
                        if (isNaN(val)) {
                            isValid = false;
                            break;
                        }
                        allData[j].push(val);
                    }

                    if (isValid) validLines++;
                }
            }

 if (validLines > 1) {
    // CONFIGURER L'ÉTAT
    appState.columnNames = columnNames;
    appState.allColumnData = allData;
    appState.availableColumns = [];
    
    // Préparer les colonnes disponibles (sauf temps)
    for (let i = 1; i < columnNames.length; i++) {
        let label = columnNames[i].replace(/\[.*?\]/g, '').trim();
        const unitMatch = columnNames[i].match(/\[(.*?)\]/);
        if (unitMatch && !label.includes('(')) {
            label += ` (${unitMatch[1]})`;
        }
        
        appState.availableColumns.push({
            index: i,
            name: columnNames[i],
            label: label
        });
    }
    
    appState.currentColumnIndex = 0;
    
    // Configurer les données temps
    const timeData = allData[0];
    
    // Convertir secondes → millisecondes
    const timeInMs = timeData.map(t => t * 1000);
    appState.fullDataTime = new Float32Array(timeInMs);
    
    // CALCULER L'INCRÉMENT ET Fs
    if (timeData.length >= 2) {
        // Calcul de l'incrément moyen (en secondes)
        let totalDiff = 0;
        let count = 0;
        
        for (let i = 1; i < timeData.length; i++) {
            const diff = timeData[i] - timeData[i-1];
            if (diff > 0) {
                totalDiff += diff;
                count++;
            }
        }
        
        const avgIncrementSec = count > 0 ? totalDiff / count : 0.001;
        const avgIncrementMs = avgIncrementSec * 1000;
        
        // Calculer Fs
        appState.fs = 1000 / avgIncrementMs;
        appState.timeIncrement = avgIncrementMs / 1000;
        
        // Mettre à jour l'interface
        document.getElementById('display-fs').textContent = appState.fs.toFixed(1) + " Hz";
        document.getElementById('manual-step').value = avgIncrementMs.toFixed(1);
        document.getElementById('display-increment').textContent = avgIncrementMs.toFixed(1) + " ms";
    } else {
        // Valeurs par défaut
        appState.fs = 1000;
        appState.timeIncrement = 0.001;
        document.getElementById('display-fs').textContent = "1000.0 Hz";
        document.getElementById('manual-step').value = "1.0";
        document.getElementById('display-increment').textContent = "1.0 ms";
    }
    
    document.getElementById('display-n').textContent = timeData.length;
    
    // Charger la première colonne
    loadCurrentColumnData();
    updateColumnSelector();
    
    setStatus(`Fichier chargé: ${validLines} points, ${appState.availableColumns.length} colonnes, Fs: ${appState.fs.toFixed(1)} Hz`);
    
} else {
    setStatus("Données insuffisantes");
}
        } catch (error) {
            console.error("Erreur chargement CSV:", error);
            setStatus("Erreur lors du chargement");
        }
    };
    reader.onerror = function () {
        setStatus("Erreur lecture fichier");
    };
    reader.readAsText(file);
    input.value = '';
}

function handleProjectUpload(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        const d = JSON.parse(e.target.result);
        appState.fs = d.appState.fs;
        appState.cursorStart = d.appState.cursorStart;
        appState.cursorEnd = d.appState.cursorEnd;
        appState.timeIncrement = d.appState.timeIncrement || 1000 / appState.fs;
        appState.fullDataTime = new Float32Array(d.data.time);
        appState.fullDataPressure = new Float32Array(d.data.values);
        document.getElementById('user-notes').value = d.notes || "";
        document.getElementById('display-fs').textContent = appState.fs + " Hz";
        document.getElementById('display-increment').textContent = appState.timeIncrement.toFixed(2) + " ms";
        updateTimeChart();
        updateStats();
        performAnalysis();
        updateSpectrogram();
        setStatus("Projet chargé.");
    };
    reader.readAsText(file);
    input.value = '';
}

// --- EXPORT SYSTEM ---
function initSaveProject() {
    if (!appState.fullDataTime.length) {
        alert("Aucune donnée.");
        return;
    }
    appState.currentExportAction = 'save';
    prepareFilename();
    openModal('filenameModal');
    setupExportButton(); // S'assurer que le bouton est configuré
}

function initExportData() {
    if (!appState.fullDataTime.length) {
        alert("Aucune donnée.");
        return;
    }
    appState.currentExportAction = 'exportCsv';
    prepareFilename();
    openModal('filenameModal');
    setupExportButton(); // S'assurer que le bouton est configuré
}

function initCaptureScreenshot() {
    if (!appState.fullDataTime.length) {
        alert("Aucune donnée.");
        return;
    }
    appState.currentExportAction = 'exportPng';
    prepareFilename();
    openModal('filenameModal');
    setupExportButton(); // S'assurer que le bouton est configuré
}

function prepareFilename() {
    const now = new Date();
    const d = now.toISOString().slice(0, 10);
    const t = now.toTimeString().slice(0, 8).replace(/:/g, "-");
    let note = "data";
    const notesVal = document.getElementById('user-notes').value;
    if (notesVal && notesVal.trim()) {
        note = notesVal.split('\n')[0].replace(/[^a-z0-9_\- ]/gi, '').substring(0, 200);
    }
    document.getElementById('export-filename').value = `${d}_${t}_${note}`;
}

// ✅ CORRECTION : Gestion robuste du bouton d'export
function setupExportButton() {
    const exportBtn = document.getElementById('confirm-export-btn');
    if (exportBtn) {
        // Nettoyer les anciens événements
        exportBtn.replaceWith(exportBtn.cloneNode(true));

        // Réattacher le nouvel événement
        const newBtn = document.getElementById('confirm-export-btn');
        newBtn.onclick = function () {
            handleExportConfirm();
        };

        console.log("✅ Bouton d'export configuré");
    } else {
        console.log("⏳ Bouton pas encore disponible, réessai...");
        setTimeout(setupExportButton, 100);
    }
}

function handleExportConfirm() {
    const name = document.getElementById('export-filename').value;
    if (!name) {
        setStatus("Veuillez entrer un nom de fichier");
        return;
    }

    console.log("🔄 Début export - Action:", appState.currentExportAction, "Nom:", name);

    try {
        if (appState.currentExportAction === 'save') {
            performSaveProject(name);
        } else if (appState.currentExportAction === 'exportCsv') {
            performExportCsv(name);
        } else if (appState.currentExportAction === 'exportPng') {
            performCapture(name);
        } else {
            console.error("❌ Action inconnue:", appState.currentExportAction);
            setStatus("Erreur: type d'export inconnu");
            return;
        }

        closeModal('filenameModal');
        console.log("✅ Export terminé avec succès");

    } catch (error) {
        console.error("❌ Erreur lors de l'export:", error);
        setStatus("Erreur lors de l'export");
    }
}

function performSaveProject(filename) {
    const projectData = {
        version: "1.4.0",
        date: new Date().toISOString(),
        appState: {
            fs: appState.fs,
            cursorStart: appState.cursorStart,
            cursorEnd: appState.cursorEnd,
            timeIncrement: appState.timeIncrement
        },
        data: {
            time: Array.from(appState.fullDataTime),
            values: Array.from(appState.fullDataPressure)
        },
        notes: document.getElementById('user-notes').value
    };
    const blob = new Blob([JSON.stringify(projectData)], { type: "application/json" });
    downloadBlob(blob, `${filename}.hsp`);
    setStatus("Projet enregistré.");
}

function performExportCsv(filename) {
    const startIdx = appState.fullDataTime.findIndex(t => t >= appState.cursorStart * 1000);
    let endIdx = appState.fullDataTime.findIndex(t => t >= appState.cursorEnd * 1000);
    if (endIdx === -1) endIdx = appState.fullDataTime.length;

    let content = "Temps(ms);Valeur(Bar)\n";
    for (let i = startIdx; i < endIdx; i++) {
        content += `${appState.fullDataTime[i].toFixed(2)};${appState.fullDataPressure[i].toFixed(4)}\n`;
    }

    downloadBlob(new Blob([content], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
    setStatus("Fichier CSV exporté.");
}

function performCapture(filename) {
    // Fermer toutes les modales
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
   
    // Attendre
    setTimeout(() => {
        // Capturer uniquement la zone principale sans la sidebar
        const mainContent = document.querySelector('.plots-area');
        const elementToCapture = mainContent || document.body;
        
        setStatus("Préparation de la capture...");
        
        html2canvas(elementToCapture, {
            scale: 1.5,
            useCORS: true,
            backgroundColor: getComputedStyle(document.body).backgroundColor
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = `${filename}.png`;
            link.href = canvas.toDataURL();
            link.click();
            setStatus("Capture réussie!");
        }).catch(err => {
            console.error(err);
            setStatus("Erreur: " + err.message);
        });
    }, 500);
}

// Fonction de secours pour capture simple
function attemptSimpleCapture(filename) {
    console.log("🔄 Tentative de capture simplifiée...");
    
    try {
        // Capture simple du body sans options complexes
        html2canvas(document.body, {
            scale: 1,
            useCORS: true,
            backgroundColor: '#ffffff'
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = `${filename}_simple.png`;
            link.href = canvas.toDataURL('image/png');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setStatus("Capture simplifiée effectuée");
        });
    } catch (error) {
        console.error("❌ Échec capture simplifiée:", error);
        setStatus("Échec complet de la capture");
    }
}

function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Initialiser au chargement
document.addEventListener('DOMContentLoaded', function () {
    console.log("🚀 Initialisation des exports...");
    setupExportButton();
});

// Événement pour le bouton de confirmation d'export
document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('confirm-export-btn').addEventListener('click', function () {
        const name = document.getElementById('export-filename').value;
        if (!name) return;

        if (appState.currentExportAction === 'save') performSaveProject(name);
        else if (appState.currentExportAction === 'exportCsv') performExportCsv(name);
        else if (appState.currentExportAction === 'exportPng') performCapture(name);

        closeModal('filenameModal');
    });
});

// --- GESTION DES COLONNES MULTIPLES ---

function loadCurrentColumnData() {
    if (!appState.availableColumns.length) return;

    const currentCol = appState.availableColumns[appState.currentColumnIndex];
    const columnData = appState.allColumnData[currentCol.index];

    appState.fullDataPressure = new Float32Array(columnData);
    appState.yAxisLabel = currentCol.label;

    console.log("Chargement colonne:", currentCol.label, "données:", columnData.length);

    updateTimeChart();
    updateStats();
    performAnalysis();
    updateSpectrogram();
}

function updateColumnSelector() {
    const selector = document.getElementById('column-selector');
    const row = document.getElementById('column-selector-row');

    if (!selector || !row) {
        console.error("Élément selecteur non trouvé!");
        return;
    }

    if (appState.availableColumns.length > 1) {
        row.style.display = 'flex';
        selector.innerHTML = '';

        appState.availableColumns.forEach((col, idx) => {
            const option = document.createElement('option');
            option.value = idx;
            option.textContent = col.label;
            selector.appendChild(option);
        });

        selector.value = appState.currentColumnIndex;
        console.log("Sélecteur mis à jour avec", appState.availableColumns.length, "colonnes");
    } else {
        row.style.display = 'none';
    }
}

function changeCurrentColumn(index) {
    if (index >= 0 && index < appState.availableColumns.length) {
        appState.currentColumnIndex = index;
        loadCurrentColumnData();
        
        // ✅ NOUVEAU : Mettre à jour l'affichage des annotations
        if (typeof updateAnnotationsDisplay === 'function') {
            updateAnnotationsDisplay();
        }
    }
}
function calculateFsFromTimeData(timeData) {
    if (timeData.length < 2) return 1000; // Valeur par défaut

    // Calculer la différence moyenne entre échantillons
    let totalDiff = 0;
    let validPairs = 0;

    for (let i = 1; i < timeData.length; i++) {
        const diff = timeData[i] - timeData[i - 1];
        if (diff > 0) {
            totalDiff += diff;
            validPairs++;
        }
    }

    if (validPairs === 0 || totalDiff === 0) return 1000;

    const avgDiffMs = (totalDiff / validPairs) * 1000; // en ms
    return avgDiffMs > 0 ? 1000 / avgDiffMs : 1000;
}
