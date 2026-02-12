// routes/wishlistRoutes.js
const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  syncWishlist,
  clearWishlist,
} = require("../controllers/wishlist/wishlistController");

// GET /v1/wishlist → get user's wishlist
router.get("/", auth, getWishlist);

// POST /v1/wishlist → add product to wishlist
router.post("/", auth, addToWishlist);

// DELETE /v1/wishlist/:productId → remove product from wishlist
router.delete("/:productId", auth, removeFromWishlist);

// POST /v1/wishlist/sync → sync guest wishlist with DB on login
router.post("/sync", auth, syncWishlist);

// DELETE /v1/wishlist → clear entire wishlist
router.delete("/", auth, clearWishlist);

module.exports = router;