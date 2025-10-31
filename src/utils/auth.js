const jwt = require("jsonwebtoken");
const Admin = require("../model/admin.schema");

const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Authentication token is required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_KEY);

    const admin = await Admin.findOne({ _id: decoded.id }).populate("role");
    if (!admin) {
      return res.status(401).json({ error: "Admin not found or token is invalid" });
    }

    req.token = token;
    req.admin = admin;

    // ✅ Add this unified user object for easier access in all controllers
    req.user = {
      id: admin._id,
      email: admin.email,
      role: admin.role?.name?.toLowerCase() || "employee",
      name: admin.name || admin.fullName,
    };

    next();
  } catch (e) {
    console.error("Auth Error:", e.message);
    res.status(401).json({ error: "Invalid authentication token" });
  }
};

module.exports = auth;
