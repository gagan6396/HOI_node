// routes/blogRoutes.js
const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const adminOnly = require("../middleware/adminOnly");

const uploadBlogImages = require("../middleware/blogUpload");
const {
  createBlog,
  getBlogs,
  getBlogById,
  getBlogBySlug,
  updateBlog,
  deleteBlog,
} = require("../controllers/blog/blogController");

// FINAL ROUTES (with /v1 prefix in main app):
// GET    /v1/myblogs/allblogs         → list (public, paginated)
// GET    /v1/myblogs/slug/:slug       → single blog by slug (public)
// POST   /v1/myblogs/blog             → create (admin)
// GET    /v1/myblogs/:id              → get by id (admin)
// PUT    /v1/myblogs/:id              → update (admin)
// DELETE /v1/myblogs/:id              → delete (admin)

// =====================
// PUBLIC ROUTES
// =====================

router.get("/allblogs", getBlogs);
router.get("/slug/:slug", getBlogBySlug);

// =====================
// ADMIN ROUTES
// =====================

router.post(
  "/blog",
  auth,
  adminOnly,
  uploadBlogImages,
  createBlog
);

router.get("/:id", auth, adminOnly, getBlogById);

router.put(
  "/:id",
  auth,
  adminOnly,
  uploadBlogImages,
  updateBlog
);

router.delete("/:id", auth, adminOnly, deleteBlog);

module.exports = router;
