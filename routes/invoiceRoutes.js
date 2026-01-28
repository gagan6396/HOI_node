// routes/invoiceRoutes.js
const express = require('express');
const router = express.Router();
const Orders = require('../models/Order');
const Users = require('../models/User');
const { getOrGenerateInvoice } = require('../utils/generateInvoice');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /v1/invoice/:orderId
 * Generate and download invoice for an order
 */
router.get('/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;

    // Fetch order
    const order = await Orders.findById(orderId).populate('user', 'name email phone');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Authorization: user can only download their own invoice (unless admin)
    if (req.userRole !== 'admin' && order.user._id.toString() !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Only generate invoice for confirmed orders
    const allowedStatuses = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    if (!allowedStatuses.includes(order.status)) {
      return res.status(400).json({
        message: 'Invoice is only available for confirmed orders',
        status: order.status,
      });
    }

    // Generate or get existing invoice
    const invoicePath = await getOrGenerateInvoice(order);

    // Return invoice URL
    return res.json({
      success: true,
      invoiceUrl: invoicePath,
      orderNumber: order.orderNumber,
    });
  } catch (err) {
    console.error('Invoice generation error:', err);
    return res.status(500).json({
      message: 'Failed to generate invoice',
      error: err.message,
    });
  }
});

/**
 * GET /v1/invoice/:orderId/download
 * Direct download invoice PDF
 */
router.get('/:orderId/download', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;

    const order = await Orders.findById(orderId).populate('user', 'name email phone');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (req.userRole !== 'admin' && order.user._id.toString() !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const allowedStatuses = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    if (!allowedStatuses.includes(order.status)) {
      return res.status(400).json({
        message: 'Invoice is only available for confirmed orders',
      });
    }

    const invoicePath = await getOrGenerateInvoice(order);
    const fullPath = require('path').join(__dirname, '..', invoicePath);

    // Set headers for download
    const invoiceNumber = order.orderNumber || `INV${order._id.toString().slice(-8).toUpperCase()}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoiceNumber}.pdf"`);

    // Stream file
    const fs = require('fs');
    const fileStream = fs.createReadStream(fullPath);
    fileStream.pipe(res);
  } catch (err) {
    console.error('Invoice download error:', err);
    return res.status(500).json({
      message: 'Failed to download invoice',
    });
  }
});

module.exports = router;