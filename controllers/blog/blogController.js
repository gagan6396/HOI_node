// controllers/blog/blogController.js
const Blog = require("../../models/Blog");

// simple slugify helper
const slugify = (text = "") => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, "-") // spaces + non-word -> '-'
    .replace(/^-+|-+$/g, "");
};

// ensure unique slug
const generateUniqueSlug = async (baseSlug) => {
  let slug = baseSlug;
  let counter = 1;

  while (await Blog.exists({ slug })) {
    slug = `${baseSlug}-${counter++}`;
  }

  return slug;
};

// 🔹 CREATE BLOG
exports.createBlog = async (req, res) => {
  try {
    const {
      mainHeading,
      slug,
      introParagraph,
      heading2,
      body2,
      heading3,
      body3,
      heading4,
      body4,
      heading5,
      body5,
      conclusion,
      seoTitle,
      seoDescription,
      metaTitle,
      metaDescription,
      keywords,
      schemaMarkup,
      status,
    } = req.body;

    if (!mainHeading || !introParagraph || !conclusion) {
      return res.status(400).json({
        message: "mainHeading, introParagraph and conclusion are required.",
      });
    }

    // slug handle
    let finalSlug =
      slug && slug.trim() !== "" ? slugify(slug) : slugify(mainHeading);
    finalSlug = await generateUniqueSlug(finalSlug);

    // IMAGE PATHS FROM MULTER
    let featureImagePath = "";
    let galleryImagePaths = [];

    if (req.files && req.files.featureImage && req.files.featureImage[0]) {
      featureImagePath = `/uploads/blogs/${req.files.featureImage[0].filename}`;
    }

    if (req.files && req.files.galleryImages && req.files.galleryImages.length > 0) {
      galleryImagePaths = req.files.galleryImages.map(
        (file) => `/uploads/blogs/${file.filename}`
      );
    }

    const blog = await Blog.create({
      mainHeading,
      slug: finalSlug,
      introParagraph,
      heading2,
      body2,
      heading3,
      body3,
      heading4,
      body4,
      heading5,
      body5,
      conclusion,
      seoTitle,
      seoDescription,
      metaTitle,
      metaDescription,
      keywords,
      schemaMarkup,
      featureImage: featureImagePath,
      galleryImages: galleryImagePaths,
      status: status || "published",
    });

    res.status(201).json({
      message: "Blog created successfully",
      blog,
    });
  } catch (error) {
    console.error("Create blog error:", error);
    res.status(500).json({
      message: "Failed to create blog",
      error: error.message,
    });
  }
};

// 🔹 GET ALL BLOGS (with pagination & search)
exports.getBlogs = async (req, res) => {
  try {
    let { page = 1, limit = 10, q = "" } = req.query;
    page = parseInt(page, 10) || 1;
    limit = parseInt(limit, 10) || 10;

    const filter = {};

    if (q) {
      filter.$or = [
        { mainHeading: { $regex: q, $options: "i" } },
        { introParagraph: { $regex: q, $options: "i" } },
      ];
    }

    const total = await Blog.countDocuments(filter);
    const blogs = await Blog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const pages = Math.ceil(total / limit);

    res.json({
      blogs,
      total,
      page,
      pages,
      pagination: {
        total,
        page,
        limit,
        totalPages: pages,
      },
    });
  } catch (error) {
    console.error("Get blogs error:", error);
    res.status(500).json({
      message: "Failed to fetch blogs",
      error: error.message,
    });
  }
};

// 🔹 GET BLOG BY ID
exports.getBlogById = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id).lean();

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    res.json(blog);
  } catch (error) {
    console.error("Get blog by id error:", error);
    res.status(500).json({
      message: "Failed to fetch blog",
      error: error.message,
    });
  }
};

// 🔹 GET BLOG BY SLUG
exports.getBlogBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const blog = await Blog.findOne({ slug }).lean();

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    res.json(blog);
  } catch (error) {
    console.error("Get blog by slug error:", error);
    res.status(500).json({
      message: "Failed to fetch blog",
      error: error.message,
    });
  }
};

// 🔹 UPDATE BLOG
exports.updateBlog = async (req, res) => {
  try {
    const blogId = req.params.id;
    const blog = await Blog.findById(blogId);

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    const {
      mainHeading,
      slug,
      introParagraph,
      heading2,
      body2,
      heading3,
      body3,
      heading4,
      body4,
      heading5,
      body5,
      conclusion,
      seoTitle,
      seoDescription,
      metaTitle,
      metaDescription,
      keywords,
      schemaMarkup,
      status,
    } = req.body;

    if (mainHeading !== undefined) blog.mainHeading = mainHeading;
    if (introParagraph !== undefined) blog.introParagraph = introParagraph;
    if (heading2 !== undefined) blog.heading2 = heading2;
    if (body2 !== undefined) blog.body2 = body2;
    if (heading3 !== undefined) blog.heading3 = heading3;
    if (body3 !== undefined) blog.body3 = body3;
    if (heading4 !== undefined) blog.heading4 = heading4;
    if (body4 !== undefined) blog.body4 = body4;
    if (heading5 !== undefined) blog.heading5 = heading5;
    if (body5 !== undefined) blog.body5 = body5;
    if (conclusion !== undefined) blog.conclusion = conclusion;

    if (seoTitle !== undefined) blog.seoTitle = seoTitle;
    if (seoDescription !== undefined) blog.seoDescription = seoDescription;
    if (metaTitle !== undefined) blog.metaTitle = metaTitle;
    if (metaDescription !== undefined) blog.metaDescription = metaDescription;
    if (keywords !== undefined) blog.keywords = keywords;
    if (schemaMarkup !== undefined) blog.schemaMarkup = schemaMarkup;
    if (status !== undefined) blog.status = status;

    // slug update (optional)
    if (slug !== undefined && slug.trim() !== "") {
      let newSlug = slugify(slug);
      if (newSlug !== blog.slug) {
        newSlug = await generateUniqueSlug(newSlug);
        blog.slug = newSlug;
      }
    } else if (mainHeading !== undefined && (!blog.slug || blog.slug === "")) {
      let generated = slugify(mainHeading);
      generated = await generateUniqueSlug(generated);
      blog.slug = generated;
    }

    // NEW IMAGES (if uploaded)
    if (req.files && req.files.featureImage && req.files.featureImage[0]) {
      blog.featureImage = `/uploads/blogs/${req.files.featureImage[0].filename}`;
      // optional: delete old file here
    }

    if (req.files && req.files.galleryImages && req.files.galleryImages.length > 0) {
      blog.galleryImages = req.files.galleryImages.map(
        (f) => `/uploads/blogs/${f.filename}`
      );
    }

    await blog.save();

    res.json({
      message: "Blog updated successfully",
      blog,
    });
  } catch (error) {
    console.error("Update blog error:", error);
    res.status(500).json({
      message: "Failed to update blog",
      error: error.message,
    });
  }
};

// 🔹 DELETE BLOG
exports.deleteBlog = async (req, res) => {
  try {
    const blogId = req.params.id;
    const blog = await Blog.findByIdAndDelete(blogId);

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    // optional: delete image files from disk here

    res.json({
      message: "Blog deleted successfully",
    });
  } catch (error) {
    console.error("Delete blog error:", error);
    res.status(500).json({
      message: "Failed to delete blog",
      error: error.message,
    });
  }
};
