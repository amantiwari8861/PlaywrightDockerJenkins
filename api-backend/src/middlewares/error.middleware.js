const STATUS_BY_CODE = {
  11000: 409, // duplicate key
};

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  // Malformed JSON body (body-parser)
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON in request body.",
    });
  }

  // Invalid ObjectId in a route param
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: `Invalid value for '${err.path}'.`,
    });
  }

  // Schema validation failed
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation failed.",
      errors: Object.values(err.errors).map((e) => e.message),
    });
  }

  if (STATUS_BY_CODE[err.code]) {
    return res.status(STATUS_BY_CODE[err.code]).json({
      success: false,
      message: "Duplicate value.",
    });
  }

  console.error("Unhandled error:", err);
  return res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
};

const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

export { errorHandler, notFoundHandler };