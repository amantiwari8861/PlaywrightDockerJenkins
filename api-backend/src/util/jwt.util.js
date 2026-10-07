import jwt from "jsonwebtoken";

const generateToken = (payload) => {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET not defined in environment");
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
};

const verifyToken = (token) => {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET not defined in environment");
  }
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.log("Token verification failed:", error.message);
    return null;
  }
};

export { generateToken, verifyToken };