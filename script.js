const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const brushSize = document.getElementById('brushSize');
const brushSizeValue = document.getElementById('brushSizeValue');
const eraserButton = document.getElementById('eraserButton');
const clearButton = document.getElementById('clearButton');
const colorOptions = document.querySelectorAll('.color-option');
const brushTypeSelect = document.getElementById('brushType');
const normalBrushButton = document.getElementById('normalBrushButton');

let drawing = false;
let isErasing = false;
let currentColor = colorPicker.value;
let currentSize = brushSize.value;
let currentBrushType = 'normal';
let currentShape = null;
let startX, startY, isDrawingShape = false;
let shapes = [];
let lines = [];
const socket = io();
console.log('Socket connection established');

// Update canvas size dynamically
function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    ctx.fillStyle = 'white'; // Set the canvas background to white
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    redrawAll();
}

resizeCanvas();

// Update brush size display
brushSize.addEventListener('input', (e) => {
    currentSize = e.target.value;
    brushSizeValue.textContent = `${currentSize}px`;
});

// Update current color from color picker
colorPicker.addEventListener('input', (e) => {
    currentColor = e.target.value;
    isErasing = false;
    eraserButton.classList.remove('active');
});

// Update current color from color palette buttons
colorOptions.forEach(option => {
    option.addEventListener('click', (e) => {
        currentColor = e.target.dataset.color;
        isErasing = false;
        eraserButton.classList.remove('active');
        colorPicker.value = currentColor; // Update color picker to match selected color
    });
});

// Update brush type
brushTypeSelect.addEventListener('change', (e) => {
    currentBrushType = e.target.value;
});

// Function to toggle eraser mode
function toggleEraser() {
    isErasing = !isErasing;
    eraserButton.classList.toggle('active');
    canvas.style.cursor = isErasing ? 'cell' : 'crosshair';
}

// Eraser button click handler
eraserButton.addEventListener('click', toggleEraser);

// Add keyboard shortcut 'e' to toggle eraser
document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'e') {
        toggleEraser();
    }
});

function draw(e) {
    if (!drawing) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineWidth = currentSize;
    ctx.lineCap = 'round';
    ctx.strokeStyle = isErasing ? 'white' : currentColor;

    if (currentBrushType === 'dotted') {
        ctx.setLineDash([2, 2]);
    } else if (currentBrushType === 'dashed') {
        ctx.setLineDash([5, 5]);
    } else {
        ctx.setLineDash([]);
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);

    // Emit the drawing data to server
    throttleEmitDrawing({ x, y, color: isErasing ? 'white' : currentColor, size: currentSize, brushType: currentBrushType });
}

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;

    if (currentShape) {
        isDrawingShape = true;
    } else {
        drawing = true;
        draw(e); // Start drawing immediately on click
    }
});

// Draw while mouse moves
canvas.addEventListener('mousemove', (e) => {
    if (isDrawingShape) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white'; // Reset the canvas background to white after clearing
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        redrawAll();
        drawShapePreview(startX, startY, x, y);
    } else if (drawing) {
        draw(e);
    }
});

// Stop drawing on mouse up
canvas.addEventListener('mouseup', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDrawingShape) {
        isDrawingShape = false;
        shapes.push({ shape: currentShape, startX, startY, endX: x, endY: y, color: currentColor, size: currentSize });
        drawShape(startX, startY, x, y, currentColor, currentSize);
    } else if (drawing) {
        drawing = false;
        ctx.beginPath(); // Start a new path when mouse is released
        lines.push({ x, y, color: currentColor, size: currentSize, brushType: currentBrushType });
    }
});

// Stop drawing when mouse leaves the canvas
canvas.addEventListener('mouseout', () => {
    drawing = false;
    ctx.beginPath();
});

// Set initial cursor style
canvas.style.cursor = 'crosshair';

// Integration of the socket io data
socket.on('drawing', (data) => {
    const { x, y, color, size, brushType } = data;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;

    if (brushType === 'dotted') {
        ctx.setLineDash([2, 2]);
    } else if (brushType === 'dashed') {
        ctx.setLineDash([5, 5]);
    } else {
        ctx.setLineDash([]);
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
});

function drawShapePreview(startX, startY, endX, endY) {
    ctx.beginPath();
    if (currentShape === 'rectangle') {
        ctx.rect(startX, startY, endX - startX, endY - startY);
    } else if (currentShape === 'circle') {
        const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        ctx.arc(startX, startY, radius, 0, Math.PI * 2);
    } else if (currentShape === 'line') {
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
    }
    ctx.stroke();
    ctx.closePath();
}

function drawShape(startX, startY, endX, endY, color, size) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    if (currentShape === 'rectangle') {
        ctx.rect(startX, startY, endX - startX, endY - startY);
    } else if (currentShape === 'circle') {
        const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        ctx.arc(startX, startY, radius, 0, Math.PI * 2);
    } else if (currentShape === 'line') {
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
    }
    ctx.stroke();
    ctx.closePath();
}

function redrawShapes() {
    shapes.forEach(({ shape, startX, startY, endX, endY, color, size }) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        if (shape === 'rectangle') {
            ctx.rect(startX, startY, endX - startX, endY - startY);
        } else if (shape === 'circle') {
            const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
            ctx.arc(startX, startY, radius, 0, Math.PI * 2);
        } else if (shape === 'line') {
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
        }
        ctx.stroke();
        ctx.closePath();
    });
}

function redrawLines() {
    lines.forEach(({ x, y, color, size, brushType }) => {
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.strokeStyle = color;

        if (brushType === 'dotted') {
            ctx.setLineDash([2, 2]);
        } else if (brushType === 'dashed') {
            ctx.setLineDash([5, 5]);
        } else {
            ctx.setLineDash([]);
        }

        ctx.moveTo(x, y);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    });
}

function redrawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white'; // Reset the canvas background to white after clearing
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    redrawLines();
    redrawShapes();
}

// Throttle function to limit the rate of socket emissions
function throttle(func, limit) {
    let lastFunc;
    let lastRan;
    return function() {
        const context = this;
        const args = arguments;
        if (!lastRan) {
            func.apply(context, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(function() {
                if ((Date.now() - lastRan) >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
}

const throttleEmitDrawing = throttle((data) => {
    socket.emit('drawing', data);
}, 50); // Throttle to emit every 50ms

// Clear Canvas Functionality
document.addEventListener('DOMContentLoaded', () => {
    clearButton.addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white'; // Reset the canvas background to white after clearing
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        shapes = [];
        lines = [];
        socket.emit('clearCanvas');
    });
});

// Socket event to clear canvas for all users
socket.on('clearCanvas', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white'; // Reset the canvas background to white after clearing
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    shapes = [];
    lines = [];
});

// Initialize canvas size on load
window.onload = () => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
};

// Add event listener for normal brush button
normalBrushButton.addEventListener('click', () => {
    currentShape = null;
    currentBrushType = 'normal';
    brushTypeSelect.value = 'normal';
});

// Add event listeners for shape buttons
document.getElementById('rectangleButton').addEventListener('click', () => {
    currentShape = 'rectangle';
});

document.getElementById('circleButton').addEventListener('click', () => {
    currentShape = 'circle';
});

document.getElementById('lineButton').addEventListener('click', () => {
    currentShape = 'line';
});
