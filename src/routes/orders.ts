import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { auth } from "../middleware/auth";
import { AuthRequest } from "../types/auth";

const router = Router();

/* =========================
   TEST
========================= */

router.get("/test", (_req, res) => {
  return res.json({
    message: "NEW ORDERS ROUTE WORKS",
    version: "v3",
  });
});

/* =========================
   SCHEMA
========================= */

const orderSchema = z.object({
  customer: z.object({
    name: z
      .string()
      .trim()
      .min(2),

    email: z.email(),

    phone: z
      .string()
      .trim()
      .min(8),
  }),

  delivery: z.object({
    type: z
      .string()
      .min(1),

    city: z
      .string()
      .trim()
      .min(2),

    department: z
      .string()
      .trim()
      .optional(),
  }),

  payment: z
    .string()
    .min(1),

  comment: z
    .string()
    .optional(),

  items: z
    .array(
      z.object({
        productId: z
          .number()
          .int()
          .positive(),

        quantity: z
          .number()
          .int()
          .positive(),
      })
    )
    .min(1),
});

/* =========================
   CREATE ORDER
========================= */

router.post(
  "/",
  async (req, res, next) => {
    try {
      const data =
        orderSchema.parse(
          req.body
        );

      const productIds =
        data.items.map(
          (item) =>
            item.productId
        );

      const uniqueProductIds = [
        ...new Set(productIds),
      ];

      const products =
        await prisma.product.findMany({
          where: {
            id: {
              in: uniqueProductIds,
            },
          },
        });

      if (
        products.length !==
        uniqueProductIds.length
      ) {
        return res
          .status(400)
          .json({
            message:
              "Один або декілька товарів не знайдено",
          });
      }

      let total = 0;

      for (
        const item of data.items
      ) {
        const product =
          products.find(
            (product) =>
              product.id ===
              item.productId
          );

        if (!product) {
          return res
            .status(400)
            .json({
              message:
                `Товар з ID ${item.productId} не знайдено`,
            });
        }

        if (
          item.quantity >
          product.stock
        ) {
          return res
            .status(400)
            .json({
              message:
                `Недостатньо товару "${product.name}" на складі`,
            });
        }

        total +=
          product.price *
          item.quantity;
      }

      const order =
        await prisma.$transaction(
          async (tx) => {
            const createdOrder =
              await tx.order.create({
                data: {
                  total,

                  customerName:
                    data.customer
                      .name,

                  email:
                    data.customer
                      .email,

                  phone:
                    data.customer
                      .phone,

                  city:
                    data.delivery
                      .city,

                  department:
                    data.delivery
                      .department ??
                    null,

                  deliveryType:
                    data.delivery
                      .type,

                  payment:
                    data.payment,

                  comment:
                    data.comment ??
                    null,

                  items: {
                    create:
                      data.items.map(
                        (item) => {
                          const product =
                            products.find(
                              (
                                product
                              ) =>
                                product.id ===
                                item.productId
                            )!;

                          return {
                            productId:
                              product.id,

                            name:
                              product.name,

                            price:
                              product.price,

                            quantity:
                              item.quantity,
                          };
                        }
                      ),
                  },
                },

                include: {
                  items: true,
                },
              });

            for (
              const item of data.items
            ) {
              await tx.product.update({
                where: {
                  id: item.productId,
                },

                data: {
                  stock: {
                    decrement:
                      item.quantity,
                  },
                },
              });
            }

            return createdOrder;
          }
        );

      return res
        .status(201)
        .json({
          data: order,
        });
    } catch (error) {
      next(error);
    }
  }
);

/* =========================
   MY ORDERS
========================= */

router.get(
  "/",
  auth(),
  async (
    req: AuthRequest,
    res,
    next
  ) => {
    try {
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
        return res
          .status(404)
          .json({
            message:
              "Користувача не знайдено",
          });
      }

      const orders =
        await prisma.order.findMany({
          where: {
            email: user.email,
          },

          include: {
            items: true,
          },

          orderBy: {
            createdAt: "desc",
          },
        });

      return res.json({
        data: orders,
      });
    } catch (error) {
      next(error);
    }
  }
);

/* =========================
   ONE MY ORDER
========================= */

router.get(
  "/:id",
  auth(),
  async (
    req: AuthRequest,
    res,
    next
  ) => {
    try {
      const id = Number(
        req.params.id
      );

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res
          .status(400)
          .json({
            message:
              "Некоректний ID замовлення",
          });
      }

      const user =
        await prisma.user.findUnique({
          where: {
            id: req.user!.id,
          },

          select: {
            email: true,
          },
        });

      if (!user) {
        return res
          .status(404)
          .json({
            message:
              "Користувача не знайдено",
          });
      }

      const order =
        await prisma.order.findFirst({
          where: {
            id,
            email: user.email,
          },

          include: {
            items: true,
          },
        });

      if (!order) {
        return res
          .status(404)
          .json({
            message:
              "Замовлення не знайдено",
          });
      }

      return res.json({
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;