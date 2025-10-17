const express = require("express");
const { sendResponse } = require("../utils/common");
const bcrypt = require("bcryptjs");
require("dotenv").config();
const Employee = require("../model/employee.schema");
const employeeController = express.Router();
const cloudinary = require("../utils/cloudinary");
const upload = require("../utils/multer");
const auth = require("../utils/auth");

employeeController.post(
  "/create",
  upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "documents", maxCount: 10 },
  ]),
  async (req, res) => {
    try {
      const body = req.body;

      if (req.files?.profileImage) {
        const uploaded = await cloudinary.uploader.upload(
          req.files.profileImage[0].path
        );
        body.profileImage = uploaded.url;
      }

      let documents = [];
      if (req.files?.documents?.length > 0 && req.body.documentsData) {
        const documentsData = JSON.parse(req.body.documentsData); // array of metadata

        for (let i = 0; i < req.files.documents.length; i++) {
          const fileUploaded = await cloudinary.uploader.upload(
            req.files.documents[i].path
          );
          documents.push({
            documentType: documentsData[i].documentType,
            fileUrl: fileUploaded.url,
            expiryDate: documentsData[i].expiryDate,
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
  }
);

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
    sendResponse(res, 500, "Failed", {
      message: error.message || "Internal server error",
    });
  }
});

employeeController.put(
  "/update",
  upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "documents", maxCount: 10 },
  ]),
  async (req, res) => {
    try {
      const id = req.body._id;
      const employeeData = await Employee.findById(id);
      if (!employeeData)
        return sendResponse(res, 404, "Failed", {
          message: "Employee not found",
        });

      // --------------------------
      // Handle profile image update
      // --------------------------
      if (req.files?.profileImage) {
        const uploaded = await cloudinary.uploader.upload(
          req.files.profileImage[0].path
        );
        req.body.profileImage = uploaded.url;
      }

      // --------------------------
      // Handle documents merge/update
      // --------------------------
      if (req.files?.documents?.length > 0) {
        const currentDocs = employeeData.documents || []; // existing documents
        const updatedDocs = [...currentDocs];

        const documentTypeArray = Array.isArray(req.body.documentType)
          ? req.body.documentType
          : [req.body.documentType];
        const expiryDateArray = Array.isArray(req.body.expiryDate)
          ? req.body.expiryDate
          : [req.body.expiryDate];

        for (let i = 0; i < req.files.documents.length; i++) {
          const file = req.files.documents[i];
          const uploaded = await cloudinary.uploader.upload(file.path);

          const docData = {
            fileUrl: uploaded.url,
            documentType: documentTypeArray[i],
            expiryDate: expiryDateArray[i],
          };

          const existingIndex = updatedDocs.findIndex(
            (doc) => doc.documentType.toString() === documentTypeArray[i]
          );

          if (existingIndex !== -1) {
            // Update existing document
            updatedDocs[existingIndex] = {
              ...updatedDocs[existingIndex],
              ...docData,
            };
          } else {
            // Add new document
            updatedDocs.push(docData);
          }
        }

        req.body.documents = updatedDocs;
      }

      // --------------------------
      // Handle password hash
      // --------------------------
      if (req.body.password) {
        const salt = await bcrypt.genSalt(10);
        req.body.password = await bcrypt.hash(req.body.password, salt);
      }

      // --------------------------
      // Update employee
      // --------------------------
      const updatedEmployee = await Employee.findByIdAndUpdate(id, req.body, {
        new: true,
      });
      sendResponse(res, 200, "Success", {
        message: "Employee updated successfully!",
        data: updatedEmployee,
        statusCode: 200,
      });
    } catch (error) {
      console.error("Employee update error:", error);
      sendResponse(res, 500, "Failed", {
        message: error.message || "Internal server error",
      });
    }
  }
);

employeeController.put("/reset-password", async (req, res) => {
  try {
    const { employeeId, newPassword, confirmPassword } = req.body;

    if (!employeeId || !newPassword || !confirmPassword) {
      return sendResponse(res, 422, "Failed", {
        message: "employeeId, newPassword and confirmPassword are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return sendResponse(res, 422, "Failed", {
        message: "Passwords do not match",
      });
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return sendResponse(res, 404, "Failed", { message: "Employee not found" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    employee.password = hashedPassword;
    await employee.save();

    sendResponse(res, 200, "Success", {
      message: "Password updated successfully",
      data: {
        _id: employee._id,
        fullName: employee.fullName,
        email: employee.email,
      },
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});



employeeController.delete("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const employeeItem = await Employee.findById(id);
    if (!employeeItem)
      return sendResponse(res, 404, "Failed", {
        message: "Employee not found",
      });

    await Employee.findByIdAndDelete(id);

    sendResponse(res, 200, "Success", {
      message: "Employee deleted successfully!",
      statusCode: 200,
    });
  } catch (error) {
    sendResponse(res, 500, "Failed", {
      message: error.message || "Internal server error",
    });
  }
});

// DELETE a specific document of an employee by documentType
employeeController.delete(
  "/delete-document/:employeeId/:documentTypeId",
  async (req, res) => {
    try {
      const { employeeId, documentTypeId } = req.params;

      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return sendResponse(res, 404, "Failed", {
          message: "Employee not found",
        });
      }

      // Filter out the document with the matching documentType
      const filteredDocs = employee.documents.filter(
        (doc) => doc.documentType.toString() !== documentTypeId
      );

      // Update employee documents
      employee.documents = filteredDocs;
      await employee.save();

      sendResponse(res, 200, "Success", {
        message: "Document deleted successfully!",
        data: employee.documents,
        statusCode: 200,
      });
    } catch (error) {
      console.error("Delete document error:", error);
      sendResponse(res, 500, "Failed", {
        message: error.message || "Internal server error",
      });
    }
  }
);

employeeController.get("/details/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Find employee by ID and populate relations
    const employee = await Employee.findById(id)
      .populate("branch department designation documents.documentType");

    if (!employee) {
      return sendResponse(res, 404, "Failed", {
        message: "Employee not found",
      });
    }

    sendResponse(res, 200, "Success", {
      message: "Employee details fetched successfully!",
      data: employee,
      statusCode: 200,
    });
  } catch (error) {
    console.error("Employee details error:", error);
    sendResponse(res, 500, "Failed", {
      message: error.message || "Internal server error",
    });
  }
});


module.exports = employeeController;
