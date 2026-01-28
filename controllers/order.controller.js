// FIXED VERSION - orderController.js
// 🔥 KEY CHANGES:
// 1. Send PAYMENT_SUCCESS email immediately when paymentStatus is PAID
// 2. Don't send duplicate PLACED email for online payments
// 3. Better error handling

// ... (keep all your existing imports and helper functions) ...

// ✅ POST /v1/orders – user creates order (checkout se)
exports.createOrder = async (req, res) => {
  try {
    const userId = req.userId;

    const { 
      items, 
      shippingAddress, 
      paymentMethod, 
      notes,
      paymentStatus,  // 🔥 NEW - frontend will send this for online payments
      razorpayOrderId,
      razorpayPaymentId
    } = req.body;

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

    // 🔴 NEW: COD sirf Dehradun ke pincodes par allowed
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

    // 1) get product IDs safely
    const productIds = items.map((i) => getItemProductId(i));

    if (productIds.some((id) => !id)) {
      return res.status(400).json({
        message:
          "One or more cart items are missing productId. Please refresh your cart and try again.",
      });
    }

    // 2) get product details from DB
    const products = await Products.find({ _id: { $in: productIds } });

    const missingProducts = [];
    const orderItems = items.map((item, idx) => {
      const pid = productIds[idx];
      const product = products.find((p) => p._id.toString() === pid.toString());

      if (!product) {
        missingProducts.push(pid);
        return null;
      }

      const mrp = product.price?.mrp || product.mrp;
      const salePrice = product.price?.sale || product.salePrice || mrp;
      const quantity = item.quantity || 1;

      return {
        product: product._id,
        name: product.name,
        image: getProductImage(product),
        color: item.color,
        size:
          typeof item.size === "string"
            ? item.size
            : item.size?.label || undefined,
        mrp,
        salePrice,
        quantity,
        lineTotal: salePrice * quantity,
        lineMrpTotal: mrp * quantity,
      };
    });

    // agar koi product missing hai
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

    // 3) Determine payment status
    let finalPaymentStatus = "PENDING";
    
    if (paymentMethod === "ONLINE" && paymentStatus === "PAID") {
      // 🔥 If frontend confirms payment is verified, mark as PAID
      finalPaymentStatus = "PAID";
    }

    // 4) order create
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
      paymentStatus: finalPaymentStatus,  // 🔥 FIXED
      status: "PLACED",
      razorpayOrderId: razorpayOrderId || undefined,
      razorpayPaymentId: razorpayPaymentId || undefined,
      ...totals,
      totalSavings: totals.discountTotal,
      notes,
    });

    // 5) shippingAddress ko user ke addresses[] me bhi save karo (agar new hai)
    await ensureAddressSavedForUser(userId, shippingAddress);

    // 6) user details for email
    const user = await Users.findById(userId).select("name email");
    const orderForEmail = {
      ...newOrder.toObject(),
      user: user ? { name: user.name, email: user.email } : null,
    };

    // 7) 🔥 SEND EMAILS BASED ON PAYMENT STATUS
    try {
      if (finalPaymentStatus === "PAID") {
        // Online payment already verified
        await sendOrderEmailToCustomer(orderForEmail, "PAYMENT_SUCCESS");
        await sendOrderEmailToCustomer(orderForEmail, "PLACED");
      } else {
        // COD or pending online payment
        await sendOrderEmailToCustomer(orderForEmail, "PLACED");
      }

      // Admin notification
      await sendNewOrderEmailToOwner(orderForEmail);
    } catch (emailErr) {
      console.error("Email sending error:", emailErr);
      // Don't fail the order creation if email fails
    }

    return res.status(201).json(newOrder);
  } catch (err) {
    console.error("Create order error:", err);
    return res.status(500).json({ message: "Failed to place order" });
  }
};

// ... (rest of your controller code remains the same) ...