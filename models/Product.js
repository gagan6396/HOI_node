// models/Product.js
const mongoose = require("mongoose");

const sizeSchema = new mongoose.Schema(
  {
    label: { type: String, required: true }, // XS, S, M, etc.
    stock: { type: Number, default: 0 },
  },
  { _id: false }
);

const priceSchema = new mongoose.Schema(
  {
    mrp: { type: Number, required: true },
    discountPercent: { type: Number, default: 0 },
    sale: { type: Number, required: true },
  },
  { _id: false }
);

const seoSchema = new mongoose.Schema(
  {
    metaTitle: { type: String, default: "" },
    metaDescription: { type: String, default: "" },
    keywords: [{ type: String }],
    schemaMarkup: { type: String, default: "" },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    // BASIC INFO
    
productCode: {
  type: String,
  required: true,
  unique: true,
  trim: true,
},
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, sparse: true, trim: true },
   brand: { type: String, required: true },

    gender: {
      type: String,
      enum: ["women", "men", "unisex"],
      default: "women",
    },
    category: { type: String, trim: true },
    subcategory: { type: String, trim: true },
    similarColor: {
  type: String,
  enum: [
    "black",
    "grey",
    "navy",
    "blue",
    "teal",
    "green",
    "orange",
    "red",
    "pink",
    "yellow",
  ],
  lowercase: true,
  trim: true,
},

    sku: { type: String, trim: true },
    taxSlab: { type: String, trim: true },

    // IMAGES / MEDIA
    mainImage: { type: String, default: "" }, // image URL
    galleryImages: [{ type: String }], // URLs
    sizeGuideUrl: { type: String, default: "" },
    videoUrl: { type: String, default: "" },

    // COLORS & SIZES
    colors: [{ type: String }],
    sizes: [sizeSchema],

    // PRICING & INVENTORY
    price: priceSchema,
    totalStock: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "draft", "out-of-stock", "archived"],
      default: "active",
    },
    isFeatured: { type: Boolean, default: false },

    // PRODUCT TYPE (for homepage sections)
type: {
  type: String,
  enum: ["regular", "new-arrival", "trendy", "sale"],
  default: "regular",
},


    // FABRIC & ATTRIBUTES
    fabric: { type: String, trim: true },
    composition: { type: String, trim: true },
    coverage: { type: String, trim: true },
    padding: { type: String, trim: true },
    underwire: { type: String, trim: true },
    strapType: { type: String, trim: true },
    closureType: { type: String, trim: true },
    pattern: { type: String, trim: true },
    occasion: { type: String, trim: true },
    careInstructions: { type: String, trim: true },

    // DESCRIPTIONS
    shortDescription: { type: String, trim: true },
    description: { type: String, trim: true },
    features: {
      type: [String],
      default: [],
    },

    shippingAndReturns: {
      type: [String],
      default: [],
    },

    // TAGS & COLLECTIONS
    tags: [{ type: String }],
    collections: [{ type: String }],

    // SEO
    seo: seoSchema,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
