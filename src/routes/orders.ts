import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/test", (_req, res) => {
  res.json({
    message: "NEW ORDERS ROUTE WORKS",
    version: "v2",
  });
});

const orderSchema = z.object({
  customer: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(8),
  }),

  delivery: z.object({
    type: z.string().min(1),
    city: z.string().min(2),
    department: z.string().optional(),
  }),

  payment: z.string().min(1),

  comment: z.string().optional(),

  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
});

router.post("/", async (req, res, next) => {
  try {
    const data = orderSchema.parse(req.body);

    const productIds = data.items.map(
      (item) => item.productId
    );

    const products = await prisma.product.findMany({
      where: {
        id: {
          in: productIds,
        },
      },
    });

    if (products.length !== productIds.length) {
      return res.status(400).json({
        message:
          "Один або декілька товарів не знайдено",
      });
    }

    let total = 0;

    for (const item of data.items) {
      const product = products.find(
        (product) =>
          product.id === item.productId
      );

      if (!product) {
        return res.status(400).json({
          message: `Товар з ID ${item.productId} не знайдено`,
        });
      }

      if (item.quantity > product.stock) {
        return res.status(400).json({
          message: `Недостатньо товару "${product.name}" на складі`,
        });
      }

      total +=
        product.price * item.quantity;
    }

    const order = await prisma.$transaction(
      async (tx) => {
        const createdOrder =
          await tx.order.create({
            data: {
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
                data.delivery.department ??
                null,

              deliveryType:
                data.delivery.type,

              payment:
                data.payment,

              comment:
                data.comment ?? null,

              items: {
                create: data.items.map(
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

        for (const item of data.items) {
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

    return res.status(201).json({
      data: order,
    });
  } catch (error) {
    next(error);
  }
});

/*
  Якщо пізніше захочемо історію
  замовлень для користувача —
  додамо окремий route.
*/

export default router;