// controllers/products/index.js
const Product = require("../../models/Product");

// simple slug generator
const slugify = (text = "") =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, "-");

// ✅ CREATE Product
exports.createProduct = async (req, res) => {
  try {
    if (req.userRole !== "admin") {
      return res
        .status(403)
        .json({ message: "Only admin can create products" });
    }

    let data = { ...req.body };

    // 👉 parse stringified JSON fields from FormData
    if (data.price) {
      try {
        data.price = JSON.parse(data.price);
      } catch (e) {
        return res.status(400).json({ message: "Invalid price format" });
      }
    }

    if (data.sizes) {
      try {
        data.sizes = JSON.parse(data.sizes);
      } catch (e) {
        data.sizes = [];
      }
    }

    if (data.tags) {
      try {
        data.tags = JSON.parse(data.tags);
      } catch (e) {
        data.tags = [];
      }
    }

    if (data.colors) {
      try {
        data.colors = JSON.parse(data.colors);
      } catch (e) {
        data.colors = [];
      }
    }

    if (data.seo) {
      try {
        data.seo = JSON.parse(data.seo);
      } catch (e) {
        data.seo = {};
      }
    }

    if (data.collections) {
      try {
        data.collections = JSON.parse(data.collections);
      } catch (e) {
        data.collections = [];
      }
    }

    // ⭐ NEW: features (array of strings)
    if (data.features) {
      try {
        data.features = JSON.parse(data.features);
      } catch (e) {
        data.features = [];
      }
    }

    // ⭐ NEW: shippingAndReturns (array of strings)
    if (data.shippingAndReturns) {
      try {
        data.shippingAndReturns = JSON.parse(data.shippingAndReturns);
      } catch (e) {
        data.shippingAndReturns = [];
      }
    }

    // 👉 handle images from multer
    if (req.files?.mainImage?.[0]) {
      data.mainImage = `/uploads/products/${req.files.mainImage[0].filename}`;
    }

    if (req.files?.galleryImages?.length) {
      data.galleryImages = req.files.galleryImages.map(
        (f) => `/uploads/products/${f.filename}`
      );
    }

    // validations
    if (!data.productCode) {
  return res.status(400).json({ message: "Product code is required" });
}
    if (!data.name) {
      return res.status(400).json({ message: "Product name is required" });
    }

    if (!data.price || typeof data.price !== "object") {
      return res.status(400).json({ message: "Price data is required" });
    }

    // 👉 normalize price numbers
    data.productCode = data.productCode.trim().toUpperCase();
    data.price.mrp = Number(data.price.mrp) || 0;
    data.price.discountPercent = Number(data.price.discountPercent) || 0;
    data.price.sale = Number(data.price.sale) || 0;

    // 👉 boolean / misc
    if (data.isFeatured !== undefined) {
      data.isFeatured =
        data.isFeatured === "true" ||
        data.isFeatured === true ||
        data.isFeatured === "on";
    }

    // totalStock safe cast
    if (
      data.totalStock !== undefined &&
      data.totalStock !== null &&
      data.totalStock !== ""
    ) {
      const parsed = Number(data.totalStock);
      data.totalStock = Number.isNaN(parsed) ? undefined : parsed;
    }

    // sizes stock to number
    if (Array.isArray(data.sizes)) {
      data.sizes = data.sizes.map((s) => ({
        label: s.label,
        stock: Number(s.stock) || 0,
      }));
    }

    // auto totalStock from sizes if not set
    if (
      (data.totalStock === undefined ||
        data.totalStock === null ||
        Number.isNaN(data.totalStock)) &&
      Array.isArray(data.sizes)
    ) {
      data.totalStock = data.sizes.reduce(
        (sum, s) => sum + (Number(s.stock) || 0),
        0
      );
    }

    // slug auto-generate if missing
    if (!data.slug) {
      data.slug = slugify(data.name);
    }

    const product = await Product.create(data);
    return res.status(201).json({
      message: "Product created successfully",
      product,
    });
  } catch (err) {
    console.error("Create Product Error:", err);
    return res.status(500).json({
      message: "Failed to create product",
      error: err.message,
    });
  }
};

// ✅ GET ALL Products (with filters + pagination)
exports.getProducts = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      search,
      category,
      status,
      isFeatured,
      brand,
      gender,
      size, // 👈 NEW: size filter from query (?size=M,L,XL)
    } = req.query;

    page = Number(page);
    limit = Number(limit);

    const filter = {};

    // 🔎 Search by name
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    // 🏷️ Category (single or multiple: ?category=Bra,Nightwear)
    if (category) {
      const categories = category
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      if (categories.length === 1) {
        filter.category = categories[0];
      } else if (categories.length > 1) {
        filter.category = { $in: categories };
      }
    }

    // 📌 Status
    if (status) {
      filter.status = status;
    }

    // 🚻 Gender (case-insensitive exact)
    if (gender) {
      filter.gender = { $regex: `^${gender}$`, $options: "i" };
    }

    // 🎨 Color filter (colors: [{ label, hex }])
    if (req.query.color) {
      filter.colors = { $elemMatch: { label: req.query.color } };
    }

    // ⭐ Featured
    if (typeof isFeatured !== "undefined") {
      filter.isFeatured = isFeatured === "true";
    }

    // 🧵 BRAND FILTER (single or multiple: ?brand=Jockey,Amanté)
    if (brand) {
      const brands = brand
        .split(",")
        .map((b) => b.trim())
        .filter(Boolean);

      if (brands.length === 1) {
        // case-insensitive exact match (single)
        filter.brand = { $regex: `^${brands[0]}$`, $options: "i" };
      } else if (brands.length > 1) {
        // multiple brands (case-insensitive OR)
        filter.$or = (filter.$or || []).concat(
          brands.map((b) => ({
            brand: { $regex: `^${b}$`, $options: "i" },
          }))
        );
      }
    }

    // 📏 SIZE FILTER (sizes: [{ label, stock }])
    // ?size=M,L,XL -> matches any product where sizes.label IN [M,L,XL]
    if (size) {
      const sizes = size
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (sizes.length > 0) {
        filter.sizes = {
          $elemMatch: {
            label: { $in: sizes },
          },
        };
      }
    }

    // DB query + pagination
    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    return res.json({
      data: products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Get Products Error:", err);
    return res.status(500).json({
      message: "Failed to get products",
      error: err.message,
    });
  }
};

