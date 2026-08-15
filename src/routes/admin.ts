import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { auth } from "../middleware/auth";

const router = Router();
router.use(auth("ADMIN"));

const productSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().min(2),
  price: z.number().int().positive(),
  oldPrice: z.number().int().positive().optional(),
  stock: z.number().int().min(0),
  images: z.array(z.string()).default([]),
  specs: z.any().optional(),
  categoryId: z.number().int().positive()
});

router.get("/stats", async (_req, res, next) => {
  try {
    const [products, users, orders, revenue] = await Promise.all([
      prisma.product.count(),
      prisma.user.count(),
      prisma.order.count(),
      prisma.order.aggregate({
        where: { status: { not: "CANCELLED" } },
        _sum: { total: true }
      })
    ]);

    res.json({
      data: {
        products,
        users,
        orders,
        revenue: revenue._sum.total ?? 0
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post("/products", async (req, res, next) => {
  try {
    const data = productSchema.parse(req.body);
    const product = await prisma.product.create({ data });
    res.status(201).json({ data: product });
  } catch (error) {
    next(error);
  }
});

router.patch("/products/:id", async (req, res, next) => {
  try {
    const data = productSchema.partial().parse(req.body);
    const product = await prisma.product.update({
      where: { id: Number(req.params.id) },
      data
    });
    res.json({ data: product });
  } catch (error) {
    next(error);
  }
});

router.delete("/products/:id", async (req, res, next) => {
  try {
    await prisma.product.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Product deleted" });
  } catch (error) {
    next(error);
  }
});

router.get("/orders", async (_req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: true
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({ data: orders });
  } catch (error) {
    next(error);
  }
});

router.patch("/orders/:id/status", async (req, res, next) => {
  try {
    const { status } = z.object({
      status: z.enum(["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"])
    }).parse(req.body);

    const order = await prisma.order.update({
      where: { id: Number(req.params.id) },
      data: { status }
    });

    res.json({ data: order });
  } catch (error) {
    next(error);
  }
});

export default router;
