const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const mysql = require('mysql');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(bodyParser.json());

// MySQL Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Nadagouni124',
    database: 'book_barter1',
});

db.connect((err) => {
    if (err) throw err;
    console.log('Database connected');
});

// Socket.IO for real-time notifications
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle custom events if needed
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
    });
});

// Create a notification
app.post('/notifications', async(req, res) => {
    const { userID, message, type } = req.body;
    const query = `
        INSERT INTO notifications (user_id, message, type)
        VALUES (?, ?, ?)
    `;
    db.query(query, [userID, message, type], (err) => {
        if (err) return res.status(500).send(err);
        io.emit('notification', { userID, message, type });
        res.status(200).send({ success: true, message: 'Notification created' });
    });
    // Store in notifications table
await db.query(
    'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
    [proposal.sender_id, `Your proposal was accepted! Contact your swap partner at: ${receiver.email}`]
  );
  await db.query(
    'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
    [proposal.receiver_id, `You accepted a proposal! Contact your swap partner at: ${sender.email}`]
  );
  
});

// Fetch notifications for a user
app.get('/notifications/:userID', (req, res) => {
    const { userID } = req.params;
    const query = `SELECT * FROM notifications WHERE user_id = ? ORDER BY timestamp DESC`;
    db.query(query, [userID], (err, results) => {
        if (err) return res.status(500).send(err);
        res.status(200).send(results);
    });
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
