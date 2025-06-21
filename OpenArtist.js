class DrawingApp {
    constructor() {
        this.mainCanvas = document.getElementById('canvas');
        this.mainCtx = this.mainCanvas.getContext('2d');

        const firstCanvas = document.createElement('canvas');
        firstCanvas.width = this.mainCanvas.width;
        firstCanvas.height = this.mainCanvas.height;

        this.layers = [{
            canvas: firstCanvas,
            ctx: firstCanvas.getContext('2d'),
            name: 'Layer 1',
            visible: true
        }];

        this.currentLayer = 0;
        this.canvas = this.layers[0].canvas;
        this.ctx = this.layers[0].ctx;

        this.isDrawing = false;
        this.tool = 'brush';
        this.color = '#000000';
        this.size = 5;
        this.startX = 0;
        this.startY = 0;
        this.tempCanvas = document.createElement('canvas');
        this.tempCanvas.width = this.mainCanvas.width;
        this.tempCanvas.height = this.mainCanvas.height;
        this.tempCtx = this.tempCanvas.getContext('2d');
        this.undoStack = [];
        this.redoStack = [];
        
        // New properties
        this.selectedObject = null;
        this.transformBox = null;
        this.isDragging = false;
        this.isResizing = false;
        this.dragOffset = { x: 0, y: 0 };
        
        // Add new properties for zoom and rotation
        this.zoomLevel = 100;
        this.rotationAngle = 0;
        this.canvasContainer = document.querySelector('.canvas-container');

        // Add properties toggle state
        this.propertiesVisible = true;

        // Add keyboard shortcuts
        this.shortcuts = {
            'ctrl+z': this.undo.bind(this),
            'ctrl+y': this.redo.bind(this),
            'ctrl+s': (e) => {
                e.preventDefault();
                this.saveCanvas();
            },
            'ctrl+o': (e) => {
                e.preventDefault();
                this.openFile();
            },
            'ctrl+n': (e) => {
                e.preventDefault();
                this.newCanvas();
            },
            'delete': () => {
                if (this.selectedObject) {
                    this.ctx.clearRect(this.selectedObject.x, this.selectedObject.y, 
                        this.selectedObject.width, this.selectedObject.height);
                    this.confirmSelection();
                    this.redrawLayers();
                }
            },
            '+': () => {
                const newZoom = Math.min(200, this.zoomLevel + 10);
                document.getElementById('zoomSlider').value = newZoom;
                this.setZoom(newZoom);
            },
            '-': () => {
                const newZoom = Math.max(10, this.zoomLevel - 10);
                document.getElementById('zoomSlider').value = newZoom;
                this.setZoom(newZoom);
            },
            'escape': () => {
                if (this.selectedObject) {
                    this.confirmSelection();
                }
            }
        };

        this.initializeEventListeners();
        this.updateLayerList();
    }

    initializeEventListeners() {
        document.querySelectorAll('.tool').forEach(tool => {
            tool.addEventListener('click', (e) => {
                document.querySelector('.tool.active').classList.remove('active');
                tool.classList.add('active');
                this.tool = tool.id;

                // Show/hide text properties based on selected tool
                const textProperties = document.getElementById('textProperties');
                textProperties.style.display = this.tool === 'text' ? 'block' : 'none';

                // Trigger image selection immediately when image tool is clicked
                if (this.tool === 'image') {
                    this.addImage();
                }
            });
        });

        this.mainCanvas.addEventListener('mousedown', (e) => {
            if (this.tool === 'select') {
                this.selectObject(e);
            } else {
                this.startDrawing(e);
            }
        });

        this.mainCanvas.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                this.moveSelectedObject(e);
            } else if (this.isResizing) {
                this.resizeSelectedObject(e);
            } else {
                this.draw(e);
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (this.isDragging || this.isResizing) {
                this.isDragging = false;
                this.isResizing = false;
                // Only save state if we were actually moving/resizing
                this.saveState();
            } else {
                this.stopDrawing(e);
            }
        });

        this.mainCanvas.addEventListener('mouseout', this.stopDrawing.bind(this));

        document.getElementById('colorPicker').addEventListener('change', (e) => {
            this.color = e.target.value;
        });

        document.getElementById('sizeSlider').addEventListener('input', (e) => {
            this.size = e.target.value;
        });

        document.getElementById('zoomSlider').addEventListener('input', (e) => {
            this.setZoom(parseInt(e.target.value));
        });

        document.getElementById('rotationSlider').addEventListener('input', (e) => {
            this.setRotation(parseInt(e.target.value));
        });

        document.getElementById('rotateLeft').addEventListener('click', () => {
            let newAngle = (this.rotationAngle - 90) % 360;
            if (newAngle < 0) newAngle += 360;
            document.getElementById('rotationSlider').value = newAngle;
            this.setRotation(newAngle);
        });

        document.getElementById('rotateRight').addEventListener('click', () => {
            const newAngle = (this.rotationAngle + 90) % 360;
            document.getElementById('rotationSlider').value = newAngle;
            this.setRotation(newAngle);
        });

        document.getElementById('new').addEventListener('click', this.newCanvas.bind(this));
        document.getElementById('save').addEventListener('click', this.saveCanvas.bind(this));
        document.getElementById('open').addEventListener('click', this.openFile.bind(this));
        document.getElementById('undo').addEventListener('click', this.undo.bind(this));
        document.getElementById('redo').addEventListener('click', this.redo.bind(this));

        document.getElementById('addLayer').addEventListener('click', this.addLayer.bind(this));

        // Add click handler for canvas container
        document.querySelector('.canvas-container').addEventListener('click', (e) => {
            if (this.tool === 'select' && e.target === this.mainCanvas) {
                return;
            }
            if (this.tool === 'select') {
                this.confirmSelection();
            }
        });

        // Add properties toggle handler
        document.querySelector('.toggle-properties').addEventListener('click', () => {
            const properties = document.querySelector('.properties');
            const canvasContainer = document.querySelector('.canvas-container');
            
            this.propertiesVisible = !this.propertiesVisible;
            
            if (!this.propertiesVisible) {
                properties.classList.add('hidden');
                canvasContainer.classList.add('expanded');
            } else {
                properties.classList.remove('hidden');
                canvasContainer.classList.remove('expanded');
            }
        });

        // Add corner toggle handler
        document.querySelector('.corner-toggle').addEventListener('click', () => {
            const properties = document.querySelector('.properties');
            const canvasContainer = document.querySelector('.canvas-container');
            const cornerToggle = document.querySelector('.corner-toggle');
            
            this.propertiesVisible = !this.propertiesVisible;
            
            if (!this.propertiesVisible) {
                properties.classList.add('hidden');
                canvasContainer.classList.add('expanded');
                cornerToggle.classList.add('expanded');
                cornerToggle.querySelector('i').classList.remove('fa-chevron-right');
                cornerToggle.querySelector('i').classList.add('fa-chevron-left');
            } else {
                properties.classList.remove('hidden');
                canvasContainer.classList.remove('expanded');
                cornerToggle.classList.remove('expanded');
                cornerToggle.querySelector('i').classList.remove('fa-chevron-left');
                cornerToggle.querySelector('i').classList.add('fa-chevron-right');
            }
        });

        // Add mouse wheel to zoom functionality
        this.canvasContainer.addEventListener('wheel', (e) => {
            e.preventDefault(); // Prevent default scroll

            // Calculate zoom change based on wheel direction
            const delta = e.deltaY > 0 ? -5 : 5;
            const newZoom = Math.max(10, Math.min(200, this.zoomLevel + delta));
            
            // Update zoom slider
            document.getElementById('zoomSlider').value = newZoom;
            
            // Apply zoom
            this.setZoom(newZoom);
        }, { passive: false });

        // Add keyboard event listener
        document.addEventListener('keydown', (e) => {
            const cmdKey = e.metaKey || e.ctrlKey;
            
            // Handle ctrl/cmd combinations
            if (cmdKey) {
                switch(e.key.toLowerCase()) {
                    case 'z':
                        e.preventDefault();
                        this.shortcuts['ctrl+z']();
                        break;
                    case 'y':
                        e.preventDefault();
                        this.shortcuts['ctrl+y']();
                        break;
                    case 's':
                        this.shortcuts['ctrl+s'](e);
                        break;
                    case 'o':
                        this.shortcuts['ctrl+o'](e);
                        break;
                    case 'n':
                        this.shortcuts['ctrl+n'](e);
                        break;
                }
            } else {
                // Handle single key shortcuts
                switch(e.key) {
                    case 'Delete':
                    case 'Backspace':
                        this.shortcuts['delete']();
                        break;
                    case '=':
                    case '+':
                        this.shortcuts['+']();
                        break;
                    case '-':
                        this.shortcuts['-']();
                        break;
                    case 'Escape':
                        this.shortcuts['escape']();
                        break;
                    // Tool shortcuts
                    case 'b':
                        document.getElementById('brush').click();
                        break;
                    case 'e':
                        document.getElementById('eraser').click();
                        break;
                    case 'v':
                        document.getElementById('select').click();
                        break;
                    case 'r':
                        document.getElementById('rectangle').click();
                        break;
                    case 'c':
                        document.getElementById('circle').click();
                        break;
                    case 'l':
                        document.getElementById('line').click();
                        break;
                    case 't':
                        document.getElementById('text').click();
                        break;
                    case 'i':
                        document.getElementById('image').click();
                        break;
                }
            }
        });
    }

    newCanvas() {
        // Create dialog to get dimensions
        const width = prompt('Enter canvas width (px):', this.mainCanvas.width);
        if (!width) return; // Cancel if no width entered
        
        const height = prompt('Enter canvas height (px):', this.mainCanvas.height);
        if (!height) return; // Cancel if no height entered
        
        // Validate input
        const newWidth = parseInt(width);
        const newHeight = parseInt(height);
        
        if (isNaN(newWidth) || isNaN(newHeight) || newWidth <= 0 || newHeight <= 0) {
            alert('Please enter valid positive numbers for width and height');
            return;
        }
        
        if (confirm('Create new canvas? This will clear your current work.')) {
            // Update canvas dimensions
            this.mainCanvas.width = newWidth;
            this.mainCanvas.height = newHeight;
            
            // Clear layers and create new first layer
            this.layers = [];
            const firstCanvas = document.createElement('canvas');
            firstCanvas.width = newWidth;
            firstCanvas.height = newHeight;

            this.layers.push({
                canvas: firstCanvas,
                ctx: firstCanvas.getContext('2d'),
                name: 'Layer 1',
                visible: true
            });

            this.currentLayer = 0;
            this.canvas = this.layers[0].canvas;
            this.ctx = this.layers[0].ctx;

            // Update temp canvas dimensions
            this.tempCanvas.width = newWidth;
            this.tempCanvas.height = newHeight;
            
            // Clear all canvases
            this.mainCtx.clearRect(0, 0, newWidth, newHeight);
            this.tempCtx.clearRect(0, 0, newWidth, newHeight);
            
            // Reset undo/redo stacks
            this.undoStack = [];
            this.redoStack = [];
            
            // Reset any selected object
            this.selectedObject = null;
            if (this.transformBox) {
                this.transformBox.style.display = 'none';
            }
            
            // Update layer list
            this.updateLayerList();
        }
    }

    startDrawing(e) {
        if (this.tool === 'text') {
            this.addText(e);
            return;
        }

        this.isDrawing = true;
        this.startX = e.offsetX;
        this.startY = e.offsetY;

        // Clear redo stack when starting a new drawing
        this.redoStack = [];

        if (this.tool === 'brush' || this.tool === 'eraser') {
            if (this.tool === 'eraser') {
                this.ctx.globalCompositeOperation = 'destination-out';
            }
            this.ctx.beginPath();
            this.ctx.moveTo(e.offsetX, e.offsetY);
        }
        this.saveState();
    }

    draw(e) {
        if (!this.isDrawing) return;

        switch(this.tool) {
            case 'brush':
            case 'eraser':
                this.ctx.lineCap = 'round';
                this.ctx.lineJoin = 'round';
                this.ctx.lineWidth = this.size;
                if (this.tool === 'eraser') {
                    this.ctx.globalCompositeOperation = 'destination-out';
                }
                this.ctx.lineTo(e.offsetX, e.offsetY);
                this.ctx.stroke();
                this.redrawLayers();
                break;

            case 'rectangle':
            case 'circle':
            case 'line':
                this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
                this.tempCtx.drawImage(this.canvas, 0, 0);
                
                this.tempCtx.strokeStyle = this.color;
                this.tempCtx.lineWidth = this.size;
                this.tempCtx.beginPath();

                if (this.tool === 'rectangle') {
                    const width = e.offsetX - this.startX;
                    const height = e.offsetY - this.startY;
                    this.tempCtx.rect(this.startX, this.startY, width, height);
                } else if (this.tool === 'circle') {
                    const radius = Math.sqrt(
                        Math.pow(e.offsetX - this.startX, 2) + 
                        Math.pow(e.offsetY - this.startY, 2)
                    );
                    this.tempCtx.arc(this.startX, this.startY, radius, 0, Math.PI * 2);
                } else if (this.tool === 'line') {
                    this.tempCtx.moveTo(this.startX, this.startY);
                    this.tempCtx.lineTo(e.offsetX, e.offsetY);
                }
                
                this.tempCtx.stroke();
                
                // Clear main canvas and redraw all layers with temporary canvas
                this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
                this.layers.forEach((layer, index) => {
                    if (layer.visible) {
                        if (index === this.currentLayer) {
                            this.mainCtx.drawImage(this.tempCanvas, 0, 0);
                        } else {
                            this.mainCtx.drawImage(layer.canvas, 0, 0);
                        }
                    }
                });
                break;
        }
    }

    stopDrawing(e) {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        // Handle eraser differently
        if (this.tool === 'eraser') {
            this.ctx.globalCompositeOperation = 'source-over';
            this.redrawLayers();
            return;
        }

        if (this.tool === 'brush') {
            this.ctx.drawImage(this.tempCanvas, 0, 0);
            this.redrawLayers();
            return;
        }

        // Only proceed with shape drawing if we have event coordinates
        if (e && ['rectangle', 'circle', 'line'].includes(this.tool)) {
            this.ctx.strokeStyle = this.color;
            this.ctx.lineWidth = this.size;
            this.ctx.beginPath();
            
            if (this.tool === 'rectangle') {
                const width = e.offsetX - this.startX;
                const height = e.offsetY - this.startY;
                this.ctx.rect(this.startX, this.startY, width, height);
            } else if (this.tool === 'circle') {
                const radius = Math.sqrt(
                    Math.pow(e.offsetX - this.startX, 2) + 
                    Math.pow(e.offsetY - this.startY, 2)
                );
                this.ctx.arc(this.startX, this.startY, radius, 0, Math.PI * 2);
            } else if (this.tool === 'line') {
                this.ctx.moveTo(this.startX, this.startY);
                this.ctx.lineTo(e.offsetX, e.offsetY);
            }
            this.ctx.stroke();
            this.redrawLayers();
        }

        // For shape tools, if no event coordinates, just use the temp canvas
        if (!e && ['rectangle', 'circle', 'line'].includes(this.tool)) {
            this.ctx.drawImage(this.tempCanvas, 0, 0);
            this.redrawLayers();
        }
    }

    addText(e) {
        const text = prompt('Enter text:');
        if (!text) return;
        
        const fontFamily = document.getElementById('fontFamily').value;
        const fontSize = document.getElementById('fontSize').value;
        
        this.ctx.font = `${fontSize}px ${fontFamily}`;
        this.ctx.fillStyle = this.color;
        this.ctx.fillText(text, e.offsetX, e.offsetY);
        this.redrawLayers();
        this.saveState();
    }

    addImage() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        input.onchange = (event) => {
            const file = event.target.files[0];
            const reader = new FileReader();
            
            reader.onload = (readerEvent) => {
                const img = new Image();
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;
                    const maxSize = 300;
                    
                    if (width > maxSize || height > maxSize) {
                        if (width > height) {
                            height = (height / width) * maxSize;
                            width = maxSize;
                        } else {
                            width = (width / height) * maxSize;
                            height = maxSize;
                        }
                    }
                    
                    // Center the image on the canvas
                    const x = (this.canvas.width - width) / 2;
                    const y = (this.canvas.height - height) / 2;
                    
                    this.ctx.drawImage(img, x, y, width, height);
                    this.redrawLayers();
                    this.saveState();
                };
                img.src = readerEvent.target.result;
            };
            reader.readAsDataURL(file);
        };
        
        input.click();
    }

    saveState() {
        this.undoStack.push({
            layerIndex: this.currentLayer,
            imageData: this.canvas.toDataURL()
        });
        this.redoStack = [];
    }

    undo() {
        if (this.undoStack.length > 0) {
            const state = this.undoStack.pop();
            this.redoStack.push({
                layerIndex: this.currentLayer,
                imageData: this.layers[state.layerIndex].canvas.toDataURL()
            });
            this.loadImage(state.imageData, state.layerIndex);
        }
    }

    redo() {
        if (this.redoStack.length > 0) {
            const state = this.redoStack.pop();
            this.undoStack.push({
                layerIndex: this.currentLayer,
                imageData: this.layers[state.layerIndex].canvas.toDataURL()
            });
            this.loadImage(state.imageData, state.layerIndex);
        }
    }

    loadImage(dataUrl, layerIndex = this.currentLayer) {
        const img = new Image();
        img.onload = () => {
            const targetCtx = this.layers[layerIndex].ctx;
            // Clear the target canvas completely
            targetCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            // Clear the temp canvas
            this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
            // Draw the new image
            targetCtx.drawImage(img, 0, 0);
            this.redrawLayers();
        };
        img.src = dataUrl;
    }

    newCanvas() {
        // Create dialog to get dimensions
        const width = prompt('Enter canvas width (px):', this.mainCanvas.width);
        if (!width) return; // Cancel if no width entered
        
        const height = prompt('Enter canvas height (px):', this.mainCanvas.height);
        if (!height) return; // Cancel if no height entered
        
        // Validate input
        const newWidth = parseInt(width);
        const newHeight = parseInt(height);
        
        if (isNaN(newWidth) || isNaN(newHeight) || newWidth <= 0 || newHeight <= 0) {
            alert('Please enter valid positive numbers for width and height');
            return;
        }
        
        if (confirm('Create new canvas? This will clear your current work.')) {
            // Update canvas dimensions
            this.mainCanvas.width = newWidth;
            this.mainCanvas.height = newHeight;
            
            // Clear layers and create new first layer
            this.layers = [];
            const firstCanvas = document.createElement('canvas');
            firstCanvas.width = newWidth;
            firstCanvas.height = newHeight;

            this.layers.push({
                canvas: firstCanvas,
                ctx: firstCanvas.getContext('2d'),
                name: 'Layer 1',
                visible: true
            });

            this.currentLayer = 0;
            this.canvas = this.layers[0].canvas;
            this.ctx = this.layers[0].ctx;

            // Update temp canvas dimensions
            this.tempCanvas.width = newWidth;
            this.tempCanvas.height = newHeight;
            
            // Clear all canvases
            this.mainCtx.clearRect(0, 0, newWidth, newHeight);
            this.tempCtx.clearRect(0, 0, newWidth, newHeight);
            
            // Reset undo/redo stacks
            this.undoStack = [];
            this.redoStack = [];
            
            // Reset any selected object
            this.selectedObject = null;
            if (this.transformBox) {
                this.transformBox.style.display = 'none';
            }
            
            // Update layer list
            this.updateLayerList();
        }
    }

    saveCanvas() {
        const link = document.createElement('a');
        link.download = 'drawing.png';
        link.href = this.mainCanvas.toDataURL();
        link.click();
    }

    openFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    // Resize canvas to match image dimensions
                    this.mainCanvas.width = img.width;
                    this.mainCanvas.height = img.height;
                    
                    // Resize all layer canvases
                    this.layers.forEach(layer => {
                        layer.canvas.width = img.width;
                        layer.canvas.height = img.height;
                    });
                    
                    // Resize temp canvas
                    this.tempCanvas.width = img.width;
                    this.tempCanvas.height = img.height;
                    
                    // Clear and draw new image
                    const targetCtx = this.ctx;
                    targetCtx.clearRect(0, 0, img.width, img.height);
                    targetCtx.drawImage(img, 0, 0);
                    
                    this.redrawLayers();
                    this.saveState();
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        };
        input.click();
    }

    addLayer() {
        const newCanvas = document.createElement('canvas');
        newCanvas.width = this.mainCanvas.width;
        newCanvas.height = this.mainCanvas.height;
        const newCtx = newCanvas.getContext('2d');

        this.layers.push({
            canvas: newCanvas,
            ctx: newCtx,
            name: `Layer ${this.layers.length + 1}`,
            visible: true
        });

        this.currentLayer = this.layers.length - 1;
        this.ctx = this.layers[this.currentLayer].ctx;
        this.redrawLayers();
        this.updateLayerList();
    }

    deleteLayer(index) {
        if (this.layers.length <= 1) {
            alert("Cannot delete the last remaining layer!");
            return;
        }

        this.layers.splice(index, 1);

        if (this.currentLayer >= this.layers.length) {
            this.currentLayer = this.layers.length - 1;
        }

        this.redrawLayers();
        this.updateLayerList();
    }

    selectLayer(index) {
        this.currentLayer = index;
        this.canvas = this.layers[index].canvas;
        this.ctx = this.layers[index].ctx;
        this.updateLayerList();
    }

    updateLayerList() {
        const layerList = document.getElementById('layerList');
        layerList.innerHTML = '';

        this.layers.forEach((layer, index) => {
            const layerDiv = document.createElement('div');
            layerDiv.className = 'layer';
            layerDiv.draggable = true; // Make draggable
            if (index === this.currentLayer) {
                layerDiv.classList.add('selected');
            }

            // Add drag event listeners
            layerDiv.addEventListener('dragstart', (e) => {
                e.stopPropagation();
                layerDiv.classList.add('dragging');
                e.dataTransfer.setData('text/plain', index);
            });

            layerDiv.addEventListener('dragend', (e) => {
                e.stopPropagation();
                layerDiv.classList.remove('dragging');
            });

            layerDiv.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                layerDiv.classList.add('drag-over');
            });

            layerDiv.addEventListener('dragleave', (e) => {
                e.stopPropagation();
                layerDiv.classList.remove('drag-over');
            });

            layerDiv.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                layerDiv.classList.remove('drag-over');
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = index;
                
                if (fromIndex !== toIndex) {
                    // Rearrange layers
                    const [movedLayer] = this.layers.splice(fromIndex, 1);
                    this.layers.splice(toIndex, 0, movedLayer);
                    
                    // Update current layer index if needed
                    if (this.currentLayer === fromIndex) {
                        this.currentLayer = toIndex;
                    } else if (fromIndex < this.currentLayer && toIndex >= this.currentLayer) {
                        this.currentLayer--;
                    } else if (fromIndex > this.currentLayer && toIndex <= this.currentLayer) {
                        this.currentLayer++;
                    }
                    
                    this.redrawLayers();
                    this.updateLayerList();
                }
            });

            const leftSide = document.createElement('div');
            leftSide.className = 'layer-controls';

            const visibility = document.createElement('input');
            visibility.type = 'checkbox';
            visibility.checked = layer.visible;
            visibility.className = 'layer-visibility';
            visibility.onchange = (e) => {
                e.stopPropagation();
                layer.visible = visibility.checked;
                this.redrawLayers();
            };

            const name = document.createElement('span');
            name.textContent = layer.name;

            leftSide.appendChild(visibility);
            leftSide.appendChild(name);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-layer';
            deleteBtn.textContent = 'Delete';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                this.deleteLayer(index);
            };

            layerDiv.appendChild(leftSide);
            layerDiv.appendChild(deleteBtn);
            layerDiv.addEventListener('click', () => this.selectLayer(index));
            layerList.appendChild(layerDiv);
        });
    }

    redrawLayers() {
        // Clear the main canvas completely
        this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
        // Draw each visible layer
        this.layers.forEach(layer => {
            if (layer.visible) {
                this.mainCtx.drawImage(layer.canvas, 0, 0);
            }
        });
    }

    selectObject(e) {
        // Get the pixel data at click location
        const x = e.offsetX;
        const y = e.offsetY;
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const index = (y * imageData.width + x) * 4;
        
        // If clicked on a non-transparent pixel
        if (imageData.data[index + 3] > 0) {
            // Find bounds of the object
            let left = x;
            let right = x;
            let top = y;
            let bottom = y;
            
            // Scan outward to find object bounds
            while (left > 0 && this.ctx.getImageData(left - 1, y, 1, 1).data[3] > 0) left--;
            while (right < this.canvas.width && this.ctx.getImageData(right + 1, y, 1, 1).data[3] > 0) right++;
            while (top > 0 && this.ctx.getImageData(x, top - 1, 1, 1).data[3] > 0) top--;
            while (bottom < this.canvas.height && this.ctx.getImageData(x, bottom + 1, 1, 1).data[3] > 0) bottom++;
            
            // Store selected object data
            this.selectedObject = {
                x: left,
                y: top,
                width: right - left,
                height: bottom - top,
                imageData: this.ctx.getImageData(left, top, right - left, bottom - top)
            };
            
            // Show transform box
            this.showTransformBox(left, top, right - left, bottom - top);
            
            // Set up drag functionality
            this.isDragging = true;
            const containerRect = document.querySelector('.canvas-container').getBoundingClientRect();
            this.dragOffset = {
                x: e.clientX - containerRect.left - left,
                y: e.clientY - containerRect.top - top
            };
        } else {
            // Clicked empty space - confirm selection
            this.confirmSelection();
        }
    }

    confirmSelection() {
        if (this.selectedObject) {
            // Clear transform box
            if (this.transformBox) {
                this.transformBox.style.display = 'none';
            }
            
            // Save the current state of the canvas
            this.saveState();
            
            // Clear selection
            this.selectedObject = null;
            this.isDragging = false;
            this.isResizing = false;
        }
    }

    showTransformBox(x, y, width, height) {
        if (!this.transformBox) {
            this.transformBox = document.createElement('div');
            this.transformBox.className = 'transform-box';
            document.querySelector('.canvas-container').appendChild(this.transformBox);
            
            // Add resize handles
            const positions = ['nw', 'ne', 'sw', 'se'];
            positions.forEach(pos => {
                const handle = document.createElement('div');
                handle.className = `transform-handle ${pos}`;
                handle.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    this.isResizing = true;
                    this.resizeHandle = pos;
                });
                this.transformBox.appendChild(handle);
            });
        }
        
        this.transformBox.style.display = 'block';
        this.transformBox.style.left = `${x}px`;
        this.transformBox.style.top = `${y}px`;
        this.transformBox.style.width = `${width}px`;
        this.transformBox.style.height = `${height}px`;
    }

    moveSelectedObject(e) {
        if (!this.selectedObject || !this.isDragging) return;
        
        const containerRect = document.querySelector('.canvas-container').getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - containerRect.left - this.dragOffset.x, 
            this.canvas.width - this.selectedObject.width));
        const y = Math.max(0, Math.min(e.clientY - containerRect.top - this.dragOffset.y, 
            this.canvas.height - this.selectedObject.height));
        
        // Update transform box position
        this.transformBox.style.left = `${x}px`;
        this.transformBox.style.top = `${y}px`;
        
        // Clear and redraw canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.putImageData(this.selectedObject.imageData, x, y);
        this.redrawLayers();
        
        // Update selected object position
        this.selectedObject.x = x;
        this.selectedObject.y = y;
    }

    async resizeSelectedObject(e) {
        if (!this.selectedObject || !this.isResizing) return;
        
        const box = this.transformBox.getBoundingClientRect();
        const containerRect = document.querySelector('.canvas-container').getBoundingClientRect();
        const x = e.clientX - containerRect.left;
        const y = e.clientY - containerRect.top;
        
        let newWidth, newHeight, newX, newY;
        
        switch(this.resizeHandle) {
            case 'se':
                newWidth = x - parseInt(this.transformBox.style.left);
                newHeight = y - parseInt(this.transformBox.style.top);
                break;
            case 'sw':
                newWidth = parseInt(this.transformBox.style.left) + parseInt(this.transformBox.style.width) - x;
                newHeight = y - parseInt(this.transformBox.style.top);
                newX = x;
                break;
            case 'ne':
                newWidth = x - parseInt(this.transformBox.style.left);
                newHeight = parseInt(this.transformBox.style.top) + parseInt(this.transformBox.style.height) - y;
                newY = y;
                break;
            case 'nw':
                newWidth = parseInt(this.transformBox.style.left) + parseInt(this.transformBox.style.width) - x;
                newHeight = parseInt(this.transformBox.style.top) + parseInt(this.transformBox.style.height) - y;
                newX = x;
                newY = y;
                break;
        }
        
        if (newWidth > 10 && newHeight > 10) {
            if (newX !== undefined) this.transformBox.style.left = `${newX}px`;
            if (newY !== undefined) this.transformBox.style.top = `${newY}px`;
            this.transformBox.style.width = `${newWidth}px`;
            this.transformBox.style.height = `${newHeight}px`;
            
            try {
                // Create a temporary canvas for the image data
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = this.selectedObject.imageData.width;
                tempCanvas.height = this.selectedObject.imageData.height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.putImageData(this.selectedObject.imageData, 0, 0);

                // Clear and redraw
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.ctx.drawImage(
                    tempCanvas,
                    parseInt(this.transformBox.style.left),
                    parseInt(this.transformBox.style.top),
                    newWidth,
                    newHeight
                );
                this.redrawLayers();
            } catch (error) {
                console.error('Error resizing object:', error);
            }
        }
    }

    setRotation(angle) {
        this.rotationAngle = angle;
        const scale = this.zoomLevel / 100;
        
        // Apply both zoom and rotation transforms
        this.mainCanvas.style.transform = `scale(${scale}) rotate(${angle}deg)`;
        this.mainCanvas.style.transformOrigin = 'center center';
        
        document.getElementById('rotationLevel').textContent = `${angle}°`;
    }

    setZoom(level) {
        this.zoomLevel = level;
        const scale = level / 100;
        
        // Apply both zoom and rotation transforms
        this.mainCanvas.style.transform = `scale(${scale}) rotate(${this.rotationAngle}deg)`;
        this.mainCanvas.style.transformOrigin = 'center center';
        
        document.getElementById('zoomLevel').textContent = `${level}%`;
        
        this.canvasContainer.classList.toggle('zooming', level > 100);
    }
}

// Start the drawing application.
const app = new DrawingApp();