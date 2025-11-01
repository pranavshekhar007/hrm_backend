const express = require("express");
const { sendResponse } = require("../utils/common");
require("dotenv").config();
const AttendanceRecord = require("../model/attendanceRecord.schema");
const attendanceRecordController = express.Router();
const auth = require("../utils/auth");
const mongoose = require("mongoose");
const moment = require("moment-timezone");
const Employee = require("../model/employee.schema");

attendanceRecordController.post("/create", async (req, res) => {
  try {
    const { inTime, outTime, breakHours = 0 } = req.body;

    let totalHours = 0;

    // Calculate total working time if inTime and outTime are provided
    if (inTime && outTime) {
      const [inH, inM] = inTime.split(":").map(Number);
      const [outH, outM] = outTime.split(":").map(Number);

      const inMinutes = inH * 60 + inM;
      const outMinutes = outH * 60 + outM;

      let diff = outMinutes - inMinutes;

      if (diff < 0) diff += 24 * 60;

      totalHours = diff / 60 - breakHours;
      if (totalHours < 0) totalHours = 0;
    }

    const recordCreated = await AttendanceRecord.create({
      ...req.body,
      totalHours: totalHours.toFixed(2),
    });

    sendResponse(res, 200, "Success", {
      message: "Attendance Record created successfully!",
      data: recordCreated,
      statusCode: 200,
    });
  } catch (error) {
    console.error("Attendance Record Create Error:", error);
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

attendanceRecordController.post("/list", auth, async (req, res) => {
  try {
    const {
      searchKey = "",
      employee,
      status,
      fromDate,
      toDate,
      pageNo = 1,
      pageCount = 10,
      sortByField,
      sortByOrder,
    } = req.body;

    const query = {};

    // 🧠 Fix: Find the linked employee by email (not user._id)
    if (req.user.role === "employee") {
      const employeeDoc = await Employee.findOne({ email: req.user.email });
      if (!employeeDoc) {
        return sendResponse(res, 404, "Failed", {
          message: "Employee profile not found",
        });
      }
      query.employee = employeeDoc._id;
    } else {
      // Admin / HR filters
      if (employee) query.employee = employee;
    }

    if (status) query.status = status;

    if (fromDate && toDate) {
      query.date = { $gte: new Date(fromDate), $lte: new Date(toDate) };
    }

    if (searchKey) {
      query.$or = [{ notes: { $regex: searchKey, $options: "i" } }];
    }

    const sortField = sortByField || "date";
    const sortOrder = sortByOrder === "asc" ? 1 : -1;
    const sortOption = { [sortField]: sortOrder };

    const records = await AttendanceRecord.find(query)
      .populate("employee", "fullName employeeId department")
      .sort(sortOption)
      .limit(parseInt(pageCount))
      .skip((pageNo - 1) * parseInt(pageCount));

    const totalCount = await AttendanceRecord.countDocuments(query);

    sendResponse(res, 200, "Success", {
      message: "Attendance Records retrieved successfully!",
      data: records,
      total: totalCount,
      statusCode: 200,
    });
  } catch (error) {
    console.error("Attendance Record List Error:", error);
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

attendanceRecordController.put("/update", async (req, res) => {
  try {
    const id = req.body._id;
    const recordData = await AttendanceRecord.findById(id);

    if (!recordData) {
      return sendResponse(res, 404, "Failed", {
        message: "Attendance Record not found",
      });
    }

    const updatedRecord = await AttendanceRecord.findByIdAndUpdate(
      id,
      req.body,
      { new: true }
    );

    sendResponse(res, 200, "Success", {
      message: "Attendance Record updated successfully!",
      data: updatedRecord,
      statusCode: 200,
    });
  } catch (error) {
    console.error("Attendance Record Update Error:", error);
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

attendanceRecordController.delete("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const recordItem = await AttendanceRecord.findById(id);
    if (!recordItem) {
      return sendResponse(res, 404, "Failed", {
        message: "Attendance Record not found",
      });
    }

    await AttendanceRecord.findByIdAndDelete(id);

    sendResponse(res, 200, "Success", {
      message: "Attendance Record deleted successfully!",
      statusCode: 200,
    });
  } catch (error) {
    console.error("Attendance Record Delete Error:", error);
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

attendanceRecordController.post("/checkin", auth, async (req, res) => {
  try {
    if (req.user.role !== "employee") {
      return sendResponse(res, 403, "Failed", {
        message: "Only employees can check in",
      });
    }

    const employee = await Employee.findOne({ email: req.user.email });
    if (!employee) {
      return sendResponse(res, 404, "Failed", {
        message: "Employee profile not found",
      });
    }

    const employeeId = employee._id;

    // ✅ Date setup (IST)
    const currentMoment = moment().tz("Asia/Kolkata");
    const dateOnly = currentMoment.startOf("day").toDate();

    const existingRecord = await AttendanceRecord.findOne({
      employee: employeeId,
      date: dateOnly,
    });

    if (existingRecord) {
      return sendResponse(res, 400, "Failed", {
        message: "You have already checked in today",
      });
    }

    const inTime = currentMoment.format("hh:mm A");

    const record = await AttendanceRecord.create({
      employee: employeeId,
      date: dateOnly,
      inTime,
      status: "Present",
      notes: "Checked in",
    });

    const populatedRecord = await AttendanceRecord.findById(
      record._id
    ).populate("employee", "fullName employeeId department");

    sendResponse(res, 200, "Success", {
      message: "Checked in successfully!",
      data: populatedRecord,
    });
  } catch (error) {
    console.error("Check-In Error:", error);
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

// ✅ Check-Out
attendanceRecordController.post("/checkout", auth, async (req, res) => {
  try {
    if (req.user.role !== "employee") {
      return sendResponse(res, 403, "Failed", {
        message: "Only employees can check out",
      });
    }

    const employee = await Employee.findOne({ email: req.user.email });
    if (!employee) {
      return sendResponse(res, 404, "Failed", {
        message: "Employee profile not found",
      });
    }

    const employeeId = employee._id;
    const currentMoment = moment().tz("Asia/Kolkata");
    const dateOnly = currentMoment.startOf("day").toDate();

    const record = await AttendanceRecord.findOne({
      employee: employeeId,
      date: dateOnly,
    });

    if (!record) {
      return sendResponse(res, 404, "Failed", {
        message: "No check-in record found for today. Please check in first.",
      });
    }

    if (record.outTime) {
      return sendResponse(res, 400, "Failed", {
        message: "You have already checked out today",
      });
    }

    const outTime = currentMoment.format("hh:mm A");

    // 🧮 Calculate total working hours (in decimal)
    const inTimeMoment = moment(record.inTime, "hh:mm A");
    const diffMinutes = currentMoment.diff(inTimeMoment, "minutes");
    const totalHours = (diffMinutes / 60).toFixed(2);

    record.outTime = outTime;
    record.totalHours = totalHours;
    record.notes = "Checked out";

    await record.save();

    const populatedRecord = await AttendanceRecord.findById(
      record._id
    ).populate("employee", "fullName employeeId department");

    sendResponse(res, 200, "Success", {
      message: "Checked out successfully!",
      data: populatedRecord,
    });
  } catch (error) {
    console.error("Check-Out Error:", error);
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

// ✅ Employee’s Own Records
attendanceRecordController.post("/my-records", auth, async (req, res) => {
  try {
    if (req.user.role !== "employee") {
      return sendResponse(res, 403, "Failed", {
        message: "Only employees can view their attendance records",
      });
    }

    // 🧠 Get employee via email
    const employee = await Employee.findOne({ email: req.user.email });
    if (!employee) {
      return sendResponse(res, 404, "Failed", {
        message: "Employee profile not found",
      });
    }

    const employeeId = employee._id;
    const {
      fromDate,
      toDate,
      pageNo = 1,
      pageCount = 10,
      sortByField = "date",
      sortByOrder = "desc",
    } = req.body;

    const query = { employee: employeeId };
    if (fromDate && toDate) {
      query.date = { $gte: new Date(fromDate), $lte: new Date(toDate) };
    }

    const sortOrder = sortByOrder === "asc" ? 1 : -1;
    const sortOption = { [sortByField]: sortOrder };

    const records = await AttendanceRecord.find(query)
      .populate("employee", "fullName employeeId department")
      .sort(sortOption)
      .limit(parseInt(pageCount))
      .skip((pageNo - 1) * parseInt(pageCount));

    const totalCount = await AttendanceRecord.countDocuments(query);

    sendResponse(res, 200, "Success", {
      message: "Attendance records retrieved successfully!",
      data: records,
      total: totalCount,
      statusCode: 200,
    });
  } catch (error) {
    console.error("My Attendance List Error:", error);
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

attendanceRecordController.get("/today", auth, async (req, res) => {
  try {
    if (req.user.role !== "employee") {
      return sendResponse(res, 403, "Failed", {
        message: "Only employees can view today's attendance details",
      });
    }

    const employee = await Employee.findOne({ email: req.user.email });
    if (!employee) {
      return sendResponse(res, 404, "Failed", {
        message: "Employee profile not found",
      });
    }

    const employeeId = employee._id;
    const currentMoment = moment().tz("Asia/Kolkata");
    const dateOnly = currentMoment.startOf("day").toDate();

    const record = await AttendanceRecord.findOne({
      employee: employeeId,
      date: dateOnly,
    }).populate("employee", "fullName employeeId department");

    if (!record) {
      return sendResponse(res, 404, "Failed", {
        message: "No attendance record found for today. Please check in first.",
      });
    }

    // 🕒 Ensure consistent 12-hour format
    const inTime12 = record.inTime
      ? moment(record.inTime, "hh:mm A").format("hh:mm A")
      : null;
    const outTime12 = record.outTime
      ? moment(record.outTime, "hh:mm A").format("hh:mm A")
      : null;

    sendResponse(res, 200, "Success", {
      message: "Today's attendance details retrieved successfully!",
      data: {
        date: record.date,
        inTime: inTime12,
        outTime: outTime12,
        totalHours: record.totalHours || null,
        status: record.status || "Absent",
        notes: record.notes || "",
        employee: record.employee,
      },
    });
  } catch (error) {
    console.error("Today's Attendance Fetch Error:", error);
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});


module.exports = attendanceRecordController;
