const express = require("express");
const { sendResponse } = require("../utils/common");
const Announcement = require("../model/announcement.schema");
require("dotenv").config();

const announcementController = express.Router();

// ✅ Create Announcement
announcementController.post("/create", async (req, res) => {
  try {
    const createdAnnouncement = await Announcement.create(req.body);
    sendResponse(res, 200, "Success", {
      message: "Announcement created successfully!",
      data: createdAnnouncement,
      statusCode: 200,
    });
  } catch (error) {
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

// ✅ List Announcements (with filters & pagination)
announcementController.post("/list", async (req, res) => {
  try {
    const {
      searchKey = "",
      category,
      status,
      pageNo = 1,
      pageCount = 10,
      sortByField,
      sortByOrder,
    } = req.body;

    const query = {};
    if (status !== undefined) query.status = status;
    if (category) query.category = category;

    if (searchKey) {
      query.$or = [
        { title: { $regex: searchKey, $options: "i" } },
        { shortDescription: { $regex: searchKey, $options: "i" } },
        { content: { $regex: searchKey, $options: "i" } },
      ];
    }

    const sortField = sortByField || "createdAt";
    const sortOrder = sortByOrder === "asc" ? 1 : -1;

    const announcements = await Announcement.find(query)
      .populate("targetBranches", "branchName")
      .populate("targetDepartments", "name")
      .sort({ [sortField]: sortOrder })
      .skip((pageNo - 1) * parseInt(pageCount))
      .limit(parseInt(pageCount));

    const totalCount = await Announcement.countDocuments(query);

    sendResponse(res, 200, "Success", {
      message: "Announcement list retrieved successfully!",
      data: announcements,
      total: totalCount,
      statusCode: 200,
    });
  } catch (error) {
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

// ✅ Update Announcement
announcementController.put("/update/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findById(id);
    if (!announcement)
      return sendResponse(res, 404, "Failed", { message: "Announcement not found" });

    const updatedAnnouncement = await Announcement.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    sendResponse(res, 200, "Success", {
      message: "Announcement updated successfully!",
      data: updatedAnnouncement,
      statusCode: 200,
    });
  } catch (error) {
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

// ✅ Delete Announcement
announcementController.delete("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findById(id);
    if (!announcement)
      return sendResponse(res, 404, "Failed", { message: "Announcement not found" });

    await Announcement.findByIdAndDelete(id);

    sendResponse(res, 200, "Success", {
      message: "Announcement deleted successfully!",
      statusCode: 200,
    });
  } catch (error) {
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

// ✅ Change Announcement Status (Activate/Deactivate)
announcementController.put("/change-status/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const announcement = await Announcement.findById(id);
    if (!announcement)
      return sendResponse(res, 404, "Failed", { message: "Announcement not found" });

    announcement.status = status;
    const updatedAnnouncement = await announcement.save();

    sendResponse(res, 200, "Success", {
      message: "Announcement status updated successfully!",
      data: updatedAnnouncement,
      statusCode: 200,
    });
  } catch (error) {
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

module.exports = announcementController;
