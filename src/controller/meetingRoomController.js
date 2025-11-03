const express = require("express");
const { sendResponse } = require("../utils/common");
const MeetingRoom = require("../model/meetingRoom.schema");
require("dotenv").config();

const meetingRoomController = express.Router();

// ✅ Create Meeting Room
meetingRoomController.post("/create", async (req, res) => {
  try {
    const meetingRoom = await MeetingRoom.create(req.body);
    sendResponse(res, 200, "Success", {
      message: "Meeting room created successfully!",
      data: meetingRoom,
      statusCode: 200,
    });
  } catch (error) {
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

// ✅ List Meeting Rooms (with search, pagination, sort, filter by status/type)
meetingRoomController.post("/list", async (req, res) => {
  try {
    const {
      searchKey = "",
      type,
      status,
      pageNo = 1,
      pageCount = 10,
      sortByField,
      sortByOrder,
    } = req.body;

    const query = {};
    if (type) query.type = type;
    if (status !== undefined) query.status = status;

    if (searchKey) {
      query.$or = [
        { name: { $regex: searchKey, $options: "i" } },
        { description: { $regex: searchKey, $options: "i" } },
        { location: { $regex: searchKey, $options: "i" } },
      ];
    }

    const sortField = sortByField || "createdAt";
    const sortOrder = sortByOrder === "asc" ? 1 : -1;

    const data = await MeetingRoom.find(query)
      .sort({ [sortField]: sortOrder })
      .skip((pageNo - 1) * parseInt(pageCount))
      .limit(parseInt(pageCount));

    const total = await MeetingRoom.countDocuments(query);

    sendResponse(res, 200, "Success", {
      message: "Meeting room list fetched successfully!",
      data,
      total,
      statusCode: 200,
    });
  } catch (error) {
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

// ✅ Get by ID
meetingRoomController.get("/get/:id", async (req, res) => {
  try {
    const meetingRoom = await MeetingRoom.findById(req.params.id);
    if (!meetingRoom)
      return sendResponse(res, 404, "Failed", { message: "Meeting room not found" });

    sendResponse(res, 200, "Success", {
      message: "Meeting room fetched successfully!",
      data: meetingRoom,
      statusCode: 200,
    });
  } catch (error) {
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

// ✅ Update Meeting Room
meetingRoomController.put("/update/:id", async (req, res) => {
  try {
    const meetingRoom = await MeetingRoom.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!meetingRoom)
      return sendResponse(res, 404, "Failed", { message: "Meeting room not found" });

    sendResponse(res, 200, "Success", {
      message: "Meeting room updated successfully!",
      data: meetingRoom,
      statusCode: 200,
    });
  } catch (error) {
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

// ✅ Change Status
meetingRoomController.put("/change-status/:id", async (req, res) => {
  try {
    const { status } = req.body;
    const meetingRoom = await MeetingRoom.findById(req.params.id);
    if (!meetingRoom)
      return sendResponse(res, 404, "Failed", { message: "Meeting room not found" });

    meetingRoom.status = status;
    const updated = await meetingRoom.save();

    sendResponse(res, 200, "Success", {
      message: "Meeting room status updated successfully!",
      data: updated,
      statusCode: 200,
    });
  } catch (error) {
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

// ✅ Delete Meeting Room
meetingRoomController.delete("/delete/:id", async (req, res) => {
  try {
    const meetingRoom = await MeetingRoom.findByIdAndDelete(req.params.id);
    if (!meetingRoom)
      return sendResponse(res, 404, "Failed", { message: "Meeting room not found" });

    sendResponse(res, 200, "Success", {
      message: "Meeting room deleted successfully!",
      statusCode: 200,
    });
  } catch (error) {
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

module.exports = meetingRoomController;
