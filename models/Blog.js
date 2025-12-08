// models/Blog.js
const mongoose = require("mongoose");

const BlogSchema = new mongoose.Schema(
  {
    // BASIC
    mainHeading: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    introParagraph: {
      type: String, // HTML from CKEditor
      required: true,
    },

    // SECTIONS H2–H5
    heading2: { type: String, default: "" },
    body2: { type: String, default: "" },
    heading3: { type: String, default: "" },
    body3: { type: String, default: "" },
    heading4: { type: String, default: "" },
    body4: { type: String, default: "" },
    heading5: { type: String, default: "" },
    body5: { type: String, default: "" },

    // CONCLUSION
    conclusion: {
      type: String, // HTML
      required: true,
    },

    // SEO FIELDS
    seoTitle: { type: String, default: "" },
    seoDescription: { type: String, default: "" },
    metaTitle: { type: String, default: "" },
    metaDescription: { type: String, default: "" },
    keywords: { type: String, default: "" }, // comma separated
    schemaMarkup: { type: String, default: "" }, // JSON-LD as string

    // IMAGES
    featureImage: {
      type: String, // "/uploads/blogs/feature-123.png"
      default: "",
    },
    galleryImages: [
      {
        type: String, // "/uploads/blogs/gallery-abc.png"
      },
    ],

    // STATUS
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "published",
    },
    // createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Blog", BlogSchema);
