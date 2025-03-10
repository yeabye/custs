const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins (for Netlify deployment)
    methods: ["GET", "POST"],
  },
});

// Track connected customers and representatives
const customers = new Map(); // Map<UID, Socket>
const representatives = new Map(); // Map<SocketID, Socket>

// Generate a 5-digit UID
function generateUID() {
  return Math.floor(10000 + Math.random() * 90000); // Random 5-digit number
}

// Serve a simple homepage
app.get('/', (req, res) => {
  res.send('Customer Service Chat Backend');
});

// Handle socket connections
io.on('connection', (socket) => {
  console.log('A user connected');

  // Handle customer connections
  socket.on('register as customer', () => {
    const uid = generateUID();
    customers.set(uid, socket); // Store the customer's socket with their UID
    console.log(`Customer connected with UID: ${uid}`);
    socket.emit('uid', uid); // Send the UID to the customer

    // Listen for messages from the customer
    socket.on('chat message', (msg) => {
      console.log(`Message from Customer ${uid}: ${msg}`);
      // Broadcast the message to all representatives
      representatives.forEach((repSocket) => {
        repSocket.emit('customer message', { uid, msg });
      });
    });

    // Handle customer disconnections
    socket.on('disconnect', () => {
      console.log(`Customer ${uid} disconnected`);
      customers.delete(uid); // Remove the customer from the map
    });
  });

  // Handle customer service representative connections
  socket.on('register as representative', () => {
    representatives.set(socket.id, socket); // Store the representative's socket
    console.log('Customer service representative connected');

    // Listen for replies from the representative
    socket.on('reply', (data) => {
      const { uid, msg } = data;
      const customerSocket = customers.get(uid);
      if (customerSocket) {
        // Send the reply to the specific customer
        customerSocket.emit('chat message', `Customer Service: ${msg}`);
        console.log(`[Customer Service → Customer ${uid}]: ${msg}`);
      } else {
        console.log(`Customer ${uid} not found`);
      }
    });

    // Handle representative disconnections
    socket.on('disconnect', () => {
      console.log('Customer service representative disconnected');
      representatives.delete(socket.id); // Remove the representative from the map
    });
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});