// controllers/wishlist/wishlistController.js
const Wishlist = require("../../models/Wishlist");

exports.getWishlist = async (req, res) => {
  try {
    const userId = req.userId;

    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      // Create empty wishlist if doesn't exist
      wishlist = await Wishlist.create({ userId, products: [] });
    }

    return res.json({
      success: true,
      message: "Wishlist fetched successfully",
      wishlist: wishlist.products.map((p) => p.toString()),
    });
  } catch (err) {
    console.error("Get wishlist error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.addToWishlist = async (req, res) => {
  try {
    const userId = req.userId;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = await Wishlist.create({ userId, products: [productId] });
    } else {
      if (wishlist.products.includes(productId)) {
        return res.json({
          success: true,
          message: "Product already in wishlist",
          wishlist: wishlist.products.map((p) => p.toString()),
        });
      }

      wishlist.products.push(productId);
      await wishlist.save();
    }

    return res.json({
      success: true,
      message: "Product added to wishlist",
      wishlist: wishlist.products.map((p) => p.toString()),
    });
  } catch (err) {
    console.error("Add to wishlist error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.removeFromWishlist = async (req, res) => {
  try {
    const userId = req.userId;
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    const wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    wishlist.products = wishlist.products.filter(
      (p) => p.toString() !== productId,
    );
    await wishlist.save();

    return res.json({
      success: true,
      message: "Product removed from wishlist",
      wishlist: wishlist.products.map((p) => p.toString()),
    });
  } catch (err) {
    console.error("Remove from wishlist error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.syncWishlist = async (req, res) => {
  try {
    const userId = req.userId;
    const { guestWishlist } = req.body;

    if (!Array.isArray(guestWishlist)) {
      return res.status(400).json({
        success: false,
        message: "guestWishlist must be an array",
      });
    }

    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = await Wishlist.create({
        userId,
        products: guestWishlist,
      });
    } else {
      const existingIds = wishlist.products.map((p) => p.toString());
      const newItems = guestWishlist.filter((id) => !existingIds.includes(id));

      if (newItems.length > 0) {
        wishlist.products.push(...newItems);
        await wishlist.save();
      }
    }

    return res.json({
      success: true,
      message: "Wishlist synced successfully",
      wishlist: wishlist.products.map((p) => p.toString()),
    });
  } catch (err) {
    console.error("Sync wishlist error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.clearWishlist = async (req, res) => {
  try {
    const userId = req.userId;

    const wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    wishlist.products = [];
    await wishlist.save();

    return res.json({
      success: true,
      message: "Wishlist cleared successfully",
      wishlist: [],
    });
  } catch (err) {
    console.error("Clear wishlist error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
