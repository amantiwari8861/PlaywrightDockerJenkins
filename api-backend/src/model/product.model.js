import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    image: [String],
    rating: {
      rate: Number,
      count: Number,
    },
  },
  { timestamps: true },
);

const Product = mongoose.model("products", productSchema);
export default Product;
