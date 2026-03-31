// controllers/paymentController.js
const fs = require("fs");
const path = require("path");
const { Juspay, APIError } = require("expresscheckout-nodejs");

const Orders = require("../models/Order");
const Products = require("../models/Product");
const Users = require("../models/User");

const {
  sendOrderEmailToCustomer,
  sendNewOrderEmailToOwner,
} = require("../utils/sendOrderEmail");


// ─── ENV ──────────────────────────────────────────────────────────────────────
const HDFC_MERCHANT_ID       = process.env.HDFC_MERCHANT_ID;
const HDFC_PAYMENT_CLIENT_ID = process.env.HDFC_PAYMENT_CLIENT_ID; // "hdfcmaster" for UAT
const HDFC_KEY_UUID          = process.env.HDFC_KEY_UUID;
const HDFC_BASE_URL          = process.env.HDFC_BASE_URL; // https://smartgateway.hdfcuat.bank.in
const FRONTEND_BASE_URL      = process.env.FRONTEND_BASE_URL;  // http://localhost:3000
const BACKEND_BASE_URL       = process.env.BACKEND_BASE_URL; // http://localhost:8000/v1

// ─── JUSPAY SDK INIT ──────────────────────────────────────────────────────────
const publicKey  = fs.readFileSync(path.resolve(process.env.HDFC_PUBLIC_KEY_PATH));
const privateKey = fs.readFileSync(path.resolve(process.env.HDFC_PRIVATE_KEY_PATH));

const juspay = new Juspay({
  merchantId: HDFC_MERCHANT_ID,
  baseUrl: HDFC_BASE_URL,
  jweAuth: {
    keyId: HDFC_KEY_UUID,
    publicKey,
    privateKey,
  },
});

// ─── ORDER HELPERS ────────────────────────────────────────────────────────────

const getProductImage = (prod) => {
  if (!prod) return "https://via.placeholder.com/400x600?text=HOI";
  return (
    (Array.isArray(prod.images) && prod.images[0]) ||
    prod.image ||
    prod.mainImage ||
    "https://via.placeholder.com/400x600?text=HOI"
  );
};

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

const calculateTotals = (items) => {
  let mrpTotal = 0;
  let itemsTotal = 0;

  items.forEach((item) => {
    mrpTotal   += item.lineMrpTotal;
    itemsTotal += item.lineTotal;
  });

  const discountTotal = mrpTotal - itemsTotal;
  const shippingFee   = itemsTotal >= 999 ? 0 : 60;
  const grandTotal    = itemsTotal + shippingFee;

  return { mrpTotal, itemsTotal, discountTotal, shippingFee, grandTotal };
};

// ─── CREATE ORDER ─────────────────────────────────────────────────────────────
/**
 * POST /v1/payment/create-order
 * 1. Validates items + address
 * 2. Creates Order in DB with paymentStatus: "PENDING"
 * 3. Calls Juspay Session API → gets payment link
 * 4. Returns payment link to frontend for redirect
 */
const createOrder = async (req, res) => {
  try {
    const userId = req.userId;

    const {
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      items,
    } = req.body;

    // ── Validate ──────────────────────────────────────────────────────────────
    if (!items || !items.length) {
      return res.status(400).json({ message: "No items in order." });
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
      return res.status(400).json({ message: "Complete shipping address is required." });
    }

    if (!customerName || !customerPhone) {
      return res.status(400).json({ message: "customerName and customerPhone are required." });
    }

    // ── Resolve products from DB ──────────────────────────────────────────────
    const productIds = items.map((i) => getItemProductId(i));

    if (productIds.some((id) => !id)) {
      return res.status(400).json({
        message: "One or more cart items are missing productId. Please refresh your cart.",
      });
    }

    const products = await Products.find({ _id: { $in: productIds } });

    const missingProducts = [];
    const orderItems = items.map((item, idx) => {
      const pid     = productIds[idx];
      const product = products.find((p) => p._id.toString() === pid.toString());

      if (!product) {
        missingProducts.push(pid);
        return null;
      }

      const mrp       = product.price?.mrp || product.mrp;
      const salePrice = product.price?.sale || product.salePrice || mrp;
      const quantity  = item.quantity || 1;

      return {
        product:      product._id,
        name:         product.name,
        image:        getProductImage(product),
        productCode:  product.productCode || product.sku || "",
        brand:        product.brand || "",
        color:        item.color,
        size:         typeof item.size === "string" ? item.size : item.size?.label || undefined,
        mrp,
        salePrice,
        quantity,
        lineTotal:    salePrice * quantity,
        lineMrpTotal: mrp * quantity,
      };
    });

    if (missingProducts.length > 0) {
      return res.status(400).json({
        message: "Some products in your cart are no longer available. Please refresh your cart.",
      });
    }

    const validOrderItems = orderItems.filter(Boolean);
    if (!validOrderItems.length) {
      return res.status(400).json({ message: "No valid items in order." });
    }

    const totals = calculateTotals(validOrderItems);

    // ── Generate unique order ID (max 21 chars, alphanumeric only) ────────────
    const orderId = `ORD${Date.now()}`.slice(0, 21);

    // ── Save Order to DB with PENDING status BEFORE calling Juspay ───────────
    const newOrder = await Orders.create({
      user:          userId,
      items:         validOrderItems,
      shippingAddress: {
        name:         shippingAddress.name,
        phone:        shippingAddress.phone,
        pincode:      shippingAddress.pincode,
        addressLine1: shippingAddress.addressLine1,
        addressLine2: shippingAddress.addressLine2,
        city:         shippingAddress.city,
        state:        shippingAddress.state,
        landmark:     shippingAddress.landmark,
        addressType:  shippingAddress.addressType || "home",
      },
      paymentMethod:  "ONLINE",
      paymentStatus:  "PENDING",
      status:         "PLACED",
      transactionId:  orderId,
      ...totals,
      totalSavings: totals.discountTotal,
    });

    console.log("✅ Pending order created:", newOrder._id, "| orderId:", orderId);

    // ── Call Juspay Session API ───────────────────────────────────────────────
    const returnUrl = `${BACKEND_BASE_URL}/payment/hdfc-response`;

    const sessionResponse = await juspay.orderSession.create({
      order_id:              orderId,
      amount:                parseFloat(totals.grandTotal).toFixed(2),
      payment_page_client_id: HDFC_PAYMENT_CLIENT_ID,
      customer_id:           userId.toString(),
      customer_email:        customerEmail || "",
      customer_phone:        customerPhone,
      first_name:            customerName.split(" ")[0] || customerName,
      last_name:             customerName.split(" ").slice(1).join(" ") || "",
      action:                "paymentPage",
      return_url:            returnUrl,
      currency:              "INR",
    });

    console.log("✅ Juspay session created, payment link:", sessionResponse.payment_links?.web);

    // payment_links.web is the URL to redirect user to
    const paymentLink = sessionResponse.payment_links?.web;

    if (!paymentLink) {
      console.error("Juspay session response missing payment link:", sessionResponse);
      return res.status(500).json({ message: "Failed to get payment link from HDFC." });
    }

    return res.status(200).json({ paymentUrl: paymentLink });

  } catch (error) {
    if (error instanceof APIError) {
      console.error("Juspay API error:", error.message);
      return res.status(500).json({ message: `HDFC error: ${error.message}` });
    }
    console.error("HDFC create-order error:", error);
    return res.status(500).json({ message: "Failed to create payment order." });
  }
};

