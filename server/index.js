const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Array to store drawing data
let drawingData = [];

// Handle socket connections
io.on('connection', (socket) => {
    console.log('New client connected: ', socket.id);

    // Send existing drawing data to the new client
    socket.emit('loadDrawing', drawingData);

    // Handle the drawing event
    socket.on('drawing', (data) => {
        // Add the new drawing data to the array
        drawingData.push(data);
        // Broadcast the drawing data to all other connected clients
        socket.broadcast.emit('drawing', data);
    });

    socket.on('clearCanvas', () => {
        console.log('Clear canvas event received from client: ', socket.id);
        // Clear the drawing data array
        drawingData = [];
        // Broadcast the clearCanvas event to all other connected clients
        socket.broadcast.emit('clearCanvas');
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
