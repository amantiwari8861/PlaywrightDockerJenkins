const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://www.iamandroid.in",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:5000",
  "http://localhost:5000",
  "http://127.0.0.1:5001",
  "http://localhost:5001",
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests without Origin
    // e.g. Postman, server-to-server requests, API test clients
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Reject without throwing: passing an Error makes cors surface a 500,
    // which is misleading for what is really a blocked origin.
    return callback(null, false);
  },
  credentials: true,
};

export { corsOptions, allowedOrigins };
export default corsOptions;