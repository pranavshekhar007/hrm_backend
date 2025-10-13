const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendResponse } = require("../utils/common");
const auth = require("../utils/auth");
const User = require("../model/user.schema");
const Role = require("../model/role.schema");
require("dotenv").config();

const userController = express.Router();

userController.post("/create", async (req, res) => {
    try {
      const { name, email, phone, password, confirmPassword, role } = req.body;
  
      if (!name || !email || !password || !confirmPassword || !phone || !role) {
        return sendResponse(res, 422, "Failed", { message: "All fields are required" });
      }
  
      if (password !== confirmPassword) {
        return sendResponse(res, 400, "Failed", { message: "Passwords do not match" });
      }
  
      const existingUser = await User.findOne({ email });
      if (existingUser)
        return sendResponse(res, 400, "Failed", { message: "Email already exists" });
  
      const hashedPassword = await bcrypt.hash(password, 10);
  
      const newUser = await User.create({
        name,
        email,
        phone,
        password: hashedPassword,
        role,
      });
  
      sendResponse(res, 200, "Success", {
        message: "User created successfully",
        data: newUser,
      });
    } catch (error) {
      console.error(error);
      sendResponse(res, 500, "Failed", { message: error.message });
    }
  });
  

// ✅ Register (Public)
userController.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password, confirmPassword, role } = req.body;

    if (!name || !email || !password || !confirmPassword || !phone) {
      return sendResponse(res, 422, "Failed", { message: "All fields are required" });
    }

    if (password !== confirmPassword) {
      return sendResponse(res, 400, "Failed", { message: "Passwords do not match" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return sendResponse(res, 400, "Failed", { message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role,
    });

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    sendResponse(res, 200, "Success", {
      message: "User registered successfully",
      data: { ...newUser.toObject(), token },
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

userController.post("/list", async (req, res) => {
    try {
      let {
        searchKey = "",
        role,
        department,
        status,
        pageNo = 1,
        pageCount = 10,
        sortByField = "createdAt",
        sortByOrder = "desc",
      } = req.body;
  
      // ✅ Fallback for invalid or empty sort field
      if (!sortByField || typeof sortByField !== "string" || sortByField.trim() === "") {
        sortByField = "createdAt";
      }
  
      // ✅ Build query dynamically
      const query = {};
      if (role) query.role = role;
      if (department) query.department = department;
  
      // ✅ Only add status if it's explicitly true or false
      if (status === true || status === false) {
        query.status = status;
      } else if (status === "true" || status === "false") {
        query.status = status === "true";
      }
  
      if (searchKey) {
        query.$or = [
          { name: { $regex: searchKey, $options: "i" } },
          { email: { $regex: searchKey, $options: "i" } },
          { phone: { $regex: searchKey, $options: "i" } },
        ];
      }
  
      // ✅ Sorting options
      const sortOption = { [sortByField]: sortByOrder === "asc" ? 1 : -1 };
  
      // ✅ Fetch data with pagination
      const users = await User.find(query)
        .populate("role")
        .sort(sortOption)
        .skip((pageNo - 1) * pageCount)
        .limit(pageCount);
  
      const totalCount = await User.countDocuments(query);
  
      sendResponse(res, 200, "Success", {
        message: "User list fetched successfully",
        data: users,
        totalCount,
        pageNo,
        pageCount,
      });
    } catch (error) {
      console.error(error);
      sendResponse(res, 500, "Failed", { message: error.message || "Internal server error" });
    }
  });
  
  

userController.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return sendResponse(res, 422, "Failed", { message: "Email and password are required" });

    const user = await User.findOne({ email }).populate("role");
    if (!user)
      return sendResponse(res, 404, "Failed", { message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return sendResponse(res, 401, "Failed", { message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    sendResponse(res, 200, "Success", {
      message: "Login successful",
      data: { ...user.toObject(), token },
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

// ✅ Reset Password
userController.post("/reset-password", auth, async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;

    if (!newPassword || !confirmPassword) {
      return sendResponse(res, 422, "Failed", {
        message: "Both new password and confirm password are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return sendResponse(res, 400, "Failed", {
        message: "Passwords do not match",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { password: hashedPassword },
      { new: true }
    );

    if (!updatedUser)
      return sendResponse(res, 404, "Failed", { message: "User not found" });

    sendResponse(res, 200, "Success", {
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, 500, "Failed", { message: error.message });
  }
});

module.exports = userController;
