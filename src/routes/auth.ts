import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { auth } from "../middleware/auth";
import { AuthRequest } from "../types/auth";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET!;

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  password: z.string().min(8)
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1)
});

function setToken(res: any, id: number, role: "USER" | "ADMIN") {
  const token = jwt.sign({ id, role }, JWT_SECRET, { expiresIn: "7d" });

  res.cookie("accessToken", token, {
    httpOnly: true,
    sameSite: "none",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

router.post("/register", async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: data.email } });

    if (exists) return res.status(409).json({ message: "Email already exists" });

    const password = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, password }
    });

    await prisma.cart.create({ data: { userId: user.id } });
    setToken(res, user.id, user.role);

    res.status(201).json({
      data: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email } });

    if (!user || !(await bcrypt.compare(data.password, user.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    setToken(res, user.id, user.role);

    res.json({
      data: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie("accessToken");
  res.json({ message: "Logged out" });
});

router.get("/me", auth(), async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });

    res.json({ data: user });
  } catch (error) {
    next(error);
  }
});

export default router;
