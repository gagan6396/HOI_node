const Cart = require("../../models/Cart");

// GET /v1/cart
exports.getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ userId: req.userId });
    if (!cart) cart = await Cart.create({ userId: req.userId, items: [] });

    return res.json({ success: true, items: cart.items });
  } catch (err) {
    console.error("Get cart error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /v1/cart/sync  ← login ke baad guest cart ko DB se merge karo
exports.syncCart = async (req, res) => {
  try {
    const { guestItems } = req.body; // [{ productId, quantity, size, color, colorLabel }]

    if (!Array.isArray(guestItems)) {
      return res.status(400).json({ success: false, message: "guestItems must be an array" });
    }

    let cart = await Cart.findOne({ userId: req.userId });

    if (!cart) {
      cart = await Cart.create({ userId: req.userId, items: guestItems });
    } else {
      // Merge: guest items ko DB items ke upar daal do (same productId+size+color = quantity add karo)
      for (const guestItem of guestItems) {
        const existing = cart.items.find(
          (i) =>
            i.productId.toString() === guestItem.productId &&
            i.size === (guestItem.size || "") &&
            i.color === (guestItem.color || "")
        );

        if (existing) {
          existing.quantity += guestItem.quantity || 1;
        } else {
          cart.items.push(guestItem);
        }
      }
      await cart.save();
    }

    return res.json({ success: true, items: cart.items });
  } catch (err) {
    console.error("Sync cart error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// PUT /v1/cart  ← poora cart ek saath save karo (simplest approach)
exports.saveCart = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: "items must be an array" });
    }

    const cart = await Cart.findOneAndUpdate(
      { userId: req.userId },
      { $set: { items } },
      { upsert: true, new: true }
    );

    return res.json({ success: true, items: cart.items });
  } catch (err) {
    console.error("Save cart error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// DELETE /v1/cart  ← logout pe clear karo (optional, usually nahi karte)
exports.clearCart = async (req, res) => {
  try {
    await Cart.findOneAndUpdate(
      { userId: req.userId },
      { $set: { items: [] } }
    );
    return res.json({ success: true, message: "Cart cleared" });
  } catch (err) {
    console.error("Clear cart error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};