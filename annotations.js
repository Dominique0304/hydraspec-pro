// --- ANNOTATIONS SYSTEM ---

// Variables globales pour le système d'annotations
let annotations = [];
let isCreatingAnnotation = false;
let tempAnnotation = null;
let currentHoveredAnnotation = null;
let annotationConnectorLines = [];
let annotationsVisible = true; // nouvelle variable pour la visibilité globale
let isDraggingMarker = false; // nouveau flag pour déplacement du marqueur
let draggedMarkerAnnotation = null; // annotation dont on déplace le marqueur

class Annotation {
    constructor(id, time, yValue, text, color = '#FFD700') {
        this.id = id;
        this.time = time; // en secondes
        this.yValue = yValue; // valeur Y du point
        this.text = text;
        this.color = color;
        this.width = 200;
        this.height = 100;
        this.offsetX = 20; // décalage par rapport au point
        this.offsetY = -50; // décalage par rapport au point
        this.pinned = false; // si l'annotation suit le défilement
        this.createdAt = Date.now();
        this.zIndex = 1000 + annotations.length;
        this.visible = true; // visibilité de l'annotation
        this.columnIndex = appState.currentColumnIndex; // canal d'origine
    }

    // Calcule la position en pixels sur le canvas
    getPixelPosition(chart) {
        if (!chart || !chart.scales) return { x: 0, y: 0 };
        
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;
        
        return {
            x: xScale.getPixelForValue(this.time * 1000), // conversion s → ms
            y: yScale.getPixelForValue(this.yValue)
        };
    }

    // Vérifie si la souris est sur l'annotation
    isMouseOver(mouseX, mouseY, chart) {
        if (!chart) return false;
        
        const pos = this.getPixelPosition(chart);
        const annotationRect = {
            x: pos.x + this.offsetX,
            y: pos.y + this.offsetY,
            width: this.width,
            height: this.height
        };
        
        return mouseX >= annotationRect.x && 
               mouseX <= annotationRect.x + annotationRect.width &&
               mouseY >= annotationRect.y && 
               mouseY <= annotationRect.y + annotationRect.height;
    }
}

