import { verifyToken } from "../util/jwt.util.js";

function authMiddleware(req, res, next) {
  let accessToken = req.cookies?.accessToken;

  if (!accessToken) {
    const authorization = req.headers.authorization;

    if (!authorization) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) { // Bearer frbjdjdfbjdfnkdfkjf
      return res.status(401).json({
        success: false,
        message: "Invalid Authorization header format",
      });
    }

    accessToken = token;
  }

  const decodedToken = verifyToken(accessToken);

  if (!decodedToken) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }

  req.user = decodedToken;

  next();
}

export default authMiddleware;