import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { auth } from "../middleware/auth";
import { AuthRequest } from "../types/auth";

const router = Router();
router.use(auth());

async function getCart(userId: number) {
  let cart = await prisma.cart.findUnique({
    where: { userId },
    include: { items: { include: { product: true } } }
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId },
      include: { items: { include: { product: true } } }
    });
  }

  const total = cart.items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  return { ...cart, total };
}

router.get("/", async (req: AuthRequest, res, next) => {
  try {
    res.json({ data: await getCart(req.user!.id) });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req: AuthRequest, res, next) => {
  try {
    const { productId, quantity } = z.object({
      productId: z.number().int().positive(),
      quantity: z.number().int().positive()
    }).parse(req.body);

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (quantity > product.stock) return res.status(400).json({ message: "Not enough stock" });

    const cart = await prisma.cart.upsert({
      where: { userId: req.user!.id },
      update: {},
      create: { userId: req.user!.id }
    });

    await prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      update: { quantity: { increment: quantity } },
      create: { cartId: cart.id, productId, quantity }
    });

    res.status(201).json({ data: await getCart(req.user!.id) });
  } catch (error) {
    next(error);
  }
});

router.patch("/:itemId", async (req: AuthRequest, res, next) => {
  try {
    const { quantity } = z.object({
      quantity: z.number().int().positive()
    }).parse(req.body);

    const item = await prisma.cartItem.findFirst({
      where: { id: Number(req.params.itemId), cart: { userId: req.user!.id } },
      include: { product: true }
    });

    if (!item) return res.status(404).json({ message: "Cart item not found" });
    if (quantity > item.product.stock) return res.status(400).json({ message: "Not enough stock" });

    await prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity }
    });

    res.json({ data: await getCart(req.user!.id) });
  } catch (error) {
    next(error);
  }
});

router.delete("/:itemId", async (req: AuthRequest, res, next) => {
  try {
    const item = await prisma.cartItem.findFirst({
      where: { id: Number(req.params.itemId), cart: { userId: req.user!.id } }
    });

    if (!item) return res.status(404).json({ message: "Cart item not found" });

    await prisma.cartItem.delete({ where: { id: item.id } });
    res.json({ data: await getCart(req.user!.id) });
  } catch (error) {
    next(error);
  }
});

router.delete("/", async (req: AuthRequest, res, next) => {
  try {
    const cart = await prisma.cart.findUnique({ where: { userId: req.user!.id } });
    if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    res.json({ data: await getCart(req.user!.id) });
  } catch (error) {
    next(error);
  }
});

export default router;
