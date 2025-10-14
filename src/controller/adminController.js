const express = require("express");
const { sendResponse } = require("../utils/common");
require("dotenv").config();
const Admin = require("../model/admin.schema");
const adminController = express.Router();
require("dotenv").config();
const cloudinary = require("../utils/cloudinary");
const upload = require("../utils/multer");

adminController.post("/create", async (req, res) => {
  try {
    const AdminData = await Admin.create(req.body);
    sendResponse(res, 200, "Success", {
      message: "Admin created successfully!",
      data: AdminData,
      statusCode: 200,
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, 500, "Failed", {
      message: error.message || "Internal server error",
      statusCode: 500,
    });
  }
});

adminController.put("/update", async (req, res) => {
  try {
    const AdminData = await Admin.findByIdAndUpdate(req?.body?._id, req.body, {
      new: true,
    });
    sendResponse(res, 200, "Success", {
      message: "Admin updated successfully!",
      data: AdminData,
      statusCode: 200,
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, 500, "Failed", {
      message: error.message || "Internal server error",
      statusCode: 500,
    });
  }
});

adminController.delete("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await Admin.findById(id);
    if (!admin) {
      return sendResponse(res, 404, "Failed", {
        message: "Admin not found",
      });
    }

    await Admin.findByIdAndDelete(id);
    sendResponse(res, 200, "Success", {
      message: "Admin deleted successfully!",
      statusCode: 200,
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, 500, "Failed", {
      message: error.message || "Internal server error",
    });
  }
});

adminController.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await Admin.findOne({ email, password }).populate({
      path: "role",
    });
    if (user) {
      let updatedAdmin = await Admin.findByIdAndUpdate(user?._id, {deviceId:req?.body?.deviceId}, {
      new: true,
    }).populate({
      path: "role",
    });
      return sendResponse(res, 200, "Success", {
        message: "User logged in successfully",
        data: updatedAdmin,
        statusCode: 200,
      });
    } else {
      return sendResponse(res, 422, "Failed", {
        message: "Invalid Credentials",
        statusCode: 422,
      });
    }
  } catch (error) {
    return sendResponse(res, 500, "Failed", {
      message: error.message || "Internal server error.",
      statusCode: 500,
    });
  }
});

adminController.post("/list", async (req, res) => {
  try {
    const {
      searchKey = "",
      status,
      pageNo = 1,
      pageCount = 10,
      sortByField,
      sortByOrder,
    } = req.body;

    const query = {};
    if (status) query.profileStatus = status;
    if (searchKey) {
      query.$or = [
        { firstName: { $regex: searchKey, $options: "i" } },
        { lastName: { $regex: searchKey, $options: "i" } },
        { email: { $regex: searchKey, $options: "i" } },
      ];
    }

    // Construct sorting object
    const sortField = sortByField || "createdAt";
    const sortOrder = sortByOrder === "asc" ? 1 : -1;
    const sortOption = { [sortField]: sortOrder };

    // Fetch the category list
    const adminList = await Admin.find(query)
      .sort(sortOption)
      .limit(parseInt(pageCount))
      .skip(parseInt(pageNo - 1) * parseInt(pageCount))
      .populate({
        path: "role",
      });
    const totalCount = await Admin.countDocuments({});
    sendResponse(res, 200, "Success", {
      message: "Admin list retrieved successfully!",
      data: adminList,
      documentCount: {
        totalCount,
      },
      statusCode: 200,
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, 500, "Failed", {
      message: error.message || "Internal server error",
    });
  }
});

adminController.post("/reset-password", async (req, res) => {
    try {
      const { adminId, newPassword, confirmPassword } = req.body;
  
      // Validation
      if (!adminId || !newPassword || !confirmPassword) {
        return sendResponse(res, 422, "Failed", {
          message: "adminId, newPassword and confirmPassword are required",
          statusCode: 422,
        });
      }
  
      if (newPassword !== confirmPassword) {
        return sendResponse(res, 422, "Failed", {
          message: "Passwords do not match",
          statusCode: 422,
        });
      }
  
      // Update password
      const updatedAdmin = await Admin.findByIdAndUpdate(
        adminId,
        { password: newPassword },
        { new: true }
      );
  
      if (!updatedAdmin) {
        return sendResponse(res, 404, "Failed", {
          message: "Admin not found",
          statusCode: 404,
        });
      }
  
      sendResponse(res, 200, "Success", {
        message: "Password updated successfully",
        data: { _id: updatedAdmin._id, email: updatedAdmin.email },
        statusCode: 200,
      });
    } catch (error) {
      console.error(error);
      sendResponse(res, 500, "Failed", {
        message: error.message || "Internal server error",
        statusCode: 500,
      });
    }
  });
  

module.exports = adminController;
