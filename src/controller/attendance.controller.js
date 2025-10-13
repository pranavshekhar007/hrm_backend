const express = require("express");
const { sendResponse } = require("../utils/common");
const Attendance = require("../model/attendance.schema")
const attendanceController = express.Router();
const auth = require("../utils/auth");

attendanceController.post("/create", async (req, res) => {
  try {
    const attendanceCreated = await Attendance.create(req.body);
    sendResponse(res, 200, "Success", {
      message: "Attendance recorded successfully!",
      data: attendanceCreated,
      statusCode: 200,
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, 500, "Failed", { message: error.message || "Internal server error" });
  }
});

attendanceController.post("/list", async (req, res) => {
  try {
    const { userId, status, pageNo = 1, pageCount = 10 } = req.body;
    const query = {};
    if (userId) query.userId = userId;
    if (status) query.status = status;

    const attendanceList = await Attendance.find(query)
      .populate("userId")
      .limit(pageCount)
      .skip((pageNo - 1) * pageCount)
      .sort({ date: -1 });

    const totalCount = await Attendance.countDocuments(query);

    sendResponse(res, 200, "Success", {
      message: "Attendance list retrieved successfully!",
      data: attendanceList,
      total: totalCount,
      statusCode: 200,
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, 500, "Failed", { message: error.message || "Internal server error" });
  }
});

attendanceController.put("/update", async (req, res) => {
  try {
    const id = req.body._id;
    const attendanceData = await Attendance.findById(id);
    if (!attendanceData) return sendResponse(res, 404, "Failed", { message: "Attendance not found" });

    const updatedAttendance = await Attendance.findByIdAndUpdate(id, req.body, { new: true });

    sendResponse(res, 200, "Success", {
      message: "Attendance updated successfully!",
      data: updatedAttendance,
      statusCode: 200,
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, 500, "Failed", { message: error.message || "Internal server error" });
  }
});

attendanceController.delete("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const attendanceItem = await Attendance.findById(id);
    if (!attendanceItem) return sendResponse(res, 404, "Failed", { message: "Attendance not found" });

    await Attendance.findByIdAndDelete(id);

    sendResponse(res, 200, "Success", { message: "Attendance deleted successfully!", statusCode: 200 });
  } catch (error) {
    console.error(error);
    sendResponse(res, 500, "Failed", { message: error.message || "Internal server error" });
  }
});

module.exports = attendanceController;
