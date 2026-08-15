import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { auth } from "../middleware/auth";
import { AuthRequest } from "../types/auth";

const router = Router();

router.get("/product/:productId", async (req, res, next) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { productId: Number(req.params.productId) },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" }
    });

    res.json({ data: reviews });
  } catch (error) {
    next(error);
  }
});

router.post("/product/:productId", auth(), async (req: AuthRequest, res, next) => {
  try {
    const { rating, comment } = z.object({
      rating: z.number().int().min(1).max(5),
      comment: z.string().min(2).max(1000)
    }).parse(req.body);

    const productId = Number(req.params.productId);

    const review = await prisma.review.create({
      data: {
        userId: req.user!.id,
        productId,
        rating,
        comment
      }
    });

    const stats = await prisma.review.aggregate({
      where: { productId },
      _avg: { rating: true }
    });

    await prisma.product.update({
      where: { id: productId },
      data: { rating: Number((stats._avg.rating ?? 0).toFixed(1)) }
    });

    res.status(201).json({ data: review });
  } catch (error) {
    next(error);
  }
});

export default router;
