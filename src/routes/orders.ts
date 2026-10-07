import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import {
  auth,
  optionalAuth,
} from "../middleware/auth";
import { AuthRequest } from "../types/auth";

const router = Router();

router.get("/test", (_req, res) => {
  return res.json({
    message: "NEW ORDERS ROUTE WORKS",
    version: "v5",
  });
});

/* =========================
   VALIDATION
========================= */

const orderSchema = z.object({
  customer: z.object({
    name: z
      .string()
      .trim()
      .min(2, "Ім'я має містити мінімум 2 символи"),

    email: z.email("Некоректний email"),

    phone: z
      .string()
      .trim()
      .min(8, "Некоректний номер телефону"),
  }),

  delivery: z.object({
    type: z
      .string()
      .trim()
      .min(1, "Оберіть спосіб доставки"),

    city: z
      .string()
      .trim()
      .min(2, "Вкажіть місто"),

    department: z
      .string()
      .trim()
      .optional(),
  }),

  payment: z
    .string()
    .trim()
    .min(1, "Оберіть спосіб оплати"),

  comment: z
    .string()
    .trim()
    .max(
      1000,
      "Коментар не може містити більше 1000 символів"
    )
    .optional(),

  items: z
    .array(
      z.object({
        productId:
          z.number().int().positive(),

        quantity:
          z.number().int().positive(),
      })
    )
    .min(
      1,
      "Замовлення повинно містити хоча б один товар"
    ),
});

/* =========================
   CREATE ORDER
========================= */

router.post(
  "/",
  optionalAuth(),
  async (
    req: AuthRequest,
    res,
    next
  ) => {
    try {
      const data =
        orderSchema.parse(req.body);

      const quantityMap =
        new Map<number, number>();

      for (const item of data.items) {
        const current =
          quantityMap.get(
            item.productId
          ) ?? 0;

        quantityMap.set(
          item.productId,
          current + item.quantity
        );
      }

      const items =
        Array.from(
          quantityMap.entries()
        ).map(
          ([productId, quantity]) => ({
            productId,
            quantity,
          })
        );

      const productIds =
        items.map(
          (item) => item.productId
        );

      /* =========================
         LOAD PRODUCTS
      ========================= */

      const products =
        await prisma.product.findMany({
          where: {
            id: {
              in: productIds,
            },

            isActive: true,
          },
        });

      if (
        products.length !==
        productIds.length
      ) {
        return res.status(400).json({
          message:
            "Один або декілька товарів не знайдено або вони недоступні",
        });
      }

      /* =========================
         CALCULATE TOTAL
      ========================= */

      let total = 0;

      for (const item of items) {
        const product =
          products.find(
            (product) =>
              product.id ===
              item.productId
          );

        if (!product) {
          return res.status(400).json({
            message:
              `Товар з ID ${item.productId} не знайдено`,
          });
        }

        if (
          item.quantity >
          product.stock
        ) {
          return res.status(400).json({
            message:
              `Недостатньо товару "${product.name}" на складі`,
          });
        }

        total +=
          product.price *
          item.quantity;
      }

      /* =========================
         TRANSACTION
      ========================= */

      const order =
        await prisma.$transaction(
          async (tx) => {
            for (const item of items) {
              const result =
                await tx.product.updateMany({
                  where: {
                    id:
                      item.productId,

                    isActive: true,

                    stock: {
                      gte:
                        item.quantity,
                    },
                  },

                  data: {
                    stock: {
                      decrement:
                        item.quantity,
                    },
                  },
                });

              if (
                result.count === 0
              ) {
                const product =
                  products.find(
                    (product) =>
                      product.id ===
                      item.productId
                  );

                throw new Error(
                  `Недостатньо товару "${product?.name ?? "товару"}" на складі`
                );
              }
            }

            /* =========================
               CREATE ORDER
            ========================= */

            return tx.order.create({
              data: {
                /*
                  Авторизований користувач:
                  userId = його ID.

                  Гість:
                  userId = null.
                */

                userId:
                  req.user?.id ??
                  null,

                total,

                customerName:
                  data.customer.name,

                email:
                  data.customer.email,

                phone:
                  data.customer.phone,

                city:
                  data.delivery.city,

                department:
                  data.delivery
                    .department ??
                  null,

                deliveryType:
                  data.delivery.type,

                payment:
                  data.payment,

                comment:
                  data.comment ||
                  null,

                items: {
                  create:
                    items.map(
                      (item) => {
                        const product =
                          products.find(
                            (product) =>
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
          }
        );

      return res.status(201).json({
        data: order,
      });
    } catch (error) {

      if (
        error instanceof Error &&
        error.message.startsWith(
          "Недостатньо товару"
        )
      ) {
        return res.status(409).json({
          message:
            error.message,
        });
      }

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
        return res.status(404).json({
          message:
            "Користувача не знайдено",
        });
      }

      const orders =
        await prisma.order.findMany({
          where: {
            OR: [
              {
                userId: user.id,
              },

              {
                userId: null,
                email: user.email,
              },
            ],
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
        return res.status(400).json({
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

      const order =
        await prisma.order.findFirst({
          where: {
            id,

            OR: [
              {
                userId: user.id,
              },

              {
                userId: null,
                email: user.email,
              },
            ],
          },

          include: {
            items: true,
          },
        });

      if (!order) {
        return res.status(404).json({
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