// src/middleware/attachUser.js
// Attaches req.user from a JWT in Authorization: Bearer <token> or cookie ('authToken' first, then legacy)

import cookieParser from "cookie-parser";
import { verifyJwt } from "../modules/auth/helpers.js"; // verifyJwt throws on invalid/expired

export function withCookieParser() {
  // convenience to mount cookie parser
  return cookieParser();
}

export function attachUser() {
  return (req, _res, next) => {
    try {
      // 1) Bearer header
      const auth = req.headers.authorization || "";
      let token = null;
      if (auth.startsWith("Bearer ")) token = auth.slice(7).trim(); // CHANGED: trim to be safe

      // 2) Cookie fallbacks (frontend writes 'authToken')
      if (!token && req.cookies) {
        token =
          req.cookies.authToken ||   // ADDED: primary cookie name used by FE
          req.cookies.sbf_token ||   // legacy
          req.cookies.token ||       // legacy
          null;
      }

      if (!token) return next(); // anonymous request

      const payload = verifyJwt(token); // throws if invalid
      req.user = {
        id: payload.id,
        email: payload.email,
        username: payload.username,
        isAdmin: payload.isAdmin,
      };
    } catch {
      // invalid/expired token -> treat as anonymous; don't block public routes
      req.user = undefined;
    }
    next();
  };
}
export default attachUser;