// ─── HDFC RESPONSE HANDLER ────────────────────────────────────────────────────
/**
 * POST /v1/payment/hdfc-response  (return_url)
 * HDFC redirects user here after payment
 * We call Juspay Order Status API to verify — never trust query params alone
 * Then update DB and redirect user to frontend
 */
const handleHdfcResponse = async (req, res) => {
  try {
    // order_id comes as query param or body after redirect
    const orderId = req.query.order_id || req.body.order_id || req.body.orderId;

    if (!orderId) {
      console.error("HDFC response: missing order_id");
      return res.redirect(`${FRONTEND_BASE_URL}/order/failed?reason=missing_order_id`);
    }

    // ── Server-to-Server Order Status call (mandatory per HDFC docs) ──────────
    const statusResponse = await juspay.order.status(orderId);
    const orderStatus    = statusResponse.status;

    console.log("Juspay order status for", orderId, ":", orderStatus);

    if (orderStatus === "CHARGED") {
      // ✅ Payment confirmed — update Order to PAID
      const updatedOrder = await Orders.findOneAndUpdate(
        { transactionId: orderId },
        {
          paymentStatus:  "PAID",
          hdfcTrackingId: statusResponse.txn_id || statusResponse.id || "",
        },
        { new: true }
      ).populate("user", "name email");

      if (!updatedOrder) {
        console.warn("⚠️  Order not found for orderId:", orderId);
        return res.redirect(`${FRONTEND_BASE_URL}/order-success?ref=${orderId}`);
      }

      // Send confirmation emails
      try {
        const orderObj = updatedOrder.toObject();
        await sendOrderEmailToCustomer(orderObj, "PAYMENT_SUCCESS");
        await sendOrderEmailToCustomer(orderObj, "PLACED");
        await sendNewOrderEmailToOwner(orderObj);
        console.log("📧 Emails sent for order:", updatedOrder._id);
      } catch (emailErr) {
        console.error("Email error after HDFC success:", emailErr);
      }

      return res.redirect(`${FRONTEND_BASE_URL}/order-success/${updatedOrder._id}`);

    } else if (orderStatus === "PENDING" || orderStatus === "PENDING_VBV") {
      // ⏳ Payment still pending
      console.warn("Payment pending for order:", orderId);
      return res.redirect(
        `${FRONTEND_BASE_URL}/order-result?status=pending&orderId=${orderId}`
      );

    } else {
      // ❌ AUTHORIZATION_FAILED, AUTHENTICATION_FAILED, etc.
      console.warn("Payment failed for order:", orderId, "| status:", orderStatus);

      await Orders.findOneAndUpdate(
        { transactionId: orderId },
        { paymentStatus: "FAILED" },
        { new: true }
      ).catch((err) => console.error("Order FAILED update error:", err));

      return res.redirect(
        `${FRONTEND_BASE_URL}/order-result?status=failed&reason=${encodeURIComponent(orderStatus)}`
      );
    }

  } catch (error) {
    if (error instanceof APIError) {
      console.error("Juspay status API error:", error.message);
    } else {
      console.error("handleHdfcResponse error:", error);
    }
    return res.redirect(`${FRONTEND_BASE_URL}/order-result?status=failed&reason=server_error`);
  }
};

module.exports = {
  createOrder,
  handleHdfcResponse,
};