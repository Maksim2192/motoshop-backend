import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { auth } from "../middleware/auth";
import { AuthRequest } from "../types/auth";

const router = Router();

/* =========================
   GET PRODUCT REVIEWS
========================= */

router.get(
  "/product/:productId",
  async (req, res, next) => {
    try {
      const productId = Number(
        req.params.productId
      );

      if (
        !Number.isInteger(productId) ||
        productId <= 0
      ) {
        return res.status(400).json({
          message: "Некоректний ID товару",
        });
      }

      const reviews =
        await prisma.review.findMany({
          where: {
            productId,
          },

          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },

          orderBy: {
            createdAt: "desc",
          },
        });

      const average =
        reviews.length > 0
          ? reviews.reduce(
              (sum, review) =>
                sum + review.rating,
              0
            ) / reviews.length
          : 0;

      return res.json({
        data: {
          reviews,
          rating:
            Math.round(average * 10) /
            10,
          count: reviews.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/* =========================
   CREATE REVIEW
========================= */

router.post(
  "/product/:productId",
  auth(),
  async (
    req: AuthRequest,
    res,
    next
  ) => {
    try {
      const productId = Number(
        req.params.productId
      );

      if (
        !Number.isInteger(productId) ||
        productId <= 0
      ) {
        return res.status(400).json({
          message: "Некоректний ID товару",
        });
      }

      const {
        rating,
        comment,
      } = z
        .object({
          rating: z
            .number()
            .int()
            .min(1)
            .max(5),

          comment: z
            .string()
            .trim()
            .min(2)
            .max(1000),
        })
        .parse(req.body);

      const user =
        await prisma.user.findUnique({
          where: {
            id: req.user!.id,
          },

          select: {
            id: true,
            email: true,
          },
        });

      if (!user) {
        return res.status(404).json({
          message:
            "Користувача не знайдено",
        });
      }

      const product =
        await prisma.product.findUnique({
          where: {
            id: productId,
          },

          select: {
            id: true,
          },
        });

      if (!product) {
        return res.status(404).json({
          message:
            "Товар не знайдено",
        });
      }

      const deliveredOrder =
        await prisma.order.findFirst({
          where: {
            email: user.email,

            status: "DELIVERED",

            items: {
              some: {
                productId,
              },
            },
          },

          select: {
            id: true,
          },
        });

      if (!deliveredOrder) {
        return res.status(403).json({
          message:
            "Оцінити можна лише товар із доставленого замовлення",
        });
      }

      const existingReview =
        await prisma.review.findUnique({
          where: {
            userId_productId: {
              userId: user.id,
              productId,
            },
          },
        });

      if (existingReview) {
        return res.status(409).json({
          message:
            "Ви вже залишили відгук на цей товар",
        });
      }

      const review =
        await prisma.review.create({
          data: {
            userId: user.id,
            productId,
            rating,
            comment,
          },

          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

      const stats =
        await prisma.review.aggregate({
          where: {
            productId,
          },

          _avg: {
            rating: true,
          },
        });

      await prisma.product.update({
        where: {
          id: productId,
        },

        data: {
          rating: Number(
            (
              stats._avg.rating ?? 0
            ).toFixed(1)
          ),
        },
      });

      return res
        .status(201)
        .json({
          data: review,
        });
    } catch (error) {
      next(error);
    }
  }
);

export default router;