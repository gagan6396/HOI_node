// routes/paymentRoutes.js
const express = require("express");
const {
  createOrder,
  handleHdfcResponse,
} = require("../controllers/paymentController");
const auth = require("../middleware/auth");


const router = express.Router();

// Called by frontend checkout page to get encrypted payload
router.post("/create-order", auth,createOrder);


// Called by HDFC after payment (success / failure / cancel)
// express.urlencoded needed because HDFC POSTs form-encoded data
router.post("/hdfc-response", express.urlencoded({ extended: true }), handleHdfcResponse);

module.exports = router;