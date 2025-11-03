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

const Employee = require("../model/employee.schema");
const auth = require("../utils/auth");
const Role = require("../model/role.schema");

const Branch = require("../model/branch.schema");
const AttendanceRecord = require("../model/attendanceRecord.schema");
const Leave = require("../model/leaveApplication.schema");
const Department = require("../model/department.schema");
const Announcement = require("../model/announcement.schema");
const Meeting = require("../model/meeting.schema");
const Warning = require("../model/warning.schema");
const Complaint = require("../model/complaint.schema");
const Award = require("../model/award.schema");
const LeaveType = require("../model/leaveType.schema"); 
// ... (imports remain the same)

adminController.post("/create", async (req, res) => {
  try {
    const { name, email, phone, password, confirmPassword, role } = req.body;

    // 🔹 Validate required fields
    if (!name || !email || !password || !confirmPassword || !phone || !role) {
      return sendResponse(res, 422, "Failed", {
        message: "All fields are required",
      });
    }

    if (password !== confirmPassword) {
      return sendResponse(res, 400, "Failed", {
        message: "Passwords do not match",
      });
    }

    // 🔹 Check existing email in Admin or Employee
    const existingAdmin = await Admin.findOne({ email });
    const existingEmployee = await Employee.findOne({ email });
    if (existingAdmin || existingEmployee) {
      return sendResponse(res, 400, "Failed", {
        message: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // 🔹 Create Admin record first
    const newAdmin = await Admin.create({
      name,
      email,
      phone,
      role,
      password: hashedPassword,
      status: true,
    });

    // 🔹 If the role is Employee — create a linked Employee using SAME _id
    const roleDoc = await Role.findById(role); // make sure Role model is imported
    if (roleDoc && roleDoc.name.toLowerCase() === "employee") {
      const newEmployeeId = `EMP-${Math.floor(Math.random() * 100000) + 1000}`;

      // 👇 use same _id as Admin
      await Employee.create({
        _id: newAdmin._id,
        fullName: name,
        employeeId: newEmployeeId,
        email,
        phoneNumber: phone,
        password: hashedPassword,
        employmentStatus: "Active",
      });
    }

    // 🔹 Generate JWT
    const token = jwt.sign(
      { id: newAdmin._id, email: newAdmin.email, role: newAdmin.role },
      process.env.JWT_KEY
    );

    sendResponse(res, 200, "Success", {
      message: "Admin/Employee registered successfully!",
      data: newAdmin,
      token,
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

// ... (remaining adminController endpoints remain the same)

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

    // Step 1: Find user and populate deeply
    const user = await Admin.findOne({ email })
      .populate({
        path: "role",
        populate: {
          path: "permissions.permissionId",
          model: "Permission",
        },
      })
      .lean();

    if (!user) {
      return sendResponse(res, 422, "Failed", {
        message: "Invalid Credentials",
      });
    }

    // Step 2: Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return sendResponse(res, 422, "Failed", {
        message: "Invalid Credentials",
      });
    }

    // Step 3: Generate token
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role?._id },
      process.env.JWT_KEY
    );

    // Step 4: Update deviceId
    const updatedAdmin = await Admin.findByIdAndUpdate(
      user._id,
      { deviceId },
      { new: true }
    )
      .populate({
        path: "role",
        populate: {
          path: "permissions.permissionId",
          model: "Permission",
        },
      })
      .lean();

    // Step 5: Transform permissions (keep selectedActions from DB)
    const transformedRole = {
      ...updatedAdmin.role,
      permissions: updatedAdmin.role.permissions.map((perm) => ({
        ...perm,
        // ✅ keep real selectedActions if present, fallback to empty []
        selectedActions:
          perm.selectedActions && perm.selectedActions.length
            ? perm.selectedActions
            : perm.actions || [], // if still not present, fallback to actions
        // Optional: remove raw `actions` if not needed
        actions: undefined,
      })),
    };

    // Step 6: Send response
    return sendResponse(res, 200, "Success", {
      message: "User logged in successfully",
      data: {
        ...updatedAdmin,
        role: transformedRole,
      },
      token,
      statusCode: 200,
    });
  } catch (error) {
    console.error(error);
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

adminController.get("/dashboard-details", auth, async (req, res) => {
  try {
    const user = req.user;
    const role = (user.role || "").toLowerCase().trim();

    // 1️⃣ SUPER ADMIN DASHBOARD
    if (role === "superadmin") {
      const [
        totalEmployee,
        totalBranch,
        attendanceRecords,
        pendingLeaves,
        departmentList,
        leaveTypes,
        leaveStats,
        announcements,
        meetings,
      ] = await Promise.all([
        Employee.countDocuments(),
        Branch.countDocuments(),
        AttendanceRecord.find(),
        Leave.countDocuments({ status: "Pending" }),
        Department.find(),
        LeaveType.find({ status: true }), // ✅ Fetch all active leave types
        Leave.aggregate([
          { $group: { _id: "$type", count: { $sum: 1 } } },
        ]), // ✅ Aggregate leave usage stats
        Announcement.find({ status: true }).sort({ createdAt: -1 }).limit(5),
        Meeting.find().sort({ createdAt: -1 }).limit(5),
      ]);

      // 🧮 Attendance Rate Calculation
      const totalAttendance = attendanceRecords.length;
      const presentCount = attendanceRecords.filter(
        (a) => a.status === "Present"
      ).length;
      const attendanceRate = totalAttendance
        ? ((presentCount / totalAttendance) * 100).toFixed(2)
        : 0;

      // 📊 Department Distribution
      const departmentDistribution = await Employee.aggregate([
        { $group: { _id: "$department", count: { $sum: 1 } } },
      ]);
      const populatedDept = await Department.populate(departmentDistribution, {
        path: "_id",
        select: "name",
      });

      // 🔹 Combine LeaveType with usage stats
      const leaveTypeStats = leaveTypes.map((lt) => {
        const stat = leaveStats.find(
          (s) => s._id?.toString() === lt._id?.toString() || s._id === lt.leaveType
        );
        return {
          leaveType: lt.leaveType,
          maxDaysPerYear: lt.maxDaysPerYear,
          color: lt.color,
          isPaid: lt.isPaid,
          usageCount: stat ? stat.count : 0,
        };
      });

      // ✅ Final Response
      return sendResponse(res, 200, "Success", {
        message: "SuperAdmin Dashboard fetched successfully!",
        data: {
          totalEmployee,
          totalBranch,
          attendanceRate,
          pendingLeaves,
          departmentDistribution: populatedDept,
          leaveTypes: leaveTypeStats,
          announcements,
          meetings,
        },
      });
    }

    // 2️⃣ EMPLOYEE DASHBOARD
    if (role === "employee") {
      const employee = await Employee.findOne({ email: user.email })
        .populate("department", "name")
        .populate("designation", "name")
        .populate("branch", "branchName");

      if (!employee) {
        return sendResponse(res, 404, "Failed", { message: "Employee not found" });
      }

      const employeeId = employee._id;

      const [attendance, awards, warnings, complaints, announcements, meetings] =
        await Promise.all([
          AttendanceRecord.find({ employee: employeeId })
            .sort({ date: -1 })
            .limit(5),
          Award.find({ employee: employeeId }).sort({ createdAt: -1 }).limit(3),
          Warning.find({ employee: employeeId }).sort({ createdAt: -1 }).limit(3),
          Complaint.find({ employee: employeeId })
            .sort({ createdAt: -1 })
            .limit(3),
          Announcement.find({
            $or: [
              { companyWideAnnouncement: true },
              { targetBranches: employee.branch },
              { targetDepartments: employee.department },
            ],
          })
            .sort({ createdAt: -1 })
            .limit(5),
          Meeting.find({
            $or: [
              { organizer: employeeId },
              { participants: { $in: [employeeId] } },
            ],
          })
            .sort({ createdAt: -1 })
            .limit(5),
        ]);

      // ✅ Employee Dashboard Response
      return sendResponse(res, 200, "Success", {
        message: "Employee Dashboard fetched successfully!",
        data: {
          employee: {
            name: employee.fullName,
            branch: employee.branch?.branchName,
            department: employee.department?.name,
            designation: employee.designation?.name,
            employmentStatus: employee.employmentStatus,
          },
          attendance,
          awards,
          warnings,
          complaints,
          announcements,
          meetings,
        },
      });
    }

    // 🚫 Unauthorized Role
    return sendResponse(res, 403, "Failed", { message: "Access denied" });
  } catch (error) {
    console.error("Dashboard Error:", error);
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});



module.exports = adminController;
