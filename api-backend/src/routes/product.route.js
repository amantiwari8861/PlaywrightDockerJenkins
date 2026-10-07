import express from "express";
import {
  createProduct,
  getAllProducts,
  saveMultipleProducts,
} from "../controller/product.controller.js";
import upload from "../config/multer.config.js";
import uploadErrorHandler from "../middlewares/uploadError.middleware.js";

const productRouter = express.Router();

productRouter.post("/", upload.array("images"), createProduct); // http://localhost:5000/api/v1/products
productRouter.post("/save-all", saveMultipleProducts); // http://localhost:5000/api/v1/products/save-all
productRouter.get("/", getAllProducts); // http://localhost:5000/api/v1/products

// Multer errors (file too large, bad mime type, too many files) are thrown
// before the controller runs, so translate them into JSON responses here.
productRouter.use(uploadErrorHandler);

export default productRouter;