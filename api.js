const express = require('express');
const router = express.Router();

let roomsRef = null;

router.use((req, res, next) => {
  if (!roomsRef) return res.status(500).json({ error: "Room data not available" });
  next();
});

router.get('/rooms', (req, res) => {
  const roomList = []; 
  for (const [roomId, room] of roomsRef.entries()) {
    roomList.push({
      roomId,
      userCount: room.users.size, 
      userIds: Array.from(room.users.keys()), 
    });
  }
  res.json({ activeRooms: roomList });
});

module.exports = {
  router,
  setRoomsMap: (rooms) => roomsRef = rooms
};
