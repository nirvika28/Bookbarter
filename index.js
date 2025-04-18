const express = require("express");
const bodyParser = require("body-parser"); // Note: express.json() is likely sufficient
const mysql = require("mysql2/promise");
const cors = require("cors");
const jwt = require("jsonwebtoken");


const path = require("path");
const bcrypt = require("bcrypt");
require("dotenv").config();
const setupChatServer = require("./chatserver.js");
// --- NEW: Import necessary modules ---
const http = require('http'); // Import Node.js http module
// Import Socket.IO Server class
const { Server } = require("socket.io");
const app = express();
app.use(express.json());
const bookRouter = express.Router(); // Router instance for book-related routes
app.use("/api/books", bookRouter);
const exchangeRouter = express.Router(); // Router instance for exchange-related routes
app.use("/api/exchange-proposals", exchangeRouter);
const userRouter = express.Router(); // Router instance for user-related routes
app.use("/api/users", userRouter);

// Middleware
const frontendUrl = "http://localhost:5000"; // Replace with your actual frontend URL
// In your backend index.js

app.use(cors({
  origin: 'http://localhost:5000', // Explicitly allow frontend port
  credentials: true
}));




app.use(express.static("C:/Users/nirvika/Desktop/bookbarter"));
// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "Nadagouni124",
  database: process.env.DB_NAME || "book_barter1",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

pool
  .getConnection()
  .then(() => {
    console.log("Connected to MySQL successfully!");
  })
  .catch((err) => {
    console.error("Error connecting to MySQL:", err);
  });

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  jwt.verify(token, process.env.JWT_SECRET || "yourSecretKey", (err, user) => {
    if (err) {
      console.log("JWT verification error:", err.message);
      return res.status(403).json({ success: false, message: "Invalid or expired token" });
    }
    
    console.log("Decoded JWT user:", user); // Should now show the 'id' field
    req.user = user;
    next();
  });
};

app.get("/chat", (req, res) => {
  res.sendFile(path.join(__dirname, "chat.html"));
});

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
};

// --- User Routes ---

// User Login
app.post("/api/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    }

    const [users] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const user = users[0];

    // If you're not using hashed passwords yet, you can use this direct comparison
    // In production, you should migrate to bcrypt
    const passwordMatch = user.password === password;

    // For bcrypt (when implemented):
    // const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || "yourSecretKey",
      {
        expiresIn: "24h",
      },
    );

    // Don't send password back to client
    delete user.password;

    res.json({
      success: true,
      token,
      user,
      message: "Login successful",
    });
  } catch (err) {
    next(err);
  }
});

// --- Book Routes ---

// Add Book
bookRouter.post("/", authenticateToken, async (req, res, next) => {
  try {
    const { title, author, genre } = req.body;
    const userId = req.user.id; // Get user ID from the authenticated token

    if (!title || !author || !genre) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: title, author, and genre are required",
      });
    }

    // Insert the book
    const [result] = await pool.query(
      "INSERT INTO books (user_id, title, author, genre) VALUES (1, ?, ?, ?)",
      [userId, title, author, genre],
    );

    if (!result.insertId) {
      return res.status(500).json({
        success: false,
        message: "Failed to save the book",
      });
    }

    // Get the newly created book
    const [books] = await pool.query("SELECT * FROM books WHERE id = ?", [result.insertId]);

    if (books.length === 0) {
      return res.status(500).json({
        success: false,
        message: "Book added but could not retrieve details",
      });
    }

    res.status(201).json({
      success: true,
      book: books[0],
      message: "Book added successfully",
    });
  } catch (err) {
    console.error("Error adding book:", err);
    next(err);
  }
});

// Get All Books
bookRouter.get("/", async (req, res, next) => {
  try {
    const [books] = await pool.query(`
      SELECT b.*
      FROM books b
      JOIN users u ON b.user_id = u.id
      ORDER BY b.id DESC
    `);

    res.json(books); // Directly send the array of books
  } catch (err) {
    console.error("Error fetching books:", err);
    next(err);
  }
});

