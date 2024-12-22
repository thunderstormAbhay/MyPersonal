const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Handle socket connections
io.on('connection', (socket) => {
    console.log('New client connected: ', socket.id);

    // Handle the drawing event
    socket.on('drawing', (data) => {
        // Broadcast the drawing data to all other connected clients
        socket.broadcast.emit('drawing', data);
    });
    
    socket.on('clearCanvas', () => {
        console.log('Clear canvas event received from client: ', socket.id);
        socket.broadcast.emit('clearCanvas'); // Broadcast clear canvas event
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Start the server
server.listen(3000, () => {
    console.log('Server running on http://localhost:3000'); 
});
