// routes/authroute.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db"); 

// --- REGISTER ---
router.post("/signup", async (req, res) => {
  const { username, email, password, cpassword } = req.body;

  db.query("SELECT email FROM userdata WHERE email=?", [email], async (error, result) => {
    if (result.length > 0) {
      return res.status(400).json({ msg: "Email already taken" });
    } else if (password !== cpassword) {
      return res.status(400).json({ msg: "Passwords do not match" });
    }

    let hashedPassword = await bcrypt.hash(password, 8);
    const userid = Math.floor(Math.random() * 10000);

    db.query(
      "INSERT INTO userdata (userid, username, email, password) VALUES (?, ?, ?, ?)",
      [userid, username, email, hashedPassword],
      (error) => {
        if (error) {
          console.error("SQL Error:", error);
          return res.status(500).json({ msg: "Database error" });
        }
        res.status(200).json({ msg: "Registration successful!" });
      }
    );
  });
});

// --- LOGIN ---
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ msg: "Both fields are required" });

  db.query("SELECT * FROM userdata WHERE email=?", [email], async (error, result) => {
    if (result.length <= 0)
      return res.status(400).json({ msg: "User not found" });

    if (!(await bcrypt.compare(password, result[0].password)))
      return res.status(400).json({ msg: "Incorrect password" });

    const userid = result[0].userid;
    const token = jwt.sign({ userid: userid }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.cookie("webrtc_token", token, {
      httpOnly: true,
      expires: new Date(Date.now() + 86400000),
    });

    req.session.user = result[0];
    res.status(200).json({ msg: "Login successful", user: result[0] });
  });
});

module.exports = router;