// Initialiser le système d'annotations
function initAnnotationSystem() {
    console.log("🔧 Initialisation du système d'annotations...");
    
    // Récupérer le canvas du graphique temporel
    const timeCanvas = document.getElementById('timeChart');
    if (!timeCanvas) {
        console.error("Canvas timeChart non trouvé");
        return;
    }
    
    // Créer le conteneur pour les annotations
    const annotationContainer = document.createElement('div');
    annotationContainer.id = 'annotation-container';
    annotationContainer.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 50;
        overflow: visible;
    `;
    
    // Ajouter au conteneur du graphique
    const timeContainer = document.getElementById('time-container');
    if (timeContainer) {
        const plotArea = timeContainer.querySelector('div[style*="flex:1"]');
        if (plotArea) {
            plotArea.style.position = 'relative';
            plotArea.appendChild(annotationContainer);
        }
    }
    
    // Événements pour la création d'annotations
    setupAnnotationEvents(timeCanvas);
    
    // Mode annotation dans la barre d'outils
    addAnnotationToToolbar();
    
    console.log("✅ Système d'annotations initialisé");
}

// Ajouter le bouton d'annotation dans la toolbar
function addAnnotationToToolbar() {
    const toolbar = document.querySelector('.plot-toolbar');
    if (!toolbar) return;
    
    // Bouton mode annotation
    const annotationBtn = document.createElement('button');
    annotationBtn.className = 'icon-btn';
    annotationBtn.id = 'annotation-btn';
    annotationBtn.innerHTML = '<i class="fas fa-comment-medical"></i>';
    annotationBtn.title = 'Mode Annotation (A) - Ctrl+Clic sur marqueur pour déplacer';
    annotationBtn.style.marginLeft = '5px';
    
    annotationBtn.onclick = function() {
        toggleAnnotationMode();
    };
    
    // Bouton toggle visibilité
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'icon-btn';
    toggleBtn.id = 'toggle-annotations-btn';
    toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
    toggleBtn.title = 'Afficher/Masquer toutes les annotations';
    toggleBtn.style.marginLeft = '5px';
    toggleBtn.style.backgroundColor = 'var(--accent-blue)';
    toggleBtn.style.color = 'white';
    
    toggleBtn.onclick = function() {
        toggleAllAnnotations();
    };
    
    const controlsDiv = toolbar.querySelector('.toolbar-controls');
    if (controlsDiv) {
        controlsDiv.appendChild(annotationBtn);
        controlsDiv.appendChild(toggleBtn);
    } else {
        toolbar.appendChild(annotationBtn);
        toolbar.appendChild(toggleBtn);
    }
}

// Basculer le mode annotation
function toggleAnnotationMode() {
    isCreatingAnnotation = !isCreatingAnnotation;
    const btn = document.getElementById('annotation-btn');
    
    if (isCreatingAnnotation) {
        btn.style.backgroundColor = 'var(--accent-green)';
        btn.style.color = 'white';
        setStatus('Mode annotation activé - Cliquez sur un point du signal');
    } else {
        btn.style.backgroundColor = '';
        btn.style.color = '';
        setStatus('Mode annotation désactivé');
    }
}

// Fonction pour afficher/masquer toutes les annotations
function toggleAllAnnotations() {
    annotationsVisible = !annotationsVisible;
    
    const btn = document.getElementById('toggle-annotations-btn');
    if (btn) {
        if (annotationsVisible) {
            btn.style.backgroundColor = 'var(--accent-blue)';
            btn.style.color = 'white';
            btn.title = 'Masquer toutes les annotations';
        } else {
            btn.style.backgroundColor = '';
            btn.style.color = '';
            btn.title = 'Afficher toutes les annotations';
        }
    }
    
    updateAnnotationsDisplay();
    setStatus(annotationsVisible ? 'Annotations affichées' : 'Annotations masquées');
}

// Configurer les événements pour les annotations
function setupAnnotationEvents(canvas) {
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let draggedAnnotation = null;
    
    // Clic pour créer une annotation
    canvas.addEventListener('click', function(e) {
        if (!isCreatingAnnotation && !isDraggingMarker) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Récupérer les données du point cliqué
        const chart = appState.charts.time;
        if (!chart) return;
        
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;
        
        const timeValue = xScale.getValueForPixel(x);
        const yValue = yScale.getValueForPixel(y);
        
        if (timeValue && yValue !== undefined) {
            if (isCreatingAnnotation) {
                createAnnotation(timeValue / 1000, yValue); // conversion ms → s
            } else if (isDraggingMarker && draggedMarkerAnnotation) {
                // Mettre à jour la position du marqueur
                updateAnnotationMarkerPosition(draggedMarkerAnnotation, timeValue / 1000, yValue);
                isDraggingMarker = false;
                draggedMarkerAnnotation = null;
                canvas.style.cursor = 'default';
            }
        }
    });
    
    // Double-clic sur le CANVAS pour ÉDITER une annotation
    canvas.addEventListener('dblclick', function(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Chercher si on clique sur une annotation
        const chart = appState.charts.time;
        const annotation = findAnnotationAtPosition(x, y, chart);
        
        if (annotation) {
            editAnnotation(annotation);
            e.stopPropagation();
        }
    });
    
    // Événements de souris pour le drag & drop
    canvas.addEventListener('mousedown', function(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const chart = appState.charts.time;
        
        // Vérifier si on clique sur un marqueur
        const markerAnnotation = findMarkerAtPosition(x, y, chart);
        if (markerAnnotation && e.ctrlKey) {
            // Ctrl + clic sur marqueur = déplacer le marqueur
            isDraggingMarker = true;
            draggedMarkerAnnotation = markerAnnotation;
            canvas.style.cursor = 'crosshair';
            e.stopPropagation();
            return;
        }
        
        const annotation = findAnnotationAtPosition(x, y, chart);
        
        if (annotation && !isCreatingAnnotation) {
            draggedAnnotation = annotation;
            isDragging = true;
            dragStartX = x - annotation.offsetX;
            dragStartY = y - annotation.offsetY;
            annotation.zIndex = 2000; // Mettre au premier plan
            updateAnnotationsDisplay();
            e.stopPropagation();
        }
    });
    
    canvas.addEventListener('mousemove', function(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Mise à jour du survol
        const chart = appState.charts.time;
        const hovered = findAnnotationAtPosition(x, y, chart);
        
        if (hovered !== currentHoveredAnnotation) {
            if (currentHoveredAnnotation) {
                updateAnnotationStyle(currentHoveredAnnotation, false);
            }
            currentHoveredAnnotation = hovered;
            if (hovered) {
                updateAnnotationStyle(hovered, true);
            }
        }
        
        // Changer le curseur si on survole un marqueur avec Ctrl
        if (e.ctrlKey) {
            const markerAnnotation = findMarkerAtPosition(x, y, chart);
            if (markerAnnotation) {
                canvas.style.cursor = 'crosshair';
            } else if (!isDragging) {
                canvas.style.cursor = 'default';
            }
        }
        
        // Drag & drop
        if (isDragging && draggedAnnotation) {
            draggedAnnotation.offsetX = x - dragStartX;
            draggedAnnotation.offsetY = y - dragStartY;
            updateAnnotationsDisplay();
        }
    });
    
    canvas.addEventListener('mouseup', function() {
        if (isDragging && draggedAnnotation) {
            // Sauvegarder la position
            saveAnnotations();
        }
        isDragging = false;
        draggedAnnotation = null;
    });
    
    canvas.addEventListener('mouseleave', function() {
        isDragging = false;
        draggedAnnotation = null;
        isDraggingMarker = false;
        draggedMarkerAnnotation = null;
        canvas.style.cursor = 'default';
        if (currentHoveredAnnotation) {
            updateAnnotationStyle(currentHoveredAnnotation, false);
            currentHoveredAnnotation = null;
        }
    });
    
    // Raccourci clavier pour le mode annotation
    document.addEventListener('keydown', function(e) {
        if (e.key === 'a' || e.key === 'A') {
            toggleAnnotationMode();
        }
        
        // Échap pour annuler
        if (e.key === 'Escape' && (isCreatingAnnotation || isDraggingMarker)) {
            isCreatingAnnotation = false;
            isDraggingMarker = false;
            draggedMarkerAnnotation = null;
            const btn = document.getElementById('annotation-btn');
            if (btn) {
                btn.style.backgroundColor = '';
                btn.style.color = '';
            }
            canvas.style.cursor = 'default';
            toggleAnnotationMode();
        }
    });
}

// Nouvelle fonction pour trouver un marqueur à une position
function findMarkerAtPosition(x, y, chart) {
    const markerRadius = 8; // Rayon élargi pour faciliter la sélection
    
    for (let i = annotations.length - 1; i >= 0; i--) {
        if (!annotations[i].visible) continue;
        
        const pos = annotations[i].getPixelPosition(chart);
        const distance = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
        
        if (distance <= markerRadius) {
            return annotations[i];
        }
    }
    return null;
}

// Nouvelle fonction pour mettre à jour la position du marqueur
function updateAnnotationMarkerPosition(annotation, newTime, newYValue) {
    annotation.time = newTime;
    annotation.yValue = newYValue;
    
    // Mettre à jour le texte avec les nouvelles valeurs
    const unit = appState.yAxisLabel || "Bar";
    annotation.text = `Annotation à ${newTime.toFixed(3)}s; ${newYValue.toFixed(2)} ${unit}`;
    
    updateAnnotationsDisplay();
    saveAnnotations();
    setStatus(`Marqueur déplacé: ${newTime.toFixed(3)}s, ${newYValue.toFixed(2)} ${unit}`);
}

// Trouver une annotation à une position donnée
function findAnnotationAtPosition(x, y, chart) {
    for (let i = annotations.length - 1; i >= 0; i--) {
        if (annotations[i].isMouseOver(x, y, chart)) {
            return annotations[i];
        }
    }
    return null;
}

// Créer une nouvelle annotation
function createAnnotation(time, yValue) {
    const id = 'ann-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    // Récupérer l'unité actuelle
    const unit = appState.yAxisLabel || "Bar";
    
    // Texte par défaut avec temps ET valeur
    const defaultText = `Annotation à ${time.toFixed(3)}s; ${yValue.toFixed(2)} ${unit}`;
    
    // Ouvrir une boîte de dialogue pour le texte
    const text = prompt('Entrez votre annotation :', defaultText);
    if (text === null || text.trim() === '') return;
    
    // Couleur aléatoire pour les annotations
    const colors = [
        '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', 
        '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'
    ];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    const annotation = new Annotation(id, time, yValue, text.trim(), color);
    annotations.push(annotation);
    
    // Désactiver le mode création
    isCreatingAnnotation = false;
    const btn = document.getElementById('annotation-btn');
    if (btn) {
        btn.style.backgroundColor = '';
        btn.style.color = '';
    }
    
    // Afficher l'annotation
    updateAnnotationsDisplay();
    
    // Sauvegarder dans le projet
    saveAnnotations();
    
    setStatus(`Annotation ajoutée à ${time.toFixed(3)}s (${yValue.toFixed(2)} ${unit})`);
    
    return annotation;
}

// Fonction pour modifier une annotation existante
function editAnnotation(annotation) {
    if (!annotation) return;

    // Pré-remplir avec le texte actuel
    const newText = prompt('Modifier l\'annotation :', annotation.text);
    
    if (newText === null) return; // Annulation
    
    if (newText.trim() === '') {
        // Si vide, on demande confirmation de suppression ? Ou on ne fait rien.
        // Ici on ne fait rien pour éviter les suppressions accidentelles
        return; 
    }

    annotation.text = newText.trim();
    
    updateAnnotationsDisplay();
    saveAnnotations();
    setStatus('Annotation modifiée');
}

// Mettre à jour l'affichage de toutes les annotations
function updateAnnotationsDisplay() {
    const container = document.getElementById('annotation-container');
    if (!container) return;
    
    // Supprimer toutes les annotations existantes
    container.innerHTML = '';
    annotationConnectorLines = [];
    
    const chart = appState.charts.time;
    if (!chart) return;
    
    // Filtrer les annotations selon le canal actuel
    const currentColumnIndex = appState.currentColumnIndex || 0;
    
    // Créer les éléments d'annotation
    annotations.forEach(annotation => {
        // Vérifier si l'annotation correspond au canal actuel
        const belongsToCurrentChannel = annotation.columnIndex === currentColumnIndex;
        
        // Masquer si canal différent OU si visibilité globale désactivée
        if (!belongsToCurrentChannel || !annotationsVisible) {
            annotation.visible = false;
            return;
        }
        
        annotation.visible = true;
        createAnnotationElement(annotation, chart, container);
    });
    
    // Dessiner les lignes de connexion
    drawAnnotationConnectors(chart);
}

// Créer un élément HTML pour une annotation
function createAnnotationElement(annotation, chart, container) {
    const pos = annotation.getPixelPosition(chart);
    if (!pos) return;
    
    // Créer l'élément annotation
    const annElement = document.createElement('div');
    annElement.className = 'annotation';
    annElement.id = annotation.id;
    annElement.dataset.annotationId = annotation.id;
    annElement.title = "Double-cliquez pour éditer"; // Infobulle
    
    // Position et style
    annElement.style.cssText = `
        position: absolute;
        left: ${pos.x + annotation.offsetX}px;
        top: ${pos.y + annotation.offsetY}px;
        width: ${annotation.width}px;
        height: ${annotation.height}px;
        background-color: ${annotation.color}20;
        border: 2px solid ${annotation.color};
        border-radius: 8px;
        padding: 10px;
        pointer-events: auto;
        cursor: move;
        z-index: ${annotation.zIndex};
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        backdrop-filter: blur(5px);
        transition: all 0.3s ease;
        overflow: hidden;
    `;

    // Événement Double-Clic pour Éditer DIRECTEMENT sur l'élément DOM
    annElement.addEventListener('dblclick', function(e) {
        e.stopPropagation(); // Empêcher la propagation au canvas
        editAnnotation(annotation);
    });
    
    // Contenu de l'annotation
    annElement.innerHTML = `
        <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            padding-bottom: 5px;
            border-bottom: 1px solid ${annotation.color}60;
        ">
            <div style="
                font-size: 0.75em;
                font-weight: bold;
                color: ${annotation.color};
            ">
                <i class="fas fa-sticky-note"></i> Annotation
            </div>
            <button class="annotation-close" 
                    title="Supprimer"
                    style="
                        background: none;
                        border: none;
                        color: ${annotation.color};
                        cursor: pointer;
                        font-size: 0.9em;
                        padding: 2px 5px;
                    ">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div style="
            font-size: 0.85em;
            color: var(--text-main);
            height: calc(100% - 40px);
            overflow-y: auto;
            word-wrap: break-word;
            cursor: text;
        ">
            ${annotation.text.replace(/\n/g, '<br>')}
        </div>
        <div style="
            position: absolute;
            bottom: 5px;
            right: 5px;
            font-size: 0.65em;
            color: var(--text-muted);
        ">
            ${(annotation.time).toFixed(3)}s
        </div>
    `;

    // Attacher l'événement de suppression au bouton X spécifiquement
    const closeBtn = annElement.querySelector('.annotation-close');
    closeBtn.addEventListener('click', function(e) {
        e.stopPropagation(); // Empêcher le drag ou l'edit
        deleteAnnotation(annotation.id);
    });

    // Événement double clic sur le texte pour éditer (redondance de sécurité)
    const textContent = annElement.querySelector('div[style*="overflow-y: auto"]');
    textContent.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        editAnnotation(annotation);
    });
    
    // Événements pour le redimensionnement
    setupAnnotationResize(annElement, annotation);
    
    // Ajouter au conteneur
    container.appendChild(annElement);
    
    // Stocker la ligne de connexion
    annotationConnectorLines.push({
        annotation: annotation,
        startX: pos.x,
        startY: pos.y,
        endX: pos.x + annotation.offsetX,
        endY: pos.y + annotation.offsetY
    });
}

// Configurer le redimensionnement des annotations
function setupAnnotationResize(element, annotation) {
    let isResizing = false;
    let startX, startY, startWidth, startHeight;
    
    const handleSize = 10;
    const resizeHandle = document.createElement('div');
    resizeHandle.style.cssText = `
        position: absolute;
        bottom: 0;
        right: 0;
        width: ${handleSize}px;
        height: ${handleSize}px;
        background-color: ${annotation.color};
        cursor: nwse-resize;
        border-radius: 2px;
        z-index: 10;
    `;
    
    element.appendChild(resizeHandle);
    
    resizeHandle.addEventListener('mousedown', function(e) {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = element.offsetWidth;
        startHeight = element.offsetHeight;
        e.stopPropagation();
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', function(e) {
        if (!isResizing) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        annotation.width = Math.max(150, startWidth + dx);
        annotation.height = Math.max(80, startHeight + dy);
        
        element.style.width = annotation.width + 'px';
        element.style.height = annotation.height + 'px';
        
        updateAnnotationsDisplay();
    });
    
    document.addEventListener('mouseup', function() {
        if (isResizing) {
            isResizing = false;
            saveAnnotations();
        }
    });
}

// Dessiner les lignes de connexion entre les annotations et les points
function drawAnnotationConnectors(chart) {
    const canvas = document.getElementById('timeChart');
    if (!canvas || !chart.ctx) return;
    
    const ctx = chart.ctx;
    
    // Sauvegarder le contexte
    ctx.save();
    
    annotationConnectorLines.forEach(line => {
        // Ne dessiner que si l'annotation est visible
        if (!line.annotation.visible) return;
        
        ctx.beginPath();
        ctx.moveTo(line.startX, line.startY);
        
        // Ligne avec une légère courbure
        const cp1x = line.startX + (line.endX - line.startX) * 0.5;
        const cp1y = line.startY;
        const cp2x = line.startX + (line.endX - line.startX) * 0.5;
        const cp2y = line.endY;
        
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, line.endX, line.endY);
        
        ctx.strokeStyle = line.annotation.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.globalAlpha = 1; // Toujours visible
        ctx.stroke();
        
        // Point d'ancrage (marqueur)
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(line.startX, line.startY, 6, 0, Math.PI * 2);
        ctx.fillStyle = line.annotation.color;
        ctx.globalAlpha = 1; // Toujours visible
        ctx.fill();
        
        // Bordure blanche pour meilleure visibilité
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
    });
    
    // Restaurer le contexte
    ctx.restore();
}

// Mettre à jour le style d'une annotation (survol)
function updateAnnotationStyle(annotation, isHovered) {
    const element = document.getElementById(annotation.id);
    if (!element) return;
    
    if (isHovered) {
        element.style.transform = 'scale(1.05)';
        element.style.boxShadow = `0 6px 20px rgba(0,0,0,0.4), 0 0 15px ${annotation.color}80`;
        element.style.zIndex = '2000';
    } else {
        element.style.transform = 'scale(1)';
        element.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        element.style.zIndex = annotation.zIndex.toString();
    }
}

// Supprimer une annotation
function deleteAnnotation(id) {
    if (!confirm('Supprimer cette annotation ?')) return;
    
    annotations = annotations.filter(ann => ann.id !== id);
    updateAnnotationsDisplay();
    saveAnnotations();
    setStatus('Annotation supprimée');
}

// Sauvegarder les annotations dans le projet
function saveAnnotations() {
    if (!appState) return;
    
    // Sauvegarder dans l'état de l'application
    appState.annotations = annotations.map(ann => ({
        id: ann.id,
        time: ann.time,
        yValue: ann.yValue,
        text: ann.text,
        color: ann.color,
        width: ann.width,
        height: ann.height,
        offsetX: ann.offsetX,
        offsetY: ann.offsetY,
        pinned: ann.pinned,
        columnIndex: ann.columnIndex
    }));
    
    // Mettre à jour les notes utilisateur
    updateUserNotesWithAnnotations();
}

// Charger les annotations sauvegardées
function loadAnnotations(savedAnnotations) {
    if (!savedAnnotations || !Array.isArray(savedAnnotations)) return;
    
    annotations = savedAnnotations.map(data => {
        const ann = new Annotation(data.id, data.time, data.yValue, data.text, data.color);
        ann.width = data.width || 200;
        ann.height = data.height || 100;
        ann.offsetX = data.offsetX || 20;
        ann.offsetY = data.offsetY || -50;
        ann.pinned = data.pinned || false;
        ann.columnIndex = data.columnIndex !== undefined ? data.columnIndex : 0;
        ann.visible = true;
        return ann;
    });
    
    updateAnnotationsDisplay();
}

// Mettre à jour les notes utilisateur avec le résumé des annotations
function updateUserNotesWithAnnotations() {
    const notesTextarea = document.getElementById('user-notes');
    if (!notesTextarea) return;
    
    let notes = notesTextarea.value;
    
    // Rechercher et mettre à jour la section annotations
    const annotationHeader = '=== ANNOTATIONS ===';
    const startIndex = notes.indexOf(annotationHeader);
    
    if (startIndex !== -1) {
        // Supprimer l'ancienne section
        const endIndex = notes.indexOf('===', startIndex + annotationHeader.length);
        if (endIndex !== -1) {
            notes = notes.substring(0, startIndex) + notes.substring(endIndex + 3);
        }
    }
    
    // Ajouter la nouvelle section si il y a des annotations
    if (annotations.length > 0) {
        let annotationSection = `\n\n${annotationHeader}\n`;
        annotations.forEach((ann, index) => {
            annotationSection += `${index + 1}. ${ann.time.toFixed(3)}s: ${ann.text}\n`;
        });
        annotationSection += '===';
        
        notes += annotationSection;
        notesTextarea.value = notes;
    }
}

// Exporter les annotations
function exportAnnotations() {
    if (annotations.length === 0) {
        alert('Aucune annotation à exporter');
        return;
    }
    
    let content = "Annotation Export - " + new Date().toLocaleString() + "\n\n";
    content += "Temps (s)\tValeur\tTexte\n";
    
    annotations.forEach(ann => {
        content += `${ann.time.toFixed(3)}\t${ann.yValue.toFixed(4)}\t"${ann.text}"\n`;
    });
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `annotations_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setStatus('Annotations exportées');
}

