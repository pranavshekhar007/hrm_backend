const jwt = require("jsonwebtoken");
const Admin = require("../model/admin.schema");

const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Authentication token is required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_KEY);

    // Find admin and populate the role
    const admin = await Admin.findById(decoded.id).populate("role");
    if (!admin) {
      return res.status(401).json({ error: "Admin not found or token is invalid" });
    }

    req.token = token;
    req.admin = admin;

    // ✅ Normalize and clean up role name
    const roleName = admin.role?.name
      ? admin.role.name.toLowerCase().trim().replace(/\s+/g, "")
      : "employee";

    // Unified user object for all controllers
    req.user = {
      id: admin._id,
      email: admin.email,
      role: roleName, // e.g. "superadmin", "hr", "employee"
      name: admin.name || admin.fullName,
    };

    next();
  } catch (e) {
    console.error("Auth Error:", e.message);
    res.status(401).json({ error: "Invalid authentication token" });
  }
};

module.exports = auth;
