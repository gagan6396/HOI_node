// controllers/order/orderController.js
const Orders = require("../../models/Order");
const Products = require("../../models/Product");
const Users = require("../../models/User");

const {
  sendOrderEmailToCustomer,
  sendNewOrderEmailToOwner,
} = require("../../utils/sendOrderEmail");

const sendCancelRequestEmailToOwner = require("../../utils/sendCancelRequestEmail");

const { isCodAllowedForPincode } = require("../../config/codConfig");

const CANCELLABLE_STATUSES = ["PLACED", "CONFIRMED", "PROCESSING"];

// 🔹 helper: totals
const calculateTotals = (items) => {
  let mrpTotal = 0;
  let itemsTotal = 0;

  items.forEach((item) => {
    mrpTotal += item.lineMrpTotal;
    itemsTotal += item.lineTotal;
  });

  const discountTotal = mrpTotal - itemsTotal;
  const shippingFee = itemsTotal >= 999 ? 0 : 60;
  const grandTotal = itemsTotal + shippingFee;

  return { mrpTotal, itemsTotal, discountTotal, shippingFee, grandTotal };
};

// 🔹 helper: compare 2 addresses
const isSameAddress = (a, b) => {
  if (!a || !b) return false;

  const norm = (v) => (v || "").toString().trim().toLowerCase();

  return (
    norm(a.addressLine1) === norm(b.addressLine1) &&
    norm(a.pincode) === norm(b.pincode) &&
    norm(a.phone) === norm(b.phone)
  );
};

// 🔹 helper: save shipping address to user
const ensureAddressSavedForUser = async (userId, shippingAddress) => {
  try {
    if (!userId || !shippingAddress) return;

    const user = await Users.findById(userId);
    if (!user) return;

    if (!Array.isArray(user.addresses)) {
      user.addresses = [];
    }

    const exists = user.addresses.some((addr) =>
      isSameAddress(addr, shippingAddress)
    );

    if (exists) return;

    const isFirst = user.addresses.length === 0;

    user.addresses.push({
      name: shippingAddress.name,
      phone: shippingAddress.phone,
      pincode: shippingAddress.pincode,
      addressLine1: shippingAddress.addressLine1,
      addressLine2: shippingAddress.addressLine2,
      city: shippingAddress.city,
      state: shippingAddress.state,
      landmark: shippingAddress.landmark,
      addressType: shippingAddress.addressType || "home",
      isDefault: isFirst,
    });

    await user.save();
  } catch (err) {
    console.error("ensureAddressSavedForUser error:", err);
  }
};

// 🔹 helper: product image
const getProductImage = (prod) => {
  if (!prod) return "https://via.placeholder.com/400x600?text=HOI";
  return (
    (Array.isArray(prod.images) && prod.images[0]) ||
    prod.image ||
    prod.mainImage ||
    "https://via.placeholder.com/400x600?text=HOI"
  );
};

// 🔹 helper: get productId
const getItemProductId = (item) => {
  if (!item) return null;
  return (
    item.productId ||
    item._id ||
    (item.product && item.product._id) ||
    item.id ||
    null
  );
};

