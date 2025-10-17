const mongoose = require("mongoose");
const timestamps = require("mongoose-timestamp");

const terminationSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",
    required: true,
  },
  terminationType: {
    type: String,
    enum: [
      "Voluntary",
      "Involuntary",
      "Layoff",
      "Retirement",
      "Contract Completion",
      "Probation Failure",
      "Misconduct",
      "Performance Issues",
    ],
    required: true,
  },
  noticeDate: {
    type: Date,
  },
  terminationDate: {
    type: Date,
    required: true,
  },
  noticePeriod: {
    type: String,
  },
  reason: {
    type: String,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  documents: {
    type: String,
  },
});

terminationSchema.plugin(timestamps);

module.exports = mongoose.model("Termination", terminationSchema);
