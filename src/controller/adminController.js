const jwt = require("jsonwebtoken");
const express = require("express");
const { sendResponse } = require("../utils/common");
require("dotenv").config();
const Admin = require("../model/admin.schema");
const bcrypt = require("bcrypt");
const adminController = express.Router();
require("dotenv").config();
const cloudinary = require("../utils/cloudinary");
const upload = require("../utils/multer");
const moment = require("moment");
const Attendance = require("../model/attendance.schema");
const Leave = require("../model/leaves.schema");
const Candidate = require("../model/candidate.schema");
const Department = require("../model/department.schema");
const Announcement = require("../model/announcement.schema");
// const Meeting = require("../model/meeting.schema");
const Employee = require("../model/employee.schema");
const Branch = require("../model/branch.schema");
const auth = require("../utils/auth");
// const Hiring = require("../model/hiring.schema");

adminController.post("/create", async (req, res) => {
  try {
    const { name, email, phone, password, confirmPassword, role } = req.body;

    // 🔹 Validate required fields
    if (!name || !email || !password || !confirmPassword || !phone || !role) {
      return sendResponse(res, 422, "Failed", {
        message: "All fields are required",
      });
    }

    // 🔹 Check password match
    if (password !== confirmPassword) {
      return sendResponse(res, 400, "Failed", {
        message: "Passwords do not match",
      });
    }

    // 🔹 Check existing email
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return sendResponse(res, 400, "Failed", {
        message: "Email already exists",
      });
    }

    // 🔹 Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 🔹 Create new admin
    const newAdmin = await Admin.create({
      name,
      email,
      phone,
      role,
      password: hashedPassword,
    });

    // 🔹 Generate JWT token
    const token = jwt.sign(
      { id: newAdmin._id, email: newAdmin.email, role: newAdmin.role },
      process.env.JWT_KEY
    );

    // 🔹 Success response
    sendResponse(res, 200, "Success", {
      message: "Admin registered successfully!",
      data: newAdmin,
      token,
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

adminController.put("/update/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role, status } = req.body;

    // 🔹 Check if at least one field is provided
    if (!name && !email && !phone && !role && status === undefined) {
      return sendResponse(res, 422, "Failed", {
        message: "At least one field is required to update",
      });
    }

    // 🔹 Build update object dynamically
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (role) updateData.role = role;
    if (status !== undefined) updateData.status = status;

    // 🔹 Update admin
    const updatedAdmin = await Admin.findByIdAndUpdate(id, updateData, {
      new: true,
    }).populate("role");

    if (!updatedAdmin) {
      return sendResponse(res, 404, "Failed", { message: "Admin not found" });
    }

    // 🔹 Success response
    sendResponse(res, 200, "Success", {
      message: "Admin updated successfully!",
      data: updatedAdmin,
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
    const { email, password, deviceId } = req.body;

    const user = await Admin.findOne({ email }).populate({ path: "role" });
    if (!user) {
      return sendResponse(res, 422, "Failed", {
        message: "Invalid Credentials",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return sendResponse(res, 422, "Failed", {
        message: "Invalid Credentials",
      });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_KEY
    );

    const updatedAdmin = await Admin.findByIdAndUpdate(
      user._id,
      { deviceId },
      { new: true }
    ).populate({ path: "role" });

    return sendResponse(res, 200, "Success", {
      message: "User logged in successfully",
      data: updatedAdmin,
      token,
      statusCode: 200,
    });
  } catch (error) {
    return sendResponse(res, 500, "Failed", {
      message: error.message || "Internal server error",
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

    // 🔹 Validation
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

    // 🔹 Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 🔹 Update password
    const updatedAdmin = await Admin.findByIdAndUpdate(
      adminId,
      { password: hashedPassword },
      { new: true }
    );

    if (!updatedAdmin) {
      return sendResponse(res, 404, "Failed", {
        message: "Admin not found",
        statusCode: 404,
      });
    }

    // 🔹 Success response
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


adminController.get("/dashboard-details", async (req, res) => {
  try {
    // 1️⃣ Parallel counts
    const [
      totalEmployee,
      totalBranch,
      attendanceRecords,
      pendingLeaves,
      totalCandidate,
      departmentList,
    ] = await Promise.all([
      Employee.countDocuments(),
      Branch.countDocuments(),
      Attendance.find(),
      Leave.countDocuments({ status: "pending" }),
      Candidate.countDocuments(),
      Department.find(),
    ]);

    // 2️⃣ Attendance rate
    const totalAttendance = attendanceRecords.length;
    const presentCount = attendanceRecords.filter(
      (a) => a.status === "present"
    ).length;
    const attendanceRate = totalAttendance
      ? ((presentCount / totalAttendance) * 100).toFixed(2)
      : 0;

    // 3️⃣ Department distribution for chart
    const departmentDistribution = await Employee.aggregate([
      { $group: { _id: "$department", count: { $sum: 1 } } },
    ]);

    // 4️⃣ Last 6 months Hiring Trend
    const sixMonthsAgo = moment()
      .subtract(6, "months")
      .startOf("month")
      .toDate();
    const last6MonthsHiring = await Hiring.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          hires: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // 5️⃣ Candidate status
    const candidateStatus = await Candidate.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // 6️⃣ Leave types
    const leaveTypes = await Leave.aggregate([
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);

    // 7️⃣ Recent records
    const [
      recentLeaves,
      recentCandidates,
      recentAnnouncements,
      recentMeetings,
    ] = await Promise.all([
      Leave.find().sort({ createdAt: -1 }).limit(5),
      Candidate.find().sort({ createdAt: -1 }).limit(5),
      Announcement.find().sort({ createdAt: -1 }).limit(5),
      Meeting.find().sort({ createdAt: -1 }).limit(5),
    ]);

    // 8️⃣ Employee growth for 2025 (monthly)
    const employeeGrowth = await Employee.aggregate([
      {
        $match: {
          createdAt: {
            $gte: moment("2025-01-01").startOf("year").toDate(),
            $lte: moment("2025-12-31").endOf("year").toDate(),
          },
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // 9️⃣ Send final response
    sendResponse(res, 200, "Success", {
      message: "Dashboard details retrieved successfully",
      data: {
        employees: { totalEmployee, attendanceRate },
        branches: { totalBranch },
        pendingLeaves,
        totalCandidate,
        departmentDistribution,
        last6MonthsHiring,
        candidateStatus,
        leaveTypes,
        recentLeaves,
        recentCandidates,
        recentAnnouncements,
        recentMeetings,
        employeeGrowth2025: employeeGrowth,
      },
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