// ✅ POST /v1/orders – CREATE ORDER
exports.createOrder = async (req, res) => {
  try {
    const userId = req.userId;

    const {
      items,
      shippingAddress,
      paymentMethod,
      notes,
      paymentStatus,
      razorpayOrderId,
      razorpayPaymentId,
    } = req.body;

    console.log("📥 Received createOrder request:");
    console.log("- paymentMethod:", paymentMethod);
    console.log("- paymentStatus from frontend:", paymentStatus);
    console.log("- razorpayOrderId:", razorpayOrderId);
    console.log("- razorpayPaymentId:", razorpayPaymentId);

    if (!items || !items.length) {
      return res.status(400).json({ message: "No items in order" });
    }

    if (
      !shippingAddress ||
      !shippingAddress.name ||
      !shippingAddress.phone ||
      !shippingAddress.addressLine1 ||
      !shippingAddress.city ||
      !shippingAddress.state ||
      !shippingAddress.pincode
    ) {
      return res
        .status(400)
        .json({ message: "Complete shipping address is required" });
    }

    if (!paymentMethod || !["COD", "ONLINE"].includes(paymentMethod)) {
      return res.status(400).json({ message: "Invalid payment method" });
    }

    // COD check
    if (paymentMethod === "COD") {
      const pin = String(shippingAddress.pincode).trim();

      if (!isCodAllowedForPincode(pin)) {
        return res.status(400).json({
          message:
            "Cash on Delivery is currently available only for Dehradun serviceable pincodes. Please choose Online Payment.",
          codAllowed: false,
        });
      }
    }

    // 1) get product IDs
    const productIds = items.map((i) => getItemProductId(i));

    if (productIds.some((id) => !id)) {
      return res.status(400).json({
        message:
          "One or more cart items are missing productId. Please refresh your cart and try again.",
      });
    }

    // 2) get products from DB
    const products = await Products.find({ _id: { $in: productIds } });

    const missingProducts = [];
    const orderItems = items.map((item, idx) => {
      const pid = productIds[idx];
      const product = products.find(
        (p) => p._id.toString() === pid.toString()
      );

      if (!product) {
        missingProducts.push(pid);
        return null;
      }

      const mrp = product.price?.mrp || product.mrp;
      const salePrice = product.price?.sale || product.salePrice || mrp;
      const quantity = item.quantity || 1;

      return {
        product:     product._id,
        name:        product.name,
        image:       getProductImage(product),
        // ✅ productCode aur brand ab save honge
        productCode: product.productCode || product.sku || "",
        brand:       product.brand || "",
        color:       item.color,
        size:
          typeof item.size === "string"
            ? item.size
            : item.size?.label || undefined,
        mrp,
        salePrice,
        quantity,
        lineTotal:    salePrice * quantity,
        lineMrpTotal: mrp * quantity,
      };
    });

    if (missingProducts.length > 0) {
      console.error("Missing products in order:", missingProducts);
      return res.status(400).json({
        message:
          "Some products in your cart are no longer available. Please refresh your cart.",
      });
    }

    const validOrderItems = orderItems.filter(Boolean);
    if (!validOrderItems.length) {
      return res.status(400).json({
        message: "No valid items in order.",
      });
    }

    const totals = calculateTotals(validOrderItems);

    // Determine final payment status
    let finalPaymentStatus = "PENDING";

    if (paymentMethod === "ONLINE" && paymentStatus === "PAID") {
      finalPaymentStatus = "PAID";
      console.log("✅ Payment already verified by frontend, setting status to PAID");
    } else if (paymentMethod === "COD") {
      finalPaymentStatus = "PENDING";
      console.log("📦 COD order, payment status remains PENDING");
    }

    console.log("💾 Creating order with paymentStatus:", finalPaymentStatus);

    // 3) Create order
    const newOrder = await Orders.create({
      user: userId,
      items: validOrderItems,
      shippingAddress: {
        name: shippingAddress.name,
        phone: shippingAddress.phone,
        pincode: shippingAddress.pincode,
        addressLine1: shippingAddress.addressLine1,
        addressLine2: shippingAddress.addressLine2,
        city: shippingAddress.city,
        state: shippingAddress.state,
        landmark: shippingAddress.landmark,
        addressType: shippingAddress.addressType || "home",
      },
      paymentMethod,
      paymentStatus: finalPaymentStatus,
      status: "PLACED",
      razorpayOrderId: razorpayOrderId || undefined,
      razorpayPaymentId: razorpayPaymentId || undefined,
      ...totals,
      totalSavings: totals.discountTotal,
      notes,
    });

    console.log("✅ Order created:", newOrder._id);
    console.log("   - Payment Method:", newOrder.paymentMethod);
    console.log("   - Payment Status:", newOrder.paymentStatus);

    // 4) Save address to user
    await ensureAddressSavedForUser(userId, shippingAddress);

    // 5) Get user details for email
    const user = await Users.findById(userId).select("name email");
    const orderForEmail = {
      ...newOrder.toObject(),
      user: user ? { name: user.name, email: user.email } : null,
    };

    // 6) Send emails
    try {
      if (finalPaymentStatus === "PAID") {
        console.log("📧 Sending PAYMENT_SUCCESS and PLACED emails...");
        await sendOrderEmailToCustomer(orderForEmail, "PAYMENT_SUCCESS");
        await sendOrderEmailToCustomer(orderForEmail, "PLACED");
      } else {
        console.log("📧 Sending PLACED email...");
        await sendOrderEmailToCustomer(orderForEmail, "PLACED");
      }

      await sendNewOrderEmailToOwner(orderForEmail);
      console.log("📧 Admin notification sent");
    } catch (emailErr) {
      console.error("Email sending error:", emailErr);
    }

    return res.status(201).json(newOrder);
  } catch (err) {
    console.error("Create order error:", err);
    return res.status(500).json({ message: "Failed to place order" });
  }
};

// ✅ GET /v1/orders/my-orders – current user history
exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.userId;

    const orders = await Orders.find({ user: userId })
      .sort({ createdAt: -1 })
      .lean();

    return res.json(orders);
  } catch (err) {
    console.error("Get my orders error:", err);
    return res.status(500).json({ message: "Failed to fetch orders" });
  }
};

