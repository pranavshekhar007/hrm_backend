const mongoose = require("mongoose");
const timestamps = require("mongoose-timestamp");

const meetingRoomSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  type: {
    type: String,
    enum: ["physical", "virtual"],
    required: true,
  },
  location: {
    type: String,
    trim: true,
  },
  capacity: {
    type: Number,
    required: true,
  },
  equipment: {
    type: [String],
    default: [],
  },
  bookingUrl: {
    type: String,
    trim: true,
  },
  status: {
    type: Boolean,
    default: true,
  },
});

meetingRoomSchema.plugin(timestamps);

module.exports = mongoose.model("MeetingRoom", meetingRoomSchema);
