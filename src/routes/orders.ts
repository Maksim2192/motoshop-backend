import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { auth } from "../middleware/auth";
import { AuthRequest } from "../types/auth";

const router = Router();
router.use(auth());

const orderSchema = z.object({
  customerName: z.string().min(2),
  phone: z.string().min(8),
  city: z.string().min(2),
  department: z.string().min(1)
});

router.post("/", async (req: AuthRequest, res, next) => {
  try {
    const delivery = orderSchema.parse(req.body);

    const cart = await prisma.cart.findUnique({
      where: { userId: req.user!.id },
      include: { items: { include: { product: true } } }
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    for (const item of cart.items) {
      if (item.quantity > item.product.stock) {
        return res.status(400).json({
          message: `Not enough stock for "${item.product.name}"`
        });
      }
    }

    const total = cart.items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId: req.user!.id,
          total,
          ...delivery,
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              name: item.product.name,
              price: item.product.price,
              quantity: item.quantity
            }))
          }
        },
        include: { items: true }
      });

      for (const item of cart.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } }
        });
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return created;
    });

    res.status(201).json({ data: order });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req: AuthRequest, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user!.id },
      include: { items: true },
      orderBy: { createdAt: "desc" }
    });

    res.json({ data: orders });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req: AuthRequest, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: Number(req.params.id), userId: req.user!.id },
      include: { items: true }
    });

    if (!order) return res.status(404).json({ message: "Order not found" });

    res.json({ data: order });
  } catch (error) {
    next(error);
  }
});

export default router;
