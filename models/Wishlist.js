const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const WishlistSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: true,
      unique: true,
    },
    products: [
      {
        type: Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Wishlist", WishlistSchema);
