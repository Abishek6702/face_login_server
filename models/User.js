const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name : {type:String},
  email: { type: String, unique: true },
  password: String,
  faceDescriptors: { type: Array },
  otp: String,
  otpExpires: Date
});

module.exports = mongoose.model('User', UserSchema);
