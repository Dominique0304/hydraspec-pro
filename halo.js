document.addEventListener('DOMContentLoaded', () => {
    // 1. Création de l'élément HTML du halo
    const halo = document.createElement('div');
    halo.id = 'mouse-halo';
    document.body.appendChild(halo);

    // Variables pour la position
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let haloX = mouseX;
    let haloY = mouseY;
    
    // Variables d'état
    let isInTimeDomain = false;
    let isNearCursor = false;
    
    // Pour l'effet de "traîne" (Lerp : Linear Interpolation)
    const delay = 1.;
    
    // Dimensions de base
    const baseSize = 50; // px
    const reducedSize = 25; // px pour Shift/Ctrl
    const cursorNearSize = 20; // px près des curseurs
    const clickSize = 15; // px pour clic
    const magnetZone = 15; // pixels de zone magnétique

    // Fonction pour obtenir la position réelle des curseurs en pixels écran
    function getCursorPositionsInPixels() {
        if (!appState || !appState.charts || !appState.charts.time) {
            return { start: null, end: null };
        }
        
        const timeCanvas = document.getElementById('timeChart');
        if (!timeCanvas) return { start: null, end: null };
        
        const chart = appState.charts.time;
        const canvasRect = timeCanvas.getBoundingClientRect();
        
        // Convertir les positions temporelles en pixels dans le canvas
        const cursorStartMs = appState.cursorStart * 1000;
        const cursorEndMs = appState.cursorEnd * 1000;
        
        // Obtenir les positions relatives dans le canvas
        const cursorStartRelative = chart.scales.x.getPixelForValue(cursorStartMs);
        const cursorEndRelative = chart.scales.x.getPixelForValue(cursorEndMs);
        
        // Convertir en positions absolues dans la fenêtre
        const cursorStartAbsolute = canvasRect.left + cursorStartRelative;
        const cursorEndAbsolute = canvasRect.left + cursorEndRelative;
        
        return {
            start: cursorStartAbsolute,
            end: cursorEndAbsolute
        };
    }

    // Fonction pour vérifier la proximité avec les curseurs
    function checkCursorProximity() {
        if (!isInTimeDomain) {
            isNearCursor = false;
            return;
        }
        
        const cursorPositions = getCursorPositionsInPixels();
        if (cursorPositions.start === null || cursorPositions.end === null) {
            isNearCursor = false;
            return;
        }
        
        // Vérifier la distance aux curseurs
        const distToStart = Math.abs(mouseX - cursorPositions.start);
        const distToEnd = Math.abs(mouseX - cursorPositions.end);
        
        // Vérifier aussi la position Y (doit être dans la zone du graphique)
        const timeCanvas = document.getElementById('timeChart');
        const canvasRect = timeCanvas.getBoundingClientRect();
        const isInYRange = mouseY >= canvasRect.top && mouseY <= canvasRect.bottom;
        
        // Être proche d'un curseur ET dans la zone Y du graphique
        isNearCursor = isInYRange && (distToStart <= magnetZone || distToEnd <= magnetZone);
        
        // Debug (optionnel)
        if (isNearCursor && Math.random() < 0.05) { // Éviter la console spam
            console.log("Proche d'un curseur!", {
                mouseX, mouseY,
                start: cursorPositions.start,
                end: cursorPositions.end,
                distToStart, distToEnd
            });
        }
    }

    // 2. Écouteur de mouvement de souris avec vérification de zone
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        
        // Vérifier si la souris est dans le domaine temporel
        const timeCanvas = document.getElementById('timeChart');
        if (timeCanvas) {
            const rect = timeCanvas.getBoundingClientRect();
            isInTimeDomain = mouseX >= rect.left && mouseX <= rect.right &&
                            mouseY >= rect.top && mouseY <= rect.bottom;
        } else {
            isInTimeDomain = false;
        }
        
        // Vérifier la proximité avec les curseurs
        checkCursorProximity();
        
        // Mettre à jour la visibilité
        halo.style.opacity = isInTimeDomain ? '1' : '0';
        
        // Mettre à jour le style en fonction de l'état
        updateHaloStyle();
    });

    // 3. Écouteurs pour les touches Shift et Ctrl
    let isShiftPressed = false;
    let isCtrlPressed = false;
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Shift') {
            isShiftPressed = true;
            updateHaloStyle();
        } else if (e.key === 'Control') {
            isCtrlPressed = true;
            updateHaloStyle();
        }
    });
    
    document.addEventListener('keyup', (e) => {
        if (e.key === 'Shift') {
            isShiftPressed = false;
            updateHaloStyle();
        } else if (e.key === 'Control') {
            isCtrlPressed = false;
            updateHaloStyle();
        }
    });

    // 4. Gestion de la sortie de la fenêtre
    document.addEventListener('mouseout', (e) => {
        if (!e.relatedTarget && !e.toElement) {
            halo.style.opacity = '0';
        }
    });

    // 5. Effet visuel au clic
    document.addEventListener('mousedown', (e) => {
        if (isInTimeDomain) {
            // Vérifier si Shift + clic dans la zone d'analyse
            const cursorPositions = getCursorPositionsInPixels();
            if (cursorPositions.start !== null && cursorPositions.end !== null) {
                // Vérifier si clic entre les curseurs
                const isBetweenCursors = mouseX > cursorPositions.start && mouseX < cursorPositions.end;
                
                if (isShiftPressed && isBetweenCursors) {
                    // Shift + clic entre curseurs : rouge et rapetissement
                    halo.classList.add('clicking');
                    halo.style.borderColor = '#f44336'; // Rouge
                    halo.style.boxShadow = '0 0 25px #f44336, inset 0 0 5px #f44336';
                    halo.style.width = `${clickSize}px`;
                    halo.style.height = `${clickSize}px`;
                } else {
                    // Clic normal : rouge et rapetissement
                    halo.classList.add('clicking');
                    halo.style.width = `${clickSize}px`;
                    halo.style.height = `${clickSize}px`;
                }
            }
        }
    });

    document.addEventListener('mouseup', () => {
        halo.classList.remove('clicking');
        updateHaloStyle(); // Restaurer le style normal
    });

    // 6. Fonction pour mettre à jour le style du halo
    function updateHaloStyle() {
        if (!isInTimeDomain) {
            halo.style.opacity = '0';
            return;
        }
        
        // Déterminer la couleur en fonction des touches
        let color = getComputedStyle(document.documentElement)
            .getPropertyValue('--accent-blue').trim() || '#2196F3';
        
        if (isShiftPressed) {
            color = '#4CAF50'; // Vert
        } else if (isCtrlPressed) {
            color = '#FFD700'; // Jaune
        }
        
        // Déterminer la taille en fonction de l'état
        let size = baseSize;
        
        if (isNearCursor) {
            // Priorité à la proximité des curseurs
            size = cursorNearSize;
        } else if (isShiftPressed || isCtrlPressed) {
            size = reducedSize;
        }
        
        // Si en train de cliquer, garder la taille de clic
        if (halo.classList.contains('clicking')) {
            size = clickSize;
            color = '#f44336'; // Rouge pour le clic
        }
        
        // Appliquer les styles
        halo.style.borderColor = color;
        halo.style.boxShadow = `0 0 15px ${color}, inset 0 0 10px ${color}`;
        halo.style.width = `${size}px`;
        halo.style.height = `${size}px`;
        
        // Debug visuel pour la zone magnétique
        if (isNearCursor) {
            halo.style.borderStyle = 'dotted';
        } else {
            // Rétablir le style selon le thème
            const theme = document.body.getAttribute('data-theme');
            if (theme === 'steampunk' || theme === 'steampunk2') {
                halo.style.borderStyle = 'dashed';
            } else {
                halo.style.borderStyle = 'solid';
            }
        }
    }

    // 7. Vérifier périodiquement la position (pour les mises à jour d'état)
    function periodicCheck() {
        if (isInTimeDomain) {
            checkCursorProximity();
            updateHaloStyle();
        }
        
        requestAnimationFrame(periodicCheck);
    }

    // 8. Boucle d'animation pour le mouvement fluide
    function animateHalo() {
        // Calcul de la position avec interpolation
        haloX += (mouseX - haloX) * delay;
        haloY += (mouseY - haloY) * delay;

        // Application de la position
        halo.style.left = `${haloX}px`;
        halo.style.top = `${haloY}px`;


        requestAnimationFrame(animateHalo);
    }

    // 9. Écouteur pour les changements de graphique (curseurs déplacés)
    function setupCursorChangeListener() {
        // Surveiller les changements d'état des curseurs
        const originalUpdateStats = window.updateStats;
        if (originalUpdateStats) {
            window.updateStats = function() {
                originalUpdateStats.apply(this, arguments);
                // Après mise à jour des stats (curseurs déplacés), recalculer la proximité
                if (isInTimeDomain) {
                    checkCursorProximity();
                    updateHaloStyle();
                }
            };
        }
        
        // Écouter les mises à jour du graphique temporel
        const timeChart = appState?.charts?.time;
        if (timeChart) {
            const originalUpdate = timeChart.update;
            timeChart.update = function(mode) {
                const result = originalUpdate.apply(this, arguments);
                // Après mise à jour du graphique
                setTimeout(() => {
                    if (isInTimeDomain) {
                        checkCursorProximity();
                        updateHaloStyle();
                    }
                }, 10);
                return result;
            };
        }
    }

    // 10. Lancer tout
    halo.style.transform = 'translate(-50%, -50%)';
    animateHalo();
    periodicCheck();
    setTimeout(setupCursorChangeListener, 1000); // Attendre que l'application soit chargée
    
    // Forcer une première mise à jour
    setTimeout(() => {
        updateHaloStyle();
    }, 500);
});