// Get Books by User ID (using a dedicated user route)
userRouter.get("/:userId/books", async (req, res, next) => {
  try {
    const userId = req.params.userId;

    const [books] = await pool.query("SELECT * FROM books WHERE user_id = ? ORDER BY id DESC", [
      userId,
    ]);

    res.json(books); // Directly send the array of books
  } catch (err) {
    next(err);
  }
});

// --- Exchange Proposal Routes ---


exchangeRouter.get("/user", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    console.log("User ID:", userId);
 // This is fine as is - it's just a variable name
 const [proposals] = await pool.query(
  `
  SELECT
    p.proposal_id,
    p.status,
    p.sender_id,
    p.receiver_id,
    p.sender_book_id,
    p.receiver_book_id,
    sb.title AS sender_book_title,
    rb.title AS receiver_book_title,
    su.username AS sender_name,
    ru.username AS receiver_name,
    p.created_at
  FROM book_exchange_proposals p
  LEFT JOIN books sb ON p.sender_book_id = sb.id
  LEFT JOIN books rb ON p.receiver_book_id = rb.id
  JOIN users su ON p.sender_id = su.id
  JOIN users ru ON p.receiver_id = ru.id
  WHERE p.sender_id = ? OR p.receiver_id = ?
  ORDER BY p.created_at DESC
  `,
  [userId, userId],
);
   console.log("Proposals:", proposals);
    res.json({
      success: true,
      proposals,
      count: proposals.length,
    });
  } catch (err) {
    console.error("Error fetching proposals:", err);
    next(err);
  }
});

// Update Proposal Status (NO CHANGES NEEDED)
exchangeRouter.put("/:proposalId", authenticateToken, async (req, res, next) => {
  // This endpoint allows a user to update the status of a proposal.
  // Only the sender or receiver of the proposal can update its status.
  // The new status (e.g., 'accepted', 'rejected', 'completed') is provided in the request body.
  // The proposalId is taken from the URL parameter.
  // Example request body: { status: "accepted" }
  try {
    const { status } = req.body;
    const { proposalId } = req.params;
    const userId = req.user.id;

    // Validate status
    const validStatuses = ['pending', 'accepted', 'rejected', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status value." });
    }

    // Check if the proposal exists and the user is involved
    const [proposals] = await pool.query(
      "SELECT * FROM book_exchange_proposals WHERE proposal_id = ? AND (sender_id = ? OR receiver_id = ?)",
      [proposalId, userId, userId]
    );
    if (proposals.length === 0) {
      return res.status(404).json({ success: false, message: "Proposal not found or access denied." });
    }

    // Update the proposal status
    await pool.query(
      "UPDATE book_exchange_proposals SET status = ? WHERE proposal_id = ?",
      [status, proposalId]
    );

    res.json({ success: true, message: "Proposal status updated." });
  } catch (err) {
    console.error("Error updating proposal status:", err);
    next(err);
  }
});

