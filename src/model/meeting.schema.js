const mongoose = require("mongoose");
const timestamps = require("mongoose-timestamp");

const meetingSchema = mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  meetingType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MeetingType",
    required: true,
  },
  meetingRoom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MeetingRoom",
    required: true,
  },
  meetingDate: {
    type: Date,
    required: true,
  },
  startTime: {
    type: String, // "09:00 AM"
    required: true,
  },
  endTime: {
    type: String, // "10:30 AM"
    required: true,
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",
    required: true,
  },
  recurrence: {
    type: String,
    enum: ["None", "Daily", "Weekly", "Monthly"],
    default: "None",
  },
  recurrenceEndDate: {
    type: Date,
  },
  agenda: {
    type: String,
    trim: true,
  },
  status: {
    type: Boolean,
    default: true, // Active or cancelled
  },
});

meetingSchema.plugin(timestamps);

module.exports = mongoose.model("Meeting", meetingSchema);