// ✅ GET Single Product (by ID)
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    return res.json(product);
  } catch (err) {
    console.error("Get Product By ID Error:", err);
    return res.status(500).json({
      message: "Failed to get product",
      error: err.message,
    });
  }
};

// ✅ GET Single Product (by slug)
exports.getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const product = await Product.findOne({ slug });
    if (!product) return res.status(404).json({ message: "Product not found" });

    return res.json(product);
  } catch (err) {
    console.error("Get Product By Slug Error:", err);
    return res.status(500).json({
      message: "Failed to get product",
      error: err.message,
    });
  }
};

// ✅ UPDATE Product
exports.updateProduct = async (req, res) => {
  try {
    if (req.userRole !== "admin") {
      return res
        .status(403)
        .json({ message: "Only admin can update products" });
    }

    const { id } = req.params;
    let data = { ...req.body };

    // parse JSON fields if they are sent from FormData
    if (data.price) {
      try {
        data.price = JSON.parse(data.price);
      } catch (e) {
        // ignore – let mongoose throw if invalid
      }
    }

    if (data.sizes) {
      try {
        data.sizes = JSON.parse(data.sizes);
      } catch (e) {}
    }

    if (data.tags) {
      try {
        data.tags = JSON.parse(data.tags);
      } catch (e) {}
    }

    if (data.colors) {
      try {
        data.colors = JSON.parse(data.colors);
      } catch (e) {}
    }

    if (data.seo) {
      try {
        data.seo = JSON.parse(data.seo);
      } catch (e) {}
    }

    if (data.collections) {
      try {
        data.collections = JSON.parse(data.collections);
      } catch (e) {}
    }

    // ⭐ NEW: features
    if (data.features) {
      try {
        data.features = JSON.parse(data.features);
      } catch (e) {}
    }

    // ⭐ NEW: shippingAndReturns
    if (data.shippingAndReturns) {
      try {
        data.shippingAndReturns = JSON.parse(data.shippingAndReturns);
      } catch (e) {}
    }
    //product name
if (data.productCode) {
  data.productCode = data.productCode.trim().toUpperCase();
}
    // image update
    if (req.files?.mainImage?.[0]) {
      data.mainImage = `/uploads/products/${req.files.mainImage[0].filename}`;
    }

    if (req.files?.galleryImages?.length) {
      data.galleryImages = req.files.galleryImages.map(
        (f) => `/uploads/products/${f.filename}`
      );
    }

    // normalize numbers
    if (data.price) {
      data.price.mrp = Number(data.price.mrp) || 0;
      data.price.discountPercent = Number(data.price.discountPercent) || 0;
      data.price.sale = Number(data.price.sale) || 0;
    }

    if (data.isFeatured !== undefined) {
      data.isFeatured =
        data.isFeatured === "true" ||
        data.isFeatured === true ||
        data.isFeatured === "on";
    }

    // totalStock safe cast
    if (
      data.totalStock !== undefined &&
      data.totalStock !== null &&
      data.totalStock !== ""
    ) {
      const parsed = Number(data.totalStock);
      data.totalStock = Number.isNaN(parsed) ? undefined : parsed;
    }

    // sizes stock number
    if (Array.isArray(data.sizes)) {
      data.sizes = data.sizes.map((s) => ({
        label: s.label,
        stock: Number(s.stock) || 0,
      }));
    }

    if (
      (data.totalStock === undefined ||
        data.totalStock === null ||
        Number.isNaN(data.totalStock)) &&
      Array.isArray(data.sizes)
    ) {
      data.totalStock = data.sizes.reduce(
        (sum, s) => sum + (Number(s.stock) || 0),
        0
      );
    }

    const product = await Product.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.json({
      message: "Product updated successfully",
      product,
    });
  } catch (err) {
    console.error("Update Product Error:", err);
    return res.status(500).json({
      message: "Failed to update product",
      error: err.message,
    });
  }
};

// ✅ DELETE Product
exports.deleteProduct = async (req, res) => {
  try {
    if (req.userRole !== "admin") {
      return res
        .status(403)
        .json({ message: "Only admin can delete products" });
    }

    const { id } = req.params;

    const product = await Product.findByIdAndDelete(id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    return res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error("Delete Product Error:", err);
    return res.status(500).json({
      message: "Failed to delete product",
      error: err.message,
    });
  }
};

// ✅ GET Products by Brand (clean endpoint)
exports.getProductsByBrand = async (req, res) => {
  try {
    const { brand } = req.params;

    if (!brand) {
      return res.status(400).json({ message: "Brand is required" });
    }

    // Case-insensitive exact match
    const filter = {
      brand: { $regex: `^${brand}$`, $options: "i" },
    };

    console.log("GetProductsByBrand filter:", filter); // 👀 debug

    const products = await Product.find(filter).sort({ createdAt: -1 });

    return res.json({
      data: products,
      count: products.length,
    });
  } catch (err) {
    console.error("Get Products By Brand Error:", err);
    return res.status(500).json({
      message: "Failed to get products by brand",
      error: err.message,
    });
  }
};
