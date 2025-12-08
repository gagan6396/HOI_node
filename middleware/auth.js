// middleware/auth.js
const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    // Try Authorization header first
    let token = null;
    const authHeader = req.headers["authorization"];

    if (authHeader && typeof authHeader === "string") {
      // Expected format: "Bearer <token>"
      const parts = authHeader.split(" ");
      if (parts.length === 2 && parts[0] === "Bearer") {
        token = parts[1];
      } else {
        // if Authorization header is present but invalid format
        return res.status(401).json({ message: "Invalid token format" });
      }
    }

    // Optional: also support x-auth-token (raw token without Bearer)
    if (!token && req.headers["x-auth-token"]) {
      token = req.headers["x-auth-token"];
    }

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_KEY);

    req.userId = decoded.userId;
    req.userRole = decoded.role || "user";

    req.user = {
      id: decoded.userId,
      role: decoded.role || "user",
    };

    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
