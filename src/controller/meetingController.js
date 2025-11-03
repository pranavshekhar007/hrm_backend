const express = require("express");
const { sendResponse } = require("../utils/common");
const Meeting = require("../model/meeting.schema");
const auth = require("../utils/auth");
require("dotenv").config();

const meetingController = express.Router();

// ✅ Create Meeting
meetingController.post("/create", async (req, res) => {
  try {
    const meeting = await Meeting.create(req.body);
    sendResponse(res, 200, "Success", {
      message: "Meeting created successfully!",
      data: meeting,
      statusCode: 200,
    });
  } catch (error) {
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

meetingController.post("/list", auth, async (req, res) => {
    try {
      const {
        searchKey = "",
        meetingType,
        meetingRoom,
        organizer,
        recurrence,
        status,
        startDate,
        endDate,
        pageNo = 1,
        pageCount = 10,
        sortByField,
        sortByOrder,
      } = req.body;
  
      const query = {};
  
      // ✅ Restrict employees to see only their own meetings
      if (req.user?.role === "employee") {
        query.organizer = req.user._id;
      } else {
        // 🔹 Admin / HR can use all filters
        if (meetingType) query.meetingType = meetingType;
        if (meetingRoom) query.meetingRoom = meetingRoom;
        if (organizer) query.organizer = organizer;
        if (recurrence) query.recurrence = recurrence;
        if (status !== undefined) query.status = status;
      }
  
      // 🔹 Date Range Filter
      if (startDate && endDate) {
        query.meetingDate = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }
  
      // 🔹 Search by title, description, or agenda
      if (searchKey) {
        query.$or = [
          { title: { $regex: searchKey, $options: "i" } },
          { description: { $regex: searchKey, $options: "i" } },
          { agenda: { $regex: searchKey, $options: "i" } },
        ];
      }
  
      const sortField = sortByField || "meetingDate";
      const sortOrder = sortByOrder === "asc" ? 1 : -1;
  
      const data = await Meeting.find(query)
        .populate("meetingType", "name")
        .populate("meetingRoom", "name location")
        .populate("organizer", "fullName email role")
        .sort({ [sortField]: sortOrder })
        .skip((pageNo - 1) * parseInt(pageCount))
        .limit(parseInt(pageCount));
  
      const total = await Meeting.countDocuments(query);
  
      sendResponse(res, 200, "Success", {
        message: "Meeting list fetched successfully!",
        data,
        total,
        statusCode: 200,
      });
    } catch (error) {
      console.error("Meeting List Error:", error);
      sendResponse(res, 500, "Failed", { message: error.message });
    }
  });
  

// ✅ Get Meeting by ID
meetingController.get("/get/:id", async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate("meetingType", "name")
      .populate("meetingRoom", "name location")
      .populate("organizer", "fullName email");

    if (!meeting)
      return sendResponse(res, 404, "Failed", { message: "Meeting not found" });

    sendResponse(res, 200, "Success", {
      message: "Meeting fetched successfully!",
      data: meeting,
      statusCode: 200,
    });
  } catch (error) {
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

// ✅ Update Meeting
meetingController.put("/update/:id", async (req, res) => {
  try {
    const meeting = await Meeting.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!meeting)
      return sendResponse(res, 404, "Failed", { message: "Meeting not found" });

    sendResponse(res, 200, "Success", {
      message: "Meeting updated successfully!",
      data: meeting,
      statusCode: 200,
    });
  } catch (error) {
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

// ✅ Change Status (Active/Cancelled)
meetingController.put("/change-status/:id", async (req, res) => {
  try {
    const { status } = req.body;
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting)
      return sendResponse(res, 404, "Failed", { message: "Meeting not found" });

    meeting.status = status;
    const updated = await meeting.save();

    sendResponse(res, 200, "Success", {
      message: "Meeting status updated successfully!",
      data: updated,
      statusCode: 200,
    });
  } catch (error) {
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

// ✅ Delete Meeting
meetingController.delete("/delete/:id", async (req, res) => {
  try {
    const meeting = await Meeting.findByIdAndDelete(req.params.id);
    if (!meeting)
      return sendResponse(res, 404, "Failed", { message: "Meeting not found" });

    sendResponse(res, 200, "Success", {
      message: "Meeting deleted successfully!",
      statusCode: 200,
    });
  } catch (error) {
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

module.exports = meetingController;
