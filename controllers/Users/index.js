// controllers/users/index.js
const Users = require("../../models/User");

exports.getUserdata = async (req, res) => {
  try {
    const user = await Users.findById(req.userId).select("-password -__v");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      success: true,
      message: "User data fetched successfully",
      user,
    });
  } catch (err) {
    console.error("Get user data error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await Users.find().select("-password -__v");

    return res.json({
      success: true,
      message: "All users fetched successfully",
      users,
    });
  } catch (err) {
    console.error("Get all users error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ Delete user by ID
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await Users.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (err) {
    console.error("Delete user error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ✅ Update logged-in user profile
exports.updateUserProfile = async (req, res) => {
  try {
    const { name, phone, address } = req.body;

    const updatedUser = await Users.findByIdAndUpdate(
      req.userId,
      {
        name,
        phone,
        address,
      },
      { new: true }
    ).select("-password -__v");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error("Update profile error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
