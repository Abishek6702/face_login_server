const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const transporter = require('../utils/mailer');
const threshold = 0.45; 

exports.register = async (req, res) => {
  const { name, email, password, descriptors } = req.body;
  if (
    !name ||
    !email ||
    !password ||
    !descriptors ||
    !Array.isArray(descriptors) ||
    descriptors.length === 0
  ) {
    return res.status(400).json({
      error:
        "Name, Email, password, and at least one face descriptor are required.",
    });
  }

  try {
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ error: "Email already registered." });
    }

    const users = await User.find({
      faceDescriptors: { $exists: true, $ne: [] },
    });
    for (const user of users) {
      for (const stored of user.faceDescriptors) {
        for (const incoming of descriptors) {
          const dist = Math.sqrt(
            stored.reduce(
              (acc, val, i) => acc + Math.pow(val - incoming[i], 2),
              0
            )
          );
          if (dist < threshold) {
            return res
              .status(400)
              .json({ error: "A similar face is already registered." });
          }
        }
      }
    }

    const hash = await bcrypt.hash(password, 10);
    const user = new User({
      name,
      email,
      password: hash,
      faceDescriptors: descriptors,
    });
    await user.save();
    res.json({ message: "User registered" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Login: email/password
exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required." });
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: "Invalid credentials" });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    res.json({ token, email: user.email });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Login with face only
exports.faceLogin = async (req, res) => {
  const { descriptor } = req.body;
  if (!descriptor || !Array.isArray(descriptor))
    return res
      .status(400)
      .json({ error: "Missing or invalid face descriptor" });

  try {
    const users = await User.find({
      faceDescriptors: { $exists: true, $ne: [] },
    });
    const threshold = 0.45;

    for (const user of users) {
      for (const stored of user.faceDescriptors) {
        const dist = Math.sqrt(
          stored.reduce(
            (acc, val, i) => acc + Math.pow(val - descriptor[i], 2),
            0
          )
        );
        if (dist < threshold) {
          const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
          return res.json({ token, email: user.email });
        }
      }
    }
    res.status(400).json({ error: "Face not recognized" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found." });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    // Send email
    await transporter.sendMail({
      to: email,
      subject: "Your OTP for Password Reset",
      html: `<h3>Your OTP: <b>${otp}</b></h3><p>Valid for 10 minutes.</p>`
    });

    res.json({ message: "OTP sent to your email." });
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
};

// Verify OTP
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });
    if (!user || user.otp !== otp || Date.now() > user.otpExpires) {
      return res.status(400).json({ error: "Invalid or expired OTP." });
    }
    res.json({ message: "OTP verified." });
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword, otp } = req.body;
    const user = await User.findOne({ email });
    if (!user || user.otp !== otp || Date.now() > user.otpExpires) {
      return res.status(400).json({ error: "Invalid or expired OTP." });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();
    res.json({ message: "Password reset successful!" });
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
};