// Create Exchange Proposal (CORRECTED)
exchangeRouter.post("/", authenticateToken, async (req, res, next) => {
  try {
    const { receiverId, senderBookId, receiverBookId } = req.body;
    const senderId = req.user.id; // This is fine as is

    if (!receiverId || !senderBookId || !receiverBookId) {
      return res.status(400).json({
        success: false,
        message: "All fields are required: receiverId, senderBookId, receiverBookId",
      });
    }

    // Prevent a user from sending an exchange request to their own book
    if (senderId === parseInt(receiverId)) {
      return res.status(400).json({
        success: false,
        message: "You cannot send an exchange request to your own book.",
      });
    }

    // Check if receiver ID is a valid user
    const [receiverUsers] = await pool.query("SELECT * FROM users WHERE id = ?", [
      receiverId,
    ]);
    if (receiverUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Receiver user not found",
      });
    }

    // Check if sender's book exists and belongs to the sender
    const [senderBooks] = await pool.query("SELECT * FROM books WHERE id = ? AND user_id = ?", [
      senderBookId,
      senderId,
    ]);

    if (senderBooks.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Your book not found or doesn't belong to you",
      });user_
    }

    // Check if receiver's book exists
    const [receiverBooks] = await pool.query(
      "SELECT * FROM books WHERE id = ? AND user_id = ?",
      [receiverBookId, receiverId]
    );

    if (receiverBooks.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Receiver's book not found",
      });
    }

    // Check for existing pending proposal between these two books (in either direction)
    const [existingProposals] = await pool.query(
      `
      SELECT * FROM book_exchange_proposals
      WHERE (sender_book_id = ? AND receiver_book_id = ? AND status = 'pending')
         OR (sender_book_id = ? AND receiver_book_id = ? AND status = 'pending')
    `,
      [senderBookId, receiverBookId, receiverBookId, senderBookId],
    );

    if (existingProposals.length > 0) {
      return res.status(409).json({
        success: false,
        message: "A pending proposal already exists for these books",
      });
    }

    // Create proposal
    const [result] = await pool.query(
      `
      INSERT INTO book_exchange_proposals
      (sender_id, receiver_id, sender_book_id, receiver_book_id, status)
      VALUES (?, ?, ?, ?, 'pending')
    `,
      [senderId, receiverId, senderBookId, receiverBookId],
    );

    res.status(201).json({
      success: true,
      proposalId: result.insertId,
      message: "Exchange proposal created successfully",
    });
  } catch (err) {
    console.error("Error creating proposal:", err);
    next(err);
  }
});

app.post('/api/contact', async (req, res) => {
  const { email, message } = req.body;
  if (!email || !message) {
    return res.status(400).json({ message: 'All fields are required.' });
  }
  // Option 1: Store in database for admin review
  await pool.execute('INSERT INTO support_messages (email, message) VALUES (?, ?)', [email, message]);
  // Option 2: Send an email to admin (using nodemailer or similar)
  // await sendSupportEmail(email, message);

  res.json({ message: 'Thank you for contacting us! We will respond soon.' });
});

app.post('/api/contact', async (req, res) => {
  const { email, message } = req.body;
  if (!email || !message) {
    return res.status(400).json({ message: 'All fields are required.' });
  }
  try {
    // Example: Store in database
    await pool.execute('INSERT INTO support_messages (email, message) VALUES (?, ?)', [email, message]);
    res.json({ message: 'Thank you for contacting us! We will respond soon.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Apply error handler middleware
app.use(errorHandler);
// --- NEW: Create HTTP Server and Initialize Socket.IO ---
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: frontendUrl, // Allow requests from your frontend URL
    methods: ["GET", "POST"]
  }
});

// --- NEW: Socket.IO Connection Logic ---
// Optional: Keep track of connected users/sockets if needed for direct messaging
const userSockets = new Map(); // Example: Map<userId, socketId>

io.on('connection', (socket) => {
  console.log('🚀 A user connected via Socket.IO:', socket.id);

  // Optional: Associate user ID with socket ID upon connection
  // You might need the client to send an 'authenticate' or 'register_user' event
  // after connecting, possibly sending the JWT token for verification.
  socket.on('register_user', (userId) => {
    if (userId) {
      console.log(`Registering user ${userId} with socket ${socket.id}`);
      userSockets.set(userId.toString(), socket.id); // Ensure userId is string for key
    }
  });

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

  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
    // Optional: Remove user from tracking on disconnect
    for (let [userId, id] of userSockets.entries()) {
      if (id === socket.id) {
        userSockets.delete(userId);
        console.log(`Unregistered user ${userId}`);
        break;
      }
    }
  });
});

// Start Server
const PORT = process.env.PORT || 5001;
// --- IMPORTANT: Use httpServer.listen() instead of app.listen() ---
httpServer.listen(PORT, () => {
  console.log(`🚀 Server (including Socket.IO) running on http://localhost:${PORT}`);


});


// Change this to your desired port

// For Windows

// Handle uncaught exceptions
//process.on("uncaughtException", (err) => {
 // console.error("Uncaught Exception:", err);
 // process.exit(1);
//});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});