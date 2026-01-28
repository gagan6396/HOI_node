// utils/generateInvoice.js - IMPROVED DESIGN
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const BRAND_COLOR = '#d63384';
const SECONDARY_COLOR = '#e91e63';
const TEXT_COLOR = '#1a1a1a';
const GRAY = '#666666';
const LIGHT_GRAY = '#f8f9fa';
const BORDER_COLOR = '#e0e0e0';

// Invoice storage directory
const INVOICE_DIR = path.join(__dirname, '../invoices');

// Ensure invoice directory exists
if (!fs.existsSync(INVOICE_DIR)) {
  fs.mkdirSync(INVOICE_DIR, { recursive: true });
}

/**
 * Generate PDF invoice for an order
 * @param {Object} order - Order object with all details
 * @returns {Promise<string>} - Path to generated invoice
 */
const generateInvoice = async (order) => {
  return new Promise((resolve, reject) => {
    try {
      // Create invoice filename
      const invoiceNumber = order.orderNumber || `INV${order._id.toString().slice(-8).toUpperCase()}`;
      const filename = `${invoiceNumber}.pdf`;
      const filepath = path.join(INVOICE_DIR, filename);

      // Create PDF document with optimized margins
      const doc = new PDFDocument({ 
        margin: 40,
        size: 'A4',
        bufferPages: true
      });
      const stream = fs.createWriteStream(filepath);

      doc.pipe(stream);

      let yPos = 40;

      // =============== HEADER WITH GRADIENT EFFECT ===============
      // Brand header background
      doc
        .rect(40, yPos, 515, 70)
        .fill(BRAND_COLOR);

      // Company name and tagline
      doc
        .fontSize(28)
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .text('House of Intimacy', 55, yPos + 15, { align: 'left' });

      doc
        .fontSize(9)
        .fillColor('#ffffff')
        .font('Helvetica')
        .text('Elegance • Comfort • Confidence', 55, yPos + 48);

      // Invoice number badge
      const badgeX = 420;
      const badgeY = yPos + 15;
      doc
        .roundedRect(badgeX, badgeY, 120, 40, 5)
        .fill('#ffffff');

      doc
        .fontSize(10)
        .fillColor(BRAND_COLOR)
        .font('Helvetica-Bold')
        .text('INVOICE', badgeX, badgeY + 8, { width: 120, align: 'center' });

      doc
        .fontSize(12)
        .fillColor(TEXT_COLOR)
        .font('Helvetica')
        .text(`#${invoiceNumber}`, badgeX, badgeY + 23, { width: 120, align: 'center' });

      yPos += 90;

      // =============== BUSINESS & CUSTOMER INFO ===============
      // Info section background
      doc
        .roundedRect(40, yPos, 515, 95, 3)
        .lineWidth(1)
        .strokeColor(BORDER_COLOR)
        .stroke();

      // Divider line between from/to
      doc
        .moveTo(290, yPos)
        .lineTo(290, yPos + 95)
        .strokeColor(BORDER_COLOR)
        .stroke();

      const infoStartY = yPos + 15;

      // FROM section
      doc
        .fontSize(10)
        .fillColor(BRAND_COLOR)
        .font('Helvetica-Bold')
        .text('FROM', 55, infoStartY);

      doc
        .fontSize(9)
        .fillColor(TEXT_COLOR)
        .font('Helvetica-Bold')
        .text('House of Intimacy', 55, infoStartY + 18);

      doc
        .fontSize(8)
        .fillColor(GRAY)
        .font('Helvetica')
        .text('Dehradun, Uttarakhand, India - 248001', 55, infoStartY + 32, { width: 220 })
        .text('Email: support@hoi.in', 55, infoStartY + 46)
        .text('Phone: +91 9876543210', 55, infoStartY + 58);

      // TO section
      const addr = order.shippingAddress || {};
      doc
        .fontSize(10)
        .fillColor(BRAND_COLOR)
        .font('Helvetica-Bold')
        .text('BILL TO', 305, infoStartY);

      doc
        .fontSize(9)
        .fillColor(TEXT_COLOR)
        .font('Helvetica-Bold')
        .text(addr.name || 'Customer', 305, infoStartY + 18);

      let addrY = infoStartY + 32;
      doc.fontSize(8).fillColor(GRAY).font('Helvetica');

      if (addr.addressLine1) {
        doc.text(addr.addressLine1, 305, addrY, { width: 230 });
        addrY += 12;
      }
      if (addr.addressLine2) {
        doc.text(addr.addressLine2, 305, addrY, { width: 230 });
        addrY += 12;
      }

      const cityLine = [addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
      if (cityLine) {
        doc.text(cityLine, 305, addrY, { width: 230 });
        addrY += 12;
      }

      if (addr.phone) {
        doc.text(`Phone: ${addr.phone}`, 305, addrY);
      }

      yPos += 110;

      // =============== ORDER DETAILS BAR ===============
      doc
        .roundedRect(40, yPos, 515, 30, 3)
        .fill(LIGHT_GRAY);

      const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      doc
        .fontSize(8)
        .fillColor(GRAY)
        .font('Helvetica-Bold')
        .text('ORDER DATE', 55, yPos + 6)
        .text('PAYMENT METHOD', 220, yPos + 6)
        .text('PAYMENT STATUS', 390, yPos + 6);

      doc
        .fontSize(9)
        .fillColor(TEXT_COLOR)
        .font('Helvetica')
        .text(orderDate, 55, yPos + 18)
        .text(order.paymentMethod || 'N/A', 220, yPos + 18)
        .text(order.paymentStatus || 'PENDING', 390, yPos + 18);

      yPos += 45;

      // =============== ITEMS TABLE ===============
      // Table header
      doc
        .roundedRect(40, yPos, 515, 28, 3)
        .fill(BRAND_COLOR);

      doc
        .fontSize(9)
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .text('ITEM DESCRIPTION', 50, yPos + 10)
        .text('SIZE', 310, yPos + 10, { width: 60, align: 'center' })
        .text('QTY', 380, yPos + 10, { width: 40, align: 'center' })
        .text('PRICE', 430, yPos + 10, { width: 55, align: 'right' })
        .text('TOTAL', 495, yPos + 10, { width: 55, align: 'right' });

      yPos += 28;

      // Table rows
      const items = order.items || [];
      doc.font('Helvetica').fontSize(8.5).fillColor(TEXT_COLOR);

      items.forEach((item, index) => {
        const rowHeight = 26;
        const bgColor = index % 2 === 0 ? '#ffffff' : LIGHT_GRAY;
        
        // Row background
        doc.rect(40, yPos, 515, rowHeight).fill(bgColor);

        const itemName = item.name || 'Product';
        const displayName = itemName.length > 35 ? itemName.substring(0, 35) + '...' : itemName;

        doc
          .fillColor(TEXT_COLOR)
          .text(displayName, 50, yPos + 8, { width: 250 })
          .text(item.size || '-', 310, yPos + 8, { width: 60, align: 'center' })
          .text((item.quantity || 1).toString(), 380, yPos + 8, { width: 40, align: 'center' })
          .text(`₹${(item.salePrice || 0).toFixed(2)}`, 430, yPos + 8, { width: 55, align: 'right' })
          .text(`₹${(item.lineTotal || 0).toFixed(2)}`, 495, yPos + 8, { width: 55, align: 'right' });

        yPos += rowHeight;
      });

      // Bottom border for table
      doc
        .moveTo(40, yPos)
        .lineTo(555, yPos)
        .strokeColor(BORDER_COLOR)
        .stroke();

      yPos += 15;

      // =============== TOTALS SECTION ===============
      const totalsX = 350;
      const totalsWidth = 205;

      // Subtotal
      doc
        .fontSize(9)
        .fillColor(GRAY)
        .font('Helvetica')
        .text('Subtotal:', totalsX, yPos, { width: 100, align: 'left' })
        .text(`₹${(order.itemsTotal || 0).toFixed(2)}`, totalsX + 110, yPos, { width: 95, align: 'right' });
      yPos += 16;

      // Discount (if any)
      if (order.discountTotal > 0) {
        doc
          .fillColor('#16a34a')
          .text('Discount:', totalsX, yPos, { width: 100, align: 'left' })
          .text(`-₹${order.discountTotal.toFixed(2)}`, totalsX + 110, yPos, { width: 95, align: 'right' });
        yPos += 16;
      }

      // Shipping
      doc
        .fillColor(GRAY)
        .text('Shipping:', totalsX, yPos, { width: 100, align: 'left' })
        .text(order.shippingFee > 0 ? `₹${order.shippingFee.toFixed(2)}` : 'FREE', totalsX + 110, yPos, { width: 95, align: 'right' });
      yPos += 20;

      // Grand total box
      doc
        .roundedRect(totalsX - 5, yPos - 3, totalsWidth, 32, 4)
        .fill(BRAND_COLOR);

      doc
        .fontSize(11)
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .text('GRAND TOTAL', totalsX, yPos + 5, { width: 100, align: 'left' })
        .fontSize(13)
        .text(`₹${(order.grandTotal || 0).toFixed(2)}`, totalsX + 110, yPos + 4, { width: 95, align: 'right' });

      yPos += 45;

      // =============== SAVINGS BADGE (if applicable) ===============
      if (order.totalSavings > 0) {
        doc
          .roundedRect(40, yPos, 515, 28, 4)
          .fill('#e8f5e9');

        doc
          .fontSize(10)
          .fillColor('#16a34a')
          .font('Helvetica-Bold')
          .text(`🎉 You saved ₹${order.totalSavings.toFixed(2)} on this order!`, 40, yPos + 9, {
            width: 515,
            align: 'center',
          });
        yPos += 38;
      }

      // =============== FOOTER ===============
      yPos += 10;

      // Thank you message
      doc
        .fontSize(10)
        .fillColor(TEXT_COLOR)
        .font('Helvetica-Bold')
        .text('Thank you for shopping with House of Intimacy!', 40, yPos, {
          width: 515,
          align: 'center',
        });

      yPos += 18;

      doc
        .fontSize(8)
        .fillColor(GRAY)
        .font('Helvetica')
        .text('For any queries or support, feel free to contact us at support@hoi.in or call +91 9876543210', 40, yPos, {
          width: 515,
          align: 'center',
        });

      // =============== PAGE NUMBER ===============
      const pageHeight = doc.page.height;
      doc
        .fontSize(7)
        .fillColor(GRAY)
        .text(
          `Page 1 of 1 | Invoice #${invoiceNumber}`,
          40,
          pageHeight - 30,
          { width: 515, align: 'center' }
        );

      // Finalize PDF
      doc.end();

      stream.on('finish', () => {
        console.log(`✅ Invoice generated: ${filename}`);
        resolve(`/invoices/${filename}`);
      });

      stream.on('error', (err) => {
        console.error('Invoice generation error:', err);
        reject(err);
      });
    } catch (err) {
      console.error('Invoice generation error:', err);
      reject(err);
    }
  });
};

/**
 * Generate invoice URL for an order
 * @param {Object} order - Order object
 * @returns {Promise<string>} - Public URL to invoice
 */
const getOrGenerateInvoice = async (order) => {
  try {
    const invoiceNumber = order.orderNumber || `INV${order._id.toString().slice(-8).toUpperCase()}`;
    const filename = `${invoiceNumber}.pdf`;
    const filepath = path.join(INVOICE_DIR, filename);

    // Check if invoice already exists
    if (fs.existsSync(filepath)) {
      return `/invoices/${filename}`;
    }

    // Generate new invoice
    return await generateInvoice(order);
  } catch (err) {
    console.error('getOrGenerateInvoice error:', err);
    throw err;
  }
};

module.exports = {
  generateInvoice,
  getOrGenerateInvoice,
  INVOICE_DIR,
};