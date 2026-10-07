import { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { AuthRequest } from "../types/auth";

const JWT_SECRET = process.env.JWT_SECRET!;

type JwtPayload = {
  id: number;
  role: "USER" | "ADMIN";
};

export function auth(requiredRole?: "USER" | "ADMIN") {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.cookies?.accessToken;

    if (!token) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;

      if (requiredRole && payload.role !== requiredRole) {
        return res.status(403).json({
          message: "Forbidden",
        });
      }

      req.user = {
        id: payload.id,
        role: payload.role,
      };

      next();
    } catch {
      return res.status(401).json({
        message: "Invalid or expired token",
      });
    }
  };
}

export function optionalAuth() {
  return (
    req: AuthRequest,
    _res: Response,
    next: NextFunction
  ) => {
    const token = req.cookies?.accessToken;

    if (!token) {
      return next();
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;

      req.user = {
        id: payload.id,
        role: payload.role,
      };
    } catch {
      // Невалідний токен не блокує гостя
    }

    next();
  };
}