// Importer des annotations
function importAnnotations() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.json';
    
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const content = event.target.result;
                
                // Essayer de parser comme JSON d'abord
                try {
                    const data = JSON.parse(content);
                    if (Array.isArray(data)) {
                        loadAnnotations(data);
                        setStatus(`Annotations importées: ${data.length} trouvées`);
                        return;
                    }
                } catch (jsonError) {
                    // Ce n'est pas du JSON, essayer comme texte tabulé
                    console.log("Fichier texte détecté, tentative d'import...");
                }
                
                // Format texte tabulé
                const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
                const importedAnnotations = [];
                
                lines.forEach((line, index) => {
                    if (index === 0 && line.includes('Temps')) return; // Ignorer l'en-tête
                    
                    const parts = line.split('\t');
                    if (parts.length >= 3) {
                        const time = parseFloat(parts[0]);
                        const yValue = parseFloat(parts[1]);
                        const text = parts[2].replace(/"/g, '');
                        
                        if (!isNaN(time) && !isNaN(yValue)) {
                            importedAnnotations.push({
                                id: 'imported-' + Date.now() + '-' + index,
                                time: time,
                                yValue: yValue,
                                text: text,
                                color: '#FFD700'
                            });
                        }
                    }
                });
                
                if (importedAnnotations.length > 0) {
                    annotations = annotations.concat(importedAnnotations.map(data => {
                        return new Annotation(data.id, data.time, data.yValue, data.text, data.color);
                    }));
                    updateAnnotationsDisplay();
                    saveAnnotations();
                    setStatus(`Annotations importées: ${importedAnnotations.length} ajoutées`);
                } else {
                    alert('Aucune annotation valide trouvée dans le fichier');
                }
                
            } catch (error) {
                console.error('Erreur d\'import:', error);
                alert('Erreur lors de l\'import des annotations');
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

// Initialiser lors du chargement
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initAnnotationSystem, 1000); // Attendre que l'application soit chargée
    
    // Ajouter les fonctions d'export/import au menu Outils
    addAnnotationToolsToMenu();
});

// Ajouter les outils d'annotation au menu
function addAnnotationToolsToMenu() {
    setTimeout(() => {
        const toolsMenu = document.querySelector('.dropdown-content');
        if (!toolsMenu) return;
        
        const separator = document.createElement('div');
        separator.style.cssText = 'border-top:1px solid var(--border-color); margin:5px 0;';
        
        const exportBtn = document.createElement('button');
        exportBtn.innerHTML = '<i class="fas fa-file-export" style="width:20px;"></i> Exporter Annotations';
        exportBtn.onclick = exportAnnotations;
        
        const importBtn = document.createElement('button');
        importBtn.innerHTML = '<i class="fas fa-file-import" style="width:20px;"></i> Importer Annotations';
        importBtn.onclick = importAnnotations;
        
        const clearBtn = document.createElement('button');
        clearBtn.innerHTML = '<i class="fas fa-trash" style="width:20px;"></i> Effacer Annotations';
        clearBtn.onclick = function() {
            if (confirm('Effacer toutes les annotations ?')) {
                annotations = [];
                updateAnnotationsDisplay();
                saveAnnotations();
                setStatus('Annotations effacées');
            }
        };
        
        toolsMenu.appendChild(separator);
        toolsMenu.appendChild(exportBtn);
        toolsMenu.appendChild(importBtn);
        toolsMenu.appendChild(clearBtn);
    }, 2000);
}