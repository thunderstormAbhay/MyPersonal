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

let lastX, lastY;
let prevX = null;
let prevY = null;

// Update canvas size dynamically
function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    redrawAll();
}

resizeCanvas();

brushSize.addEventListener('input', (e) => {
    currentSize = e.target.value;
    brushSizeValue.textContent = `${currentSize}px`;
});

colorPicker.addEventListener('input', (e) => {
    currentColor = e.target.value;
    isErasing = false;
    eraserButton.classList.remove('active');
});

colorOptions.forEach(option => {
    option.addEventListener('click', (e) => {
        currentColor = e.target.dataset.color;
        isErasing = false;
        eraserButton.classList.remove('active');
        colorPicker.value = currentColor;
    });
});

brushTypeSelect.addEventListener('change', (e) => {
    currentBrushType = e.target.value;
});

function toggleEraser() {
    isErasing = !isErasing;
    currentShape = null;
    isDrawingShape = false;
    currentBrushType = 'normal';
    eraserButton.classList.toggle('active');
    canvas.style.cursor = isErasing ? 'cell' : 'crosshair';

    ctx.setLineDash([]);
    brushTypeSelect.value = 'normal';
}

eraserButton.addEventListener('click', toggleEraser);

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

    if (prevX === null || prevY === null) {
        prevX = x;
        prevY = y;
    }

    ctx.beginPath();
    ctx.moveTo(prevX, prevY);
    ctx.lineTo(x, y);

    ctx.lineWidth = currentSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = isErasing ? '#FFFFFF' : currentColor;
    ctx.setLineDash(currentBrushType === 'dotted' ? [2, 2] : currentBrushType === 'dashed' ? [5, 5] : []);

    ctx.stroke();

    lines.push({ startX: prevX, startY: prevY, endX: x, endY: y, color: ctx.strokeStyle, size: ctx.lineWidth, brushType: currentBrushType });

    prevX = x;
    prevY = y;

    throttleEmitDrawing({
        startX: prevX, startY: prevY,
        endX: x, endY: y,
        color: isErasing ? '#FFFFFF' : currentColor,
        size: currentSize,
        type: isErasing ? 'eraser' : 'brush'
    });
}

canvas.addEventListener('mousedown', (e) => {
    drawing = true;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    prevX = x;
    prevY = y;

    if (currentShape && currentShape !== 'normal') {
        isDrawingShape = true;
        startX = x;
        startY = y;
    } else {
        isDrawingShape = false;
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (isDrawingShape) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        redrawAll();
        drawShapePreview(startX, startY, x, y);
    } else if (drawing) {
        draw(e);
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (isDrawingShape) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        isDrawingShape = false;
        shapes.push({ shape: currentShape, startX, startY, endX: x, endY: y, color: currentColor, size: currentSize });
        drawShape(startX, startY, x, y, currentColor, currentSize);
    }
    drawing = false;
    isDrawingShape = false;
    prevX = null;
    prevY = null;
    ctx.beginPath();
});

canvas.addEventListener('mouseout', () => {
    drawing = false;
    isDrawingShape = false;
    prevX = null;
    prevY = null;
    ctx.beginPath();
});

canvas.style.cursor = 'crosshair';

socket.on('drawing', (data) => {
    const { startX, startY, endX, endY, color, size, brushType } = data;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;

    ctx.setLineDash(brushType === 'dotted' ? [2, 2] : brushType === 'dashed' ? [5, 5] : []);

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
});

socket.on('loadDrawing', (drawingData) => {
    drawingData.forEach((data) => {
        draw(data);
    });
});

function drawShapePreview(startX, startY, endX, endY) {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    redrawAll();

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

    ctx.restore();
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
    lines.forEach(({ startX, startY, endX, endY, color, size, brushType }) => {
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.strokeStyle = color;

        ctx.setLineDash(brushType === 'dotted' ? [2, 2] : brushType === 'dashed' ? [5, 5] : []);

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    });
}

function redrawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
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
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        shapes = [];
        lines = [];
        socket.emit('clearCanvas');
    });
});

socket.on('clearCanvas', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
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
    isDrawingShape = false;
    isErasing = false;
    currentBrushType = 'normal';
    prevX = null;
    prevY = null;
    
    brushTypeSelect.value = 'normal';
    canvas.style.cursor = 'crosshair';
    ctx.setLineDash([]);
    eraserButton.classList.remove('active');
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

// Add resize observer for canvas
const resizeObserver = new ResizeObserver(() => {
    const oldCanvas = canvas.toDataURL();
    const img = new Image();
    img.src = oldCanvas;
    img.onload = () => {
        resizeCanvas();
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
});

resizeObserver.observe(canvas);
