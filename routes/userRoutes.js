// backend/routes/userRoutes.js
const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const {
  getUserdata,
  getAllUsers,
  deleteUser,
  updateUserProfile,
} = require("../controllers/Users/index");

const {
  getMyAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
 
} = require("../controllers/Users/addressController");

// GET /v1/users/userdata → logged in user
router.get("/userdata", auth, getUserdata);

// ✅ ADDRESSES (base: /v1/users/me/addresses)
router.get("/addresses", auth, getMyAddresses);
router.post("/addresses", auth, addAddress);
router.put("/addresses/:addressId", auth, updateAddress);
router.delete("/addresses/:addressId", auth, deleteAddress);
router.patch("/addresses/:addressId/default", auth, setDefaultAddress);
router.put("/userdata", auth, updateUserProfile);

// GET /v1/users → all users (admin-only ideally)
router.get("/", auth, getAllUsers);

// DELETE /v1/users/:id → delete one user
router.delete("/:id", auth, deleteUser);

module.exports = router;
