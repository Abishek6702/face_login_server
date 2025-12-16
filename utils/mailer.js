// utils/mailer.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,    // Your Gmail address
    pass: process.env.EMAIL_PASS     // App password or real password
  }
});

module.exports = transporter;