// ✅ USER: PATCH /v1/orders/:id/request-cancel
exports.requestCancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.userId;
    const { reason, reasonText } = req.body;

    if (!reason) {
      return res
        .status(400)
        .json({ message: "Cancellation reason is required" });
    }

    const order = await Orders.findOne({ _id: orderId, user: userId })
      .populate("user", "name email")
      .exec();

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const currentStatus = (order.status || "").toUpperCase();

    if (currentStatus === "CANCELLED") {
      return res
        .status(400)
        .json({ message: "This order is already cancelled" });
    }

    if (!CANCELLABLE_STATUSES.includes(currentStatus)) {
      return res.status(400).json({
        message:
          "This order cannot be cancelled in its current status. Please contact support.",
      });
    }

    if (order.cancelRequested) {
      return res.status(400).json({
        message: "Cancellation request is already submitted for this order.",
      });
    }

    order.cancelRequested = true;
    order.cancelReason = reason;
    order.cancelReasonNote = reasonText || null;
    order.cancelRequestedAt = new Date();

    await order.save();

    try {
      await sendCancelRequestEmailToOwner(order.toObject());
    } catch (emailErr) {
      console.error("Cancel request email error:", emailErr);
    }

    return res.json({
      message:
        "Your cancellation request has been submitted. We will update you soon.",
      order,
    });
  } catch (err) {
    console.error("requestCancelOrder error:", err);
    return res.status(500).json({
      message: "Failed to submit cancellation request",
    });
  }
};

// ✅ GET /v1/orders/:id – detail
exports.getOrderById = async (req, res) => {
  try {
    const orderId = req.params.id;

    const order = await Orders.findById(orderId)
      .populate("user", "name email phone")
      .lean();

    if (!order) return res.status(404).json({ message: "Order not found" });

    if (
      req.userRole !== "admin" &&
      order.user &&
      order.user._id.toString() !== req.userId
    ) {
      return res.status(403).json({ message: "Not allowed" });
    }

    return res.json(order);
  } catch (err) {
    console.error("Get order error:", err);
    return res.status(500).json({ message: "Failed to fetch order" });
  }
};

// ✅ ADMIN: GET /v1/orders/admin/list
exports.adminGetOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status && status !== "ALL") {
      query.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [orders, total] = await Promise.all([
      Orders.find(query)
        .populate("user", "name email phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Orders.countDocuments(query),
    ]);

    return res.json({
      page: Number(page),
      limit: Number(limit),
      total,
      orders,
    });
  } catch (err) {
    console.error("Admin get orders error:", err);
    return res.status(500).json({ message: "Failed to fetch admin orders" });
  }
};

// ✅ ADMIN: PATCH /v1/orders/admin/:id/status
exports.adminUpdateOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status, paymentStatus } = req.body;

    const validStatuses = [
      "PLACED",
      "CONFIRMED",
      "PROCESSING",
      "SHIPPED",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "CANCELLED",
    ];
    const validPaymentStatuses = ["PENDING", "PAID", "FAILED", "REFUNDED"];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    if (paymentStatus && !validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({ message: "Invalid payment status" });
    }

    const order = await Orders.findById(orderId).populate("user", "name email");
    if (!order) return res.status(404).json({ message: "Order not found" });

    const oldStatus = order.status;

    if (status) {
      order.status = status;

      if (order.paymentMethod === "COD" && status === "DELIVERED") {
        order.paymentStatus = "PAID";
      }

      if (status === "CANCELLED") {
        order.cancelApprovedAt = new Date();
        order.cancelRequested = false;
        order.cancelledBy = req.userId || null;

        if (order.paymentMethod === "ONLINE") {
          order.paymentStatus = "REFUNDED";
        } else if (order.paymentMethod === "COD") {
          order.paymentStatus = "PENDING";
        }

        if (oldStatus !== "CANCELLED") {
          if (Array.isArray(order.items) && order.items.length > 0) {
            for (const item of order.items) {
              if (!item.product) continue;

              const product = await Products.findById(item.product);
              if (!product) continue;

              const qty = item.quantity || 1;

              if (typeof product.stock === "number") {
                product.stock += qty;
              }

              if (Array.isArray(product.sizes) && item.size) {
                const idx = product.sizes.findIndex(
                  (s) => s.label === item.size
                );
                if (idx !== -1) {
                  product.sizes[idx].stock =
                    (product.sizes[idx].stock || 0) + qty;
                }
              }

              await product.save();
            }
          }
        }
      }
    }

    if (paymentStatus) {
      order.paymentStatus = paymentStatus;
    }

    await order.save();

    if (status) {
      const orderObj = order.toObject();
      await sendOrderEmailToCustomer(orderObj, status);
    }

    return res.json(order);
  } catch (err) {
    console.error("Admin update status error:", err);
    return res.status(500).json({ message: "Failed to update order" });
  }
};