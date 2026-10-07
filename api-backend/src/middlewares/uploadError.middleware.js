const MULTER_ERROR_STATUS = {
  LIMIT_FILE_SIZE: 413,
  LIMIT_FILE_COUNT: 413,
  LIMIT_UNEXPECTED_FILE: 400,
};

const uploadErrorHandler = (err, req, res, next) => {
  if (!err || !err.name?.startsWith("Multer")) {
    return next(err);
  }

  const status = MULTER_ERROR_STATUS[err.code] ?? 400;

  return res.status(status).json({
    success: false,
    message: err.message,
    code: err.code,
  });
};

export default uploadErrorHandler;