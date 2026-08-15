import { Router } from "express";
import { prisma } from "../lib/prisma";
import { auth } from "../middleware/auth";
import { AuthRequest } from "../types/auth";

const router = Router();
router.use(auth());

router.get("/", async (req: AuthRequest, res, next) => {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user!.id },
      include: { product: true },
      orderBy: { id: "desc" }
    });

    res.json({ data: favorites });
  } catch (error) {
    next(error);
  }
});

router.post("/:productId", async (req: AuthRequest, res, next) => {
  try {
    const productId = Number(req.params.productId);

    const favorite = await prisma.favorite.upsert({
      where: {
        userId_productId: {
          userId: req.user!.id,
          productId
        }
      },
      update: {},
      create: {
        userId: req.user!.id,
        productId
      }
    });

    res.status(201).json({ data: favorite });
  } catch (error) {
    next(error);
  }
});

router.delete("/:productId", async (req: AuthRequest, res, next) => {
  try {
    await prisma.favorite.delete({
      where: {
        userId_productId: {
          userId: req.user!.id,
          productId: Number(req.params.productId)
        }
      }
    });

    res.json({ message: "Removed from favorites" });
  } catch (error) {
    next(error);
  }
});

export default router;
