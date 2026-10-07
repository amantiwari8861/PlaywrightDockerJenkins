import express from "express";
import userRouter from "./routes/user.route.js";
import loggingMiddleware from "./middlewares/logging.middleware.js";
import authRouter from "./routes/auth.route.js";
import connectMongoDB from "./config/mongoose.config.js";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import cors from "cors";
import corsOptions from "./config/cors.config.js";
import productRouter from "./routes/product.route.js";
import {
  errorHandler,
  notFoundHandler,
} from "./middlewares/error.middleware.js";
import { PORT, HOSTNAME } from "./config/env.config.js";

const app = express();
app.use(loggingMiddleware);
app.use(morgan("dev"));
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
  res.send("Server is Up and Running!");
});
app.use("/api/v1/user", userRouter);
app.use("/api/v1/products", productRouter);
app.use("/api/v1/auth", authRouter);

// Static mounts come last so they never shadow the API routes above.
app.use("/uploads", express.static("uploads"));
app.use(express.static("public"));

app.use(notFoundHandler);
app.use(errorHandler);

try {
  // Fail fast rather than serving requests with no database behind them.
  await connectMongoDB();

  app.listen(PORT, HOSTNAME, () => {
    console.log(`listening on http://${HOSTNAME}:${PORT}`);
  });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}