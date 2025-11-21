// server.js

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.JWT_SECRET || "mysecret",
  resave: false,
  saveUninitialized: false,
}));

const authRoutes = require("./routes/authroute");
app.use("/auth", authRoutes);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"));
});

app.use(express.static("public"));

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

app.use("/uploads", express.static(uploadDir));




let otps = {}; 


const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,   
    pass: process.env.GMAIL_PASS  
  }
});


app.post("/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email required" });

  const otp = crypto.randomInt(100000, 999999).toString();
  otps[email] = otp;

  const mailOptions = {
    from: `"WebRTC Login" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: "Your One Time Password",
    text: `OTP for Your Web RTC is ${otp}. It will expire in 5 minutes.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`OTP sent to ${email}: ${otp}`);
res.json({ success: true, message: "OTP sent successfully" });
    setTimeout(() => delete otps[email], 300000);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to send OTP", error });
  }
});


app.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ message: "Email & OTP required" });

  if (otps[email] && otps[email] === otp) {
    delete otps[email];
    return res.json({ success: true, message: "OTP verified successfully" });
  }

  res.status(400).json({ success: false, message: "Invalid or expired OTP" });
});

app.post("/upload-video", upload.single("video"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No video file uploaded" });
  }

  console.log("🎥 Video uploaded:", req.file.path);

  res.json({
    success: true,
    message: "Video uploaded successfully!",
    fileUrl: `/uploads/${req.file.filename}`,
  });
});

app.post("/send-reminder", async (req, res) => {
  const { reminderDate, reminderMsg, userEmail, username } = req.body;

  if (!reminderDate || !reminderMsg || !userEmail) {
    return res.status(400).json({ message: "Missing fields!" });
  }

  const mailOptions = {
    from: `"Meeting Reminder" <${process.env.GMAIL_USER}>`,
    to: userEmail,
    subject: "Meeting Scheduled",
    text: `📅 Your meeting is on ${reminderDate}\n📝 Message: ${reminderMsg}\n\nSent by - ${username || "Anonymous"}`, 
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("✅ Reminder mail sent to:", userEmail);
    res.json({ message: "Meeting reminder sent successfully!" });
  } catch (error) {
    console.error("❌ Mail sending failed:", error);
    res.status(500).json({ message: "Error sending mail" });
  }
});





const rooms = new Map();

io.on('connection', (socket) => {
  socket.on('join', ({ roomId, username }) => {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { users: new Set(), usernames: new Map(), callerId: socket.id });
  }

  const room = rooms.get(roomId);

  if (room.users.size >= 3) {
    socket.emit('room-full');
    return;
  }

  const callerId = room.callerId;

  if (socket.id === callerId && room.users.size === 0) {
    room.users.add(socket.id);
    room.usernames.set(socket.id, username);
    socket.join(roomId);
    socket.data.roomId = roomId;

    io.to(roomId).emit('user-joined', username);

    const participantList = Array.from(room.usernames.values());
    io.to(roomId).emit('update-participants', participantList);

    socket.emit('room-joined', { callerId });     //after user 1 clicks startBtn
    return;
  }

  if (socket.id !== callerId) {
    socket.data.pendingJoin = { roomId, username };
    io.to(callerId).emit('join-request', { requestorId: socket.id, username });
    return;
  }
});


  socket.on('join-response', ({ requestorId, accepted }) => {
  const requestSocket = io.sockets.sockets.get(requestorId);
  if (!requestSocket || !requestSocket.data.pendingJoin) return;

  const { roomId, username } = requestSocket.data.pendingJoin;
  const room = rooms.get(roomId);
  if (!room || socket.id !== room.callerId) return;

  if (accepted) {
    room.users.add(requestorId);
    room.usernames.set(requestorId, username);
    requestSocket.join(roomId);
    requestSocket.data.roomId = roomId;

    requestSocket.emit('room-joined', { callerId: room.callerId });
    io.to(roomId).emit('user-joined', username);

    const participantList = Array.from(room.usernames.values());
    io.to(roomId).emit('update-participants', participantList);
  } else {
    requestSocket.emit('join-denied');
  }
});


  socket.on('ready-for-offer', (roomId) => {      
    socket.to(roomId).emit('ready-to-call', roomId);
  });

  socket.on('offer', (data) => {
    socket.to(data.room).emit('offer', data.offer);
  });

  socket.on('answer', (data) => {
    socket.to(data.room).emit('answer', data.answer);
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.room).emit('ice-candidate', data.candidate);
  });

  socket.on('negotiate', (roomId) => {
    socket.to(roomId).emit('negotiate');
  });

  socket.on('rejoin-room', ({ roomId, userName }) => {
  let room = rooms.get(roomId);

    if (!room) {
    room = { users: new Set(), usernames: new Map(), callerId: socket.id };
    rooms.set(roomId, room);
    console.log(`Room ${roomId} recreated for rejoin by ${userName}`);
  }

     room.users.add(socket.id);
  room.usernames.set(socket.id, userName);
  socket.join(roomId);
  socket.data.roomId = roomId;


    socket.emit('room-joined', { callerId: room.callerId });
        io.to(roomId).emit('user-joined', userName);

    socket.to(roomId).emit('ready-to-call', roomId);
  });


socket.on("newReminder", (reminder) => {
  io.to(reminder.room).emit("reminderAdded", reminder);
});


  socket.on("reaction", ({ roomId, username, emoji }) => {
    io.to(roomId).emit("reaction-display", { username, emoji });
  });

socket.on('chat-message', ({ room, username, message, timestamp }) => {
  socket.to(room).emit('chat-message', { username, message, timestamp });
});

  socket.on('leave-call', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const isCaller = socket.id === room.callerId;

    if (isCaller) {
      if (room.users.size === 1) {
        room.users.delete(socket.id);
        socket.leave(roomId);
        rooms.delete(roomId);
        socket.emit('left-call');
      } else {
        socket.emit('cannot-leave', 'Callee is still in the call. As a caller, you cannot leave.');
      }
    } else {
      room.users.delete(socket.id);
      socket.leave(roomId);
      socket.emit('left-call');
      socket.to(roomId).emit('peer-left');
    }
  });


  socket.on('end-call', () => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.callerId) return;

    for (const id of room.users) {
      io.to(id).emit('call-ended');
    }
    rooms.delete(roomId);
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);

    if (room) {
      room.users.delete(socket.id);
      if (room.users.size === 0) {
        rooms.delete(roomId);
      } else {
        socket.to(roomId).emit('peer-left');
      }
    }
  });

  socket.on('raise-hand', ({ username, room }) => {
    socket.to(room).emit('raise-hand', { username });
    socket.emit('raise-hand', { username });
  });

  socket.on('file-share', ({ room, username, fileName, data }) => {
    io.to(room).emit('file-share', { username, fileName, data });
  });
});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
