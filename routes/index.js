// routes/index.js
const express = require("express");
const router = express.Router();

const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const productRoutes = require("./productRoutes");
const orderRoutes = require("./orderRoutes");
const testRoutes = require("./testRoutes");
const shippingRoutes = require("./shippingRoutes");
const blogRoutes = require("./blogRoutes");
const paymentRoutes = require("./paymentRoutes");

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/products", productRoutes);
router.use("/orders", orderRoutes);
router.use("/test", testRoutes);
router.use("/shipping", shippingRoutes);
router.use("/payment", paymentRoutes);

// ✅ All blog APIs under /v1/myblogs
router.use("/myblogs", blogRoutes);

module.exports = router;
