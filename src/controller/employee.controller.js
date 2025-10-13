const express = require("express");
const { sendResponse } = require("../utils/common");
const bcrypt = require("bcryptjs");
require("dotenv").config();
const Employee = require("../model/employee.schema");
const employeeController = express.Router(); 
const cloudinary = require("../utils/cloudinary");
const upload = require("../utils/multer");
const auth = require("../utils/auth");

employeeController.post("/create", upload.fields([
  { name: "profileImage", maxCount: 1 },
  { name: "documents", maxCount: 10 } 
]), async (req, res) => {
  try {
    const body = req.body;

    if (req.files?.profileImage) {
      const uploaded = await cloudinary.uploader.upload(req.files.profileImage[0].path);
      body.profileImage = uploaded.url;
    }

    let documents = [];
    if (req.files?.documents && body.documentType && body.expiryDate) {
      const documentTypeArray = Array.isArray(body.documentType)
        ? body.documentType
        : [body.documentType];

      const expiryDateArray = Array.isArray(body.expiryDate)
        ? body.expiryDate
        : [body.expiryDate];

      for (let i = 0; i < req.files.documents.length; i++) {
        const fileUploaded = await cloudinary.uploader.upload(req.files.documents[i].path);
        documents.push({
          documentType: documentTypeArray[i],
          fileUrl: fileUploaded.url,
          expiryDate: expiryDateArray[i],
        });
      }
    }

    if (body.password) {
      const salt = await bcrypt.genSalt(10);
      body.password = await bcrypt.hash(body.password, salt);
    }

    const employeeCreated = await Employee.create({ ...body, documents });

    sendResponse(res, 200, "Success", {
      message: "Employee created successfully!",
      data: employeeCreated,
      statusCode: 200,
    });
  } catch (error) {
    console.error("Employee create error:", error);
    sendResponse(res, 500, "Failed", {
      message: error.message || "Internal server error",
    });
  }
});

employeeController.post("/list", async (req, res) => {
  try {
    const {
      searchKey = "",
      branch,
      department,
      designation,
      employmentStatus,
      pageNo = 1,
      pageCount = 10,
      sortByField,
      sortByOrder,
    } = req.body;

    const query = {};
    if (branch) query.branch = branch;
    if (department) query.department = department;
    if (designation) query.designation = designation;
    if (employmentStatus) query.employmentStatus = employmentStatus;
    if (searchKey) query.fullName = { $regex: searchKey, $options: "i" };

    const sortField = sortByField || "createdAt";
    const sortOrder = sortByOrder === "asc" ? 1 : -1;
    const sortOption = { [sortField]: sortOrder };

    const employeeList = await Employee.find(query)
      .populate("branch department designation documents.documentType")
      .sort(sortOption)
      .limit(parseInt(pageCount))
      .skip((pageNo - 1) * parseInt(pageCount));

    const totalCount = await Employee.countDocuments(query);

    sendResponse(res, 200, "Success", {
      message: "Employee list retrieved successfully!",
      data: employeeList,
      total: totalCount,
      statusCode: 200,
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, 500, "Failed", { message: error.message || "Internal server error" });
  }
});

employeeController.put("/update", upload.single("profileImage"), async (req, res) => {
  try {
    const id = req.body._id;
    const employeeData = await Employee.findById(id);
    if (!employeeData) return sendResponse(res, 404, "Failed", { message: "Employee not found" });

    if (req.file) {
      const uploaded = await cloudinary.uploader.upload(req.file.path);
      req.body.profileImage = uploaded.url;
    }

    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      req.body.password = await bcrypt.hash(req.body.password, salt);
    }

    const updatedEmployee = await Employee.findByIdAndUpdate(id, req.body, { new: true });

    sendResponse(res, 200, "Success", {
      message: "Employee updated successfully!",
      data: updatedEmployee,
      statusCode: 200,
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, 500, "Failed", { message: error.message || "Internal server error" });
  }
});

employeeController.put("/reset-password", async (req, res) => {
  try {
    const { employeeId, newPassword } = req.body;
    const employee = await Employee.findOne({ employeeId });

    if (!employee) {
      return sendResponse(res, 404, "Failed", { message: "Employee not found" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    employee.password = hashedPassword;

    await employee.save();

    sendResponse(res, 200, "Success", {
      message: "Password reset successfully!",
      statusCode: 200,
    });
  } catch (error) {
    sendResponse(res, 500, "Failed", { message: error.message || "Internal server error" });
  }
});

employeeController.delete("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const employeeItem = await Employee.findById(id);
    if (!employeeItem) return sendResponse(res, 404, "Failed", { message: "Employee not found" });

    await Employee.findByIdAndDelete(id);

    sendResponse(res, 200, "Success", { message: "Employee deleted successfully!", statusCode: 200 });
  } catch (error) {
    sendResponse(res, 500, "Failed", { message: error.message || "Internal server error" });
  }
});

module.exports = employeeController;
