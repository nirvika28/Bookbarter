const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const jwt = require("jsonwebtoken");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve the frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "chat.html"));
});
app.use(express.static(path.join(__dirname)));

// Socket.IO Connection
io.on("connection", (socket) => {
  // Validate token (if provided)
  const token = socket.handshake.query.token;
  let userGmail = "Guest";
  
  if (token) {
    try {
      const decoded = jwt.verify(token, "yourSecretKey");
      userGmail = decoded.gmail;
      console.log(`${userGmail} connected to the chat`);
    } catch (err) {
      console.log("Invalid token, user cannot join chat");
      socket.disconnect();
      return;
    }
  } else if (socket.handshake.query.gmail) {
    // Fallback: Get Gmail from query string
    userGmail = socket.handshake.query.gmail;
    console.log(`${userGmail} connected to the chat`);
  }

  // Broadcast messages
  socket.on("chatMessage", (msg) => {
    console.log("Message received:", msg);
    io.emit("chatMessage", { ...msg, sender: userGmail });
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log(`${userGmail} disconnected`);
  });
});

// Start the server
const PORT = 3002;
server.listen(PORT, () => {
  console.log(`Chat server running on http://localhost:${PORT}`);
});
