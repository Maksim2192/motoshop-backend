import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { auth } from "../middleware/auth";
import { resend } from "../lib/resend";

const router = Router();

router.use(auth("ADMIN"));


// =========================
// SCHEMAS
// =========================

const productSchema = z.object({
  name: z.string().min(2),

  slug: z.string().min(2),

  description: z.string().min(2),

  price: z
    .number()
    .int()
    .positive(),

  oldPrice: z
    .number()
    .int()
    .positive()
    .optional()
    .nullable(),

  stock: z
    .number()
    .int()
    .min(0),

  images: z
    .array(z.string())
    .default([]),

  specs: z
    .any()
    .optional(),

  categoryId: z
    .number()
    .int()
    .positive(),
});


const orderStatusSchema = z.object({
  status: z.enum([
    "PENDING",
    "CONFIRMED",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
  ]),
});

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "<br />");
}

// =========================
// STATS
// =========================

router.get(
  "/stats",
  async (_req, res, next) => {
    try {
      const [
        products,
        users,
        orders,
        revenue,
      ] = await Promise.all([
        prisma.product.count(),

        prisma.user.count(),

        prisma.order.count(),

        prisma.order.aggregate({
          where: {
            status: {
              not: "CANCELLED",
            },
          },

          _sum: {
            total: true,
          },
        }),
      ]);

      return res.json({
        data: {
          products,
          users,
          orders,

          revenue:
            revenue._sum.total ?? 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);


// =========================
// PRODUCTS
// =========================

// CREATE PRODUCT

router.post(
  "/products",
  async (req, res, next) => {
    try {
      const data =
        productSchema.parse(
          req.body
        );

      const product =
        await prisma.product.create({
          data,
        });

      return res.status(201).json({
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }
);


// UPDATE PRODUCT

router.patch(
  "/products/:id",
  async (req, res, next) => {
    try {
      const id = Number(
        req.params.id
      );

      if (!Number.isInteger(id)) {
        return res.status(400).json({
          message:
            "Invalid product ID",
        });
      }

      const data =
        productSchema
          .partial()
          .parse(req.body);

      const product =
        await prisma.product.update({
          where: {
            id,
          },

          data,
        });

      return res.json({
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }
);



router.post(
  "/contacts/:id/reply",
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
          message: "Invalid message ID",
        });
      }

      const { reply } = z
        .object({
          reply: z
            .string()
            .trim()
            .min(2, "Відповідь занадто коротка")
            .max(5000),
        })
        .parse(req.body);

      const contactMessage =
        await prisma.contactMessage.findUnique({
          where: {
            id,
          },
        });

      if (!contactMessage) {
        return res.status(404).json({
          message: "Повідомлення не знайдено",
        });
      }

      const { data, error } =
        await resend.emails.send({
          from:
            process.env.RESEND_FROM_EMAIL ||
            "MotoShop <onboarding@resend.dev>",

          to: [contactMessage.email],

          subject: "Відповідь від MotoShop",

          html: `
            <div
              style="
                max-width:600px;
                margin:0 auto;
                font-family:Arial,sans-serif;
                color:#171717;
              "
            >
              <h2>
                Вітаємо, ${escapeHtml(contactMessage.name)}!
              </h2>

              <p>
                Ви зверталися до MotoShop із повідомленням:
              </p>

              <div
                style="
                  padding:16px;
                  margin:20px 0;
                  background:#f5f5f5;
                  border-radius:10px;
                "
              >
                ${escapeHtml(contactMessage.message)}
              </div>

              <p>
                <strong>
                  Наша відповідь:
                </strong>
              </p>

              <div
                style="
                  padding:16px;
                  margin:20px 0;
                  background:#111;
                  color:#fff;
                  border-radius:10px;
                "
              >
                ${escapeHtml(reply)}
              </div>

              <p>
                Дякуємо, що звернулися до MotoShop.
              </p>
            </div>
          `,
        });

      if (error) {
        console.error("RESEND ERROR:", error);

        return res.status(502).json({
          message:
            error.message ||
            "Не вдалося відправити email",
        });
      }

      const updated =
        await prisma.contactMessage.update({
          where: {
            id,
          },

          data: {
            reply,
            repliedAt: new Date(),
            isRead: true,
          },
        });

      return res.json({
        message:
          "Відповідь успішно відправлено",
        data: updated,
        emailId: data?.id,
      });
    } catch (error) {
      next(error);
    }
  }
);


// DELETE PRODUCT

router.delete(
  "/products/:id",
  async (req, res, next) => {
    try {
      const id = Number(
        req.params.id
      );

      if (!Number.isInteger(id)) {
        return res.status(400).json({
          message:
            "Invalid product ID",
        });
      }

      await prisma.product.delete({
        where: {
          id,
        },
      });

      return res.json({
        message:
          "Product deleted",
      });
    } catch (error) {
      next(error);
    }
  }
);


// =========================
// ORDERS
// =========================

// GET ALL ORDERS

router.get(
  "/orders",
  async (_req, res, next) => {
    try {
      const orders =
        await prisma.order.findMany({
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },

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


// GET ONE ORDER

router.get(
  "/orders/:id",
  async (req, res, next) => {
    try {
      const id = Number(
        req.params.id
      );

      if (!Number.isInteger(id)) {
        return res.status(400).json({
          message:
            "Invalid order ID",
        });
      }

      const order =
        await prisma.order.findUnique({
          where: {
            id,
          },

          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },

            items: true,
          },
        });

      if (!order) {
        return res.status(404).json({
          message:
            "Order not found",
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


// UPDATE ORDER STATUS

router.patch(
  "/orders/:id/status",
  async (req, res, next) => {
    try {
      const id = Number(
        req.params.id
      );

      if (!Number.isInteger(id)) {
        return res.status(400).json({
          message:
            "Invalid order ID",
        });
      }

      const { status } =
        orderStatusSchema.parse(
          req.body
        );

      const existingOrder =
        await prisma.order.findUnique({
          where: {
            id,
          },
        });

      if (!existingOrder) {
        return res.status(404).json({
          message:
            "Order not found",
        });
      }

      const order =
        await prisma.order.update({
          where: {
            id,
          },

          data: {
            status,
          },

          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },

            items: true,
          },
        });

      return res.json({
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get("/contacts", async (_req, res, next) => {
  try {
    const messages = await prisma.contactMessage.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json({
      data: messages,
    });
  } catch (error) {
    next(error);
  }
});

router.patch(
  "/contacts/:id/read",
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
          message: "Invalid message ID",
        });
      }

      const message =
        await prisma.contactMessage.update({
          where: {
            id,
          },

          data: {
            isRead: true,
          },
        });

      return res.json({
        data: message,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/contacts/:id",
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
          message: "Invalid message ID",
        });
      }

      await prisma.contactMessage.delete({
        where: {
          id,
        },
      });

      return res.json({
        message: "Message deleted",
      });
    } catch (error) {
      next(error);
    }
  }
);


export default router;