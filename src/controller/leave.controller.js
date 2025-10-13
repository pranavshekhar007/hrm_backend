const express = require("express");
const { sendResponse } = require("../utils/common");
require("dotenv").config();
const Leave = require("../model/leaves.schema");
const leaveController = express.Router();
const auth = require("../utils/auth");

leaveController.post("/create", async (req, res) => {
  try {
    const leaveCreated = await Leave.create(req.body);

    sendResponse(res, 200, "Success", {
      message: "Leave request created successfully!",
      data: leaveCreated,
      statusCode: 200,
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, 500, "Failed", {
      message: error.message || "Internal server error",
    });
  }
});

leaveController.post("/list", async (req, res) => {
  try {
    const {
      userId,
      status,
      type,
      pageNo = 1,
      pageCount = 10,
      sortByField,
      sortByOrder,
    } = req.body;

    const query = {};
    if (userId) query.userId = userId;
    if (status) query.status = status;
    if (type) query.type = type;

    const sortField = sortByField || "createdAt";
    const sortOrder = sortByOrder === "asc" ? 1 : -1;
    const sortOption = { [sortField]: sortOrder };

    const leaveList = await Leave.find(query)
      .populate("userId approvedBy")
      .sort(sortOption)
      .limit(parseInt(pageCount))
      .skip((pageNo - 1) * parseInt(pageCount));

    const totalCount = await Leave.countDocuments(query);

    sendResponse(res, 200, "Success", {
      message: "Leave list retrieved successfully!",
      data: leaveList,
      total: totalCount,
      statusCode: 200,
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, 500, "Failed", {
      message: error.message || "Internal server error",
    });
  }
});

leaveController.put("/update", async (req, res) => {
  try {
    const id = req.body._id;
    const leaveData = await Leave.findById(id);
    if (!leaveData) return sendResponse(res, 404, "Failed", { message: "Leave request not found" });

    const updatedLeave = await Leave.findByIdAndUpdate(id, req.body, { new: true });

    sendResponse(res, 200, "Success", {
      message: "Leave request updated successfully!",
      data: updatedLeave,
      statusCode: 200,
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, 500, "Failed", { message: error.message || "Internal server error" });
  }
});

leaveController.delete("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const leaveItem = await Leave.findById(id);
    if (!leaveItem) return sendResponse(res, 404, "Failed", { message: "Leave request not found" });

    await Leave.findByIdAndDelete(id);

    sendResponse(res, 200, "Success", {
      message: "Leave request deleted successfully!",
      statusCode: 200,
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, 500, "Failed", { message: error.message || "Internal server error" });
  }
});

module.exports = leaveController;
