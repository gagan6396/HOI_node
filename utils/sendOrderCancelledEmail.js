// utils/sendOrderCancelledEmail.js
const transporter = require("./emailTransporter");

const BRAND_COLOR = "#d63384";
const TEXT_COLOR = "#333333";
const ACCENT_BG = "#fff3f9";

const FRONTEND_URL = process.env.FRONTEND_BASE_URL || "http://localhost:3000";
const ADMIN_ORDERS_URL =
  process.env.ADMIN_ORDERS_URL || `${FRONTEND_URL}/admin/orders`;

function formatINR(amount) {
  if (!amount || isNaN(amount)) return "₹ 0.00";
  return `₹ ${Number(amount).toFixed(2)}`;
}

// 🔹 ITEMS TABLE (PRODUCT NAME, PRODUCT CODE, BRAND, SIZE, COLOR DOT, QTY, PRICE, LINE TOTAL)
const ITEMS_TABLE = (order) => {
  if (!order.items || !order.items.length) {
    return `
      <div style="font-size:13px; margin:10px 0;">
        <strong>Items:</strong><br/>
        No items found
      </div>
    `;
  }

  const rows = order.items
    .map((item) => {
      const name = item.name || item.productName || "Product";
      const brand = item.brand || item.productBrand || "";

      const brandLine = brand
        ? `<div style="font-size:11px; color:#777;">Brand: ${brand}</div>`
        : "";

      // ✅ Product Code line
      const productCodeLine = item.productCode
        ? `<div style="font-size:11px; color:#999; font-family:monospace; margin-top:2px;">
             Code: ${item.productCode}
           </div>`
        : "";

      const mrp = item.mrp;
      const salePrice = item.salePrice || item.price || 0;

      const mrpLine =
        mrp && mrp !== salePrice
          ? `<div style="font-size:11px; color:#999; text-decoration:line-through;">MRP: ₹${mrp}</div>`
          : "";

      const qty = item.quantity || item.qty || 1;
      const lineTotal = item.lineTotal || salePrice * qty;

      // Color dot
      const colorDot = item.color
        ? `<span style="
              display:inline-block;
              width:12px;
              height:12px;
              border-radius:50%;
              border:1px solid #ccc;
              background:${item.color};
              vertical-align:middle;
              margin-right:6px;
            "></span>`
        : "";

      const sizeLabel = item.size ? `Size: ${item.size}` : "Size: -";

      const colorLabel = item.color
        ? `${colorDot}<span style="vertical-align:middle;">${item.color}</span>`
        : "Color: -";

      return `
        <tr>
          <td style="padding:8px 6px; border-top:1px solid #f2cede;">
            <div style="font-size:13px; font-weight:bold; color:${TEXT_COLOR};">
              ${name}
            </div>
            ${brandLine}
            ${productCodeLine}
            <div style="font-size:11px; color:#555; margin-top:2px;">
              ${sizeLabel} &nbsp; • &nbsp; ${colorLabel}
            </div>
          </td>
          <td style="padding:8px 6px; border-top:1px solid #f2cede; font-size:13px; color:#555;" align="center">
            ×${qty}
          </td>
          <td style="padding:8px 6px; border-top:1px solid #f2cede; font-size:13px; color:#555;" align="right">
            <div>₹${salePrice}</div>
            ${mrpLine}
            <div style="font-size:11px; color:${BRAND_COLOR}; margin-top:2px;">
              Line total: ₹${lineTotal}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <table width="100%" border="0" cellspacing="0" cellpadding="0"
           style="margin-top:18px; background-color:#fffafa; border-radius:8px; padding:0; border:1px solid #f2cede;">
      <tr>
        <td colspan="3" style="padding:10px 14px 6px; font-family:Arial, sans-serif;">
          <span style="font-size:14px; font-weight:bold; color:${TEXT_COLOR};">
            Items in this order
          </span>
        </td>
      </tr>
      <tr>
        <td colspan="3" style="padding:0 14px 10px;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-family:Arial, sans-serif; font-size:13px;">
            <tr>
              <th align="left" style="font-size:12px; color:#999; font-weight:600; padding:4px 6px 6px;">Product</th>
              <th align="center" style="font-size:12px; color:#999; font-weight:600; padding:4px 6px 6px;">Qty</th>
              <th align="right" style="font-size:12px; color:#999; font-weight:600; padding:4px 6px 6px;">Price</th>
            </tr>
            ${rows}
          </table>
        </td>
      </tr>
    </table>
  `;
};

// 🔹 ORDER SUMMARY BLOCK
const ORDER_SUMMARY = (order) => {
  const totalAmount =
    order.totalAmount || order.grandTotal || order.amount || 0;
  const itemsTotal = order.itemsTotal || order.subTotal || null;
  const discountTotal = order.discountTotal || null;
  const shippingFee =
    order.shippingFee !== undefined ? order.shippingFee : null;

  return `
    <div style="background:${ACCENT_BG}; padding:10px 12px; border-radius:8px; margin:10px 0;">
      <p style="font-size:13px; margin:0 0 4px;">
        <strong>Total:</strong> ${formatINR(totalAmount)}<br/>
        <strong>Payment:</strong> ${(order.paymentMethod || "")
          .toString()
          .toUpperCase()}
      </p>
      ${
        order.paymentStatus
          ? `<p style="font-size:13px; margin:4px 0 0;">
               <strong>Payment status:</strong> ${order.paymentStatus}
             </p>`
          : ""
      }
      ${
        itemsTotal
          ? `<p style="font-size:13px; margin:4px 0 0;">
               <strong>Items total:</strong> ${formatINR(itemsTotal)}
             </p>`
          : ""
      }
      ${
        discountTotal
          ? `<p style="font-size:13px; margin:4px 0 0;">
               <strong>Discount:</strong> -${formatINR(discountTotal)}
             </p>`
          : ""
      }
      ${
        shippingFee !== null
          ? `<p style="font-size:13px; margin:4px 0 0;">
               <strong>Shipping:</strong> ${
                 shippingFee === 0
                   ? "<span style='color:#16a34a;'>FREE</span>"
                   : formatINR(shippingFee)
               }
             </p>`
          : ""
      }
    </div>
  `;
};

// 🔹 CUSTOMER DETAILS BLOCK
const CUSTOMER_DETAILS = (order, user) => {
  const a = order.shippingAddress || {};
  return `
    <div style="background:#fff7fc; padding:10px 12px; border-radius:8px; margin:16px 0 10px; border:1px solid #f2cede;">
      <div style="font-size:14px; font-weight:bold; color:${TEXT_COLOR}; margin-bottom:6px;">
        Customer Details
      </div>

      <div style="font-size:13px; color:#444; line-height:1.5;">
        <b>Name:</b> ${a.name || user?.name || "Customer"}<br/>
        <b>Email:</b> ${user?.email || "-"}<br/>
        <b>Phone:</b> ${a.phone || user?.phone || "-"}<br/>
      </div>

      <div style="font-size:13px; color:#444; margin-top:8px; line-height:1.5;">
        <b>Address:</b><br/>
        ${a.addressLine1 || ""}${a.addressLine1 ? "<br/>" : ""}
        ${a.addressLine2 || ""}${a.addressLine2 ? "<br/>" : ""}
        ${(a.city || "") + (a.city ? ", " : "")}${a.state || ""}${
          a.pincode ? " - " + a.pincode : ""
        }<br/>
        <b>Type:</b> ${a.addressType || "N/A"}
      </div>
    </div>
  `;
};

function buildCancelledHtml(order, isAdmin, user) {
  const userName = user?.name || "Customer";
  const orderIdLabel = order.orderNumber || order._id;
  const orderLinkUser = `${FRONTEND_URL}/account/orders/${order._id}`;
  const orderLinkAdmin = `${ADMIN_ORDERS_URL}/${order._id}`;

  const placedAt = order.createdAt
    ? new Date(order.createdAt).toLocaleString()
    : "";
  const cancelledAt = order.cancelApprovedAt
    ? new Date(order.cancelApprovedAt).toLocaleString()
    : new Date().toLocaleString();

  return `
  <div style="font-family: Arial, sans-serif; background:#f5f5f5; padding:20px;">
    <div style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #f3e6ee;">
      <div style="background:${BRAND_COLOR}; color:#ffffff; padding:16px 20px;">
        <h2 style="margin:0; font-size:18px;">Order Cancelled</h2>
        <p style="margin:4px 0 0; font-size:13px;">House of Intimacy</p>
      </div>

      <div style="padding:18px 20px;">
        <p style="font-size:14px; color:${TEXT_COLOR}; margin-top:0;">
          ${
            isAdmin
              ? `Order <strong>${orderIdLabel}</strong> has been cancelled.`
              : `Hi ${userName},<br/>Your order <strong>${orderIdLabel}</strong> has been cancelled.`
          }
        </p>

        ${ORDER_SUMMARY(order)}

        <h4 style="font-size:14px; margin:14px 0 6px;">Order timeline</h4>
        <p style="font-size:13px; margin:0 0 6px;">
          <strong>Placed on:</strong> ${placedAt}<br/>
          <strong>Cancelled at:</strong> ${cancelledAt}
        </p>

        ${CUSTOMER_DETAILS(order, user)}

        ${ITEMS_TABLE(order)}

        <div style="text-align:center; margin-top:18px;">
          <a href="${isAdmin ? orderLinkAdmin : orderLinkUser}"
             style="display:inline-block; background:${BRAND_COLOR}; color:#ffffff; text-decoration:none; padding:10px 18px; border-radius:999px; font-size:14px;">
            View this order
          </a>
        </div>

        ${
          !isAdmin
            ? `<p style="font-size:12px; color:#777; margin-top:14px;">
                 If you paid online, your refund (if applicable) will be processed as per our refund policy.
               </p>`
            : ""
        }
      </div>
    </div>
  </div>
  `;
}

async function sendOrderCancelledEmails(order, user) {
  const adminEmailsStr =
    process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL;
  const adminEmails = adminEmailsStr
    ? adminEmailsStr.split(",").map((e) => e.trim())
    : [];

  const userEmail = user?.email;

  if (userEmail) {
    await transporter.sendMail({
      from: `"House of Intimacy" <${process.env.ADMIN_EMAIL}>`,
      to: userEmail,
      subject: `Your order ${order.orderNumber || order._id} has been cancelled`,
      html: buildCancelledHtml(order, false, user),
    });
  }

  if (adminEmails.length > 0) {
    await transporter.sendMail({
      from: `"House of Intimacy" <${process.env.ADMIN_EMAIL}>`,
      to: adminEmails,
      subject: `Order cancelled: ${order.orderNumber || order._id}`,
      html: buildCancelledHtml(order, true, user),
    });
  }
}

module.exports = sendOrderCancelledEmails;