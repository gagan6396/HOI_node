const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  getCart,
  syncCart,
  saveCart,
  clearCart,
} = require("../controllers/cart/cartController");

router.get("/",        auth, getCart);   // DB se cart lao
router.put("/",        auth, saveCart);  // Poora cart save karo
router.post("/sync",   auth, syncCart);  // Guest + DB merge
router.delete("/",     auth, clearCart); // Cart clear karo

module.exports = router;