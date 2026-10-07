import Product from "../model/product.model.js";
import { BASE_URL } from "../config/env.config.js";

/** Turns a Mongoose ValidationError into a field -> messages map. */
const validationErrors = (error) =>
  Object.fromEntries(Object.entries(error.errors).map(([path, e]) => [path, e.message]));

const isValidationError = (error) =>
  error.name === "ValidationError" && error.errors;

export const createProduct = async (req, res) => {
  try {
    const { title, price, description, category, rating } = req.body;

    // Multer gives multiple uploaded files in req.files.
    // Normalise to posix separators so paths become "uploads/<file>" on all OSes.
    const imagePaths =
      req.files?.map((file) =>
        file.path.replace(/\\/g, "/").replace(/^\.?\//, ""),
      ) || [];

    const product = await Product.create({
      title,
      price,
      description,
      category,
      image: imagePaths,
      rating: {
        rate: rating?.rate || 0,
        count: rating?.count || 0,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    if (isValidationError(error)) {
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationErrors(error),
      });
    }

    console.error("Create Product Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create product",
      error: error.message,
    });
  }
};

export const saveMultipleProducts = async (req, res) => {
  try {
    const payload = Array.isArray(req.body) ? req.body : [req.body];

    if (payload.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one product is required.",
      });
    }

    const products = await Product.insertMany(payload);

    return res.status(201).json({
      success: true,
      message: "Products saved successfully",
      data: products,
    });
  } catch (error) {
    if (isValidationError(error)) {
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationErrors(error),
      });
    }

    console.error("Create Products Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create products",
      error: error.message,
    });
  }
};

export const getAllProducts = async (req, res) => {
  try {
    let products = await Product.find();
    products = products.map((p) => {
      p.image = p.image?.map((i) => {
        // Legacy records may store Windows separators ("uploads\a.png").
        const normalized = i.replace(/\\/g, "/");
        if (normalized.startsWith("uploads/")) {
          return `${BASE_URL}/${normalized}`;
        }
        return i;
      });
      return p;
    });
    return res.status(200).json({
      success: true,
      message: "Products feched successfully",
      data: products,
    });
  } catch (error) {
    console.error("fetch Products Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error: error.message,
    });
  }
};