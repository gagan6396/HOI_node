const razorpay = require("../config/razorpay");
const crypto = require("crypto");
const Order = require("../models/Order"); // 🔥 IMPORTANT

// CREATE ORDER
const createOrder = async (req, res) => {
  try {
    const { amount } = req.body;

    const order = await razorpay.orders.create({
      amount: amount * 100, // ₹ → paise
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
    });

    res.status(200).json(order);
  } catch (error) {
    console.error("Razorpay error:", error);
    res.status(500).json({ message: "Razorpay order creation failed" });
  }
};

// VERIFY PAYMENT ✅ FINAL VERSION
const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false });
    }

    // 🔥 THIS LINE WAS MISSING IN YOUR FLOW
    const updatedOrder = await Order.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      {
        paymentStatus: "PAID",
        paymentMethod: "ONLINE",
      },
      { new: true }
    );

    if (!updatedOrder) {
      console.log("❌ Order not found for Razorpay ID:", razorpay_order_id);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("verifyPayment error:", err);
    return res.status(500).json({ success: false });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
};