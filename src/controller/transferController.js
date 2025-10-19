const express = require("express");
const { sendResponse } = require("../utils/common");
const Transfer = require("../model/transfer.schema");
const Employee = require("../model/employee.schema");
const Branch = require("../model/branch.schema");
const Department = require("../model/department.schema");
const Designation = require("../model/designation.schema");
const cloudinary = require("../utils/cloudinary");
const upload = require("../utils/multer"); 

const transferController = express.Router();

// ✅ Create Transfer Request
transferController.post("/create", upload.array("documents"), async (req, res) => {
  try {
    const { employee, branch, toDepartment, toDesignation, transferDate, effectiveDate, reason } = req.body;

    const employeeExists = await Employee.findById(employee);
    const branchExists = await Branch.findById(branch);
    const departmentExists = await Department.findById(toDepartment);
    const designationExists = await Designation.findById(toDesignation);

    if (!employeeExists) return sendResponse(res, 400, "Failed", { message: "Invalid employee ID" });
    if (!branchExists) return sendResponse(res, 400, "Failed", { message: "Invalid branch ID" });
    if (!departmentExists) return sendResponse(res, 400, "Failed", { message: "Invalid department ID" });
    if (!designationExists) return sendResponse(res, 400, "Failed", { message: "Invalid designation ID" });

    // Upload documents to Cloudinary
    let documents = [];
    if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        const result = await cloudinary.uploader.upload(file.path, { folder: "transfer_documents" });
        documents.push({ fileUrl: result.secure_url, fileName: file.originalname });
      }
    }

    const newTransfer = await Transfer.create({
      employee,
      branch,
      toDepartment,
      toDesignation,
      transferDate,
      effectiveDate,
      reason,
      documents
    });

    sendResponse(res, 200, "Success", {
      message: "Transfer request created successfully",
      data: newTransfer,
      statusCode: 200,
    });
  } catch (error) {
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});


// ✅ List Transfers with pagination, filter, and search
transferController.post("/list", async (req, res) => {
  try {
    const { searchKey = "", pageNo = 1, pageCount = 10, status } = req.body;

    const query = {};
    if (status) query.status = status;
    if (searchKey) {
      query.$or = [
        { reason: { $regex: searchKey, $options: "i" } },
      ];
    }

    const transfers = await Transfer.find(query)
      .populate("employee", "fullName email")
      .populate("branch", "branchName")
      .populate("toDepartment", "name")
      .populate("toDesignation", "name")
      .limit(parseInt(pageCount))
      .skip((pageNo - 1) * parseInt(pageCount))
      .sort({ createdAt: -1 });

    const total = await Transfer.countDocuments(query);

    sendResponse(res, 200, "Success", {
      message: "Transfer list fetched successfully",
      data: transfers,
      total,
      statusCode: 200,
    });
  } catch (error) {
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

// ✅ Update Transfer Details
transferController.put("/update/:id", upload.array("documents"), async (req, res) => {
  try {
    const { id } = req.params;
    const transfer = await Transfer.findById(id);
    if (!transfer) return sendResponse(res, 404, "Failed", { message: "Transfer not found" });

    // Upload new documents if provided
    if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        const result = await cloudinary.uploader.upload(file.path, { folder: "transfer_documents" });
        transfer.documents.push({ fileUrl: result.secure_url, fileName: file.originalname });
      }
    }

    // Update other fields
    const { employee, branch, toDepartment, toDesignation, transferDate, effectiveDate, reason, status } = req.body;
    if (employee) transfer.employee = employee;
    if (branch) transfer.branch = branch;
    if (toDepartment) transfer.toDepartment = toDepartment;
    if (toDesignation) transfer.toDesignation = toDesignation;
    if (transferDate) transfer.transferDate = transferDate;
    if (effectiveDate) transfer.effectiveDate = effectiveDate;
    if (reason) transfer.reason = reason;
    if (status) transfer.status = status;

    const updatedTransfer = await transfer.save();

    sendResponse(res, 200, "Success", {
      message: "Transfer details updated successfully",
      data: updatedTransfer,
      statusCode: 200,
    });
  } catch (error) {
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

// ✅ Change Transfer Status (Pending → Approved/Rejected)
transferController.put("/change-status/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const transfer = await Transfer.findById(id);
    if (!transfer)
      return sendResponse(res, 404, "Failed", { message: "Transfer not found" });

    if (!["Pending", "Approved", "Rejected"].includes(status))
      return sendResponse(res, 400, "Failed", { message: "Invalid status" });

    transfer.status = status;
    const updatedTransfer = await transfer.save();

    sendResponse(res, 200, "Success", {
      message: "Transfer status updated successfully",
      data: updatedTransfer,
      statusCode: 200,
    });
  } catch (error) {
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

// ✅ Delete Transfer
transferController.delete("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const transfer = await Transfer.findById(id);
    if (!transfer)
      return sendResponse(res, 404, "Failed", { message: "Transfer not found" });

    await Transfer.findByIdAndDelete(id);

    sendResponse(res, 200, "Success", {
      message: "Transfer deleted successfully",
      statusCode: 200,
    });
  } catch (error) {
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

module.exports = transferController;
