import { Router } from "express";
import { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";

const router = Router();

/* =========================
   GET PRODUCTS
========================= */

router.get(
  "/",
  async (req, res, next) => {
    try {
      const page = Math.max(
        Number(req.query.page) || 1,
        1
      );

      const limit = Math.min(
        Math.max(
          Number(req.query.limit) || 12,
          1
        ),
        50
      );

      const search = String(
        req.query.search || ""
      ).trim();

      const category = String(
        req.query.category || ""
      ).trim();

      const sort = String(
        req.query.sort || "newest"
      ).trim();

      const discount =
        String(
          req.query.discount || ""
        ) === "true";

      const minPriceRaw =
        req.query.minPrice;

      const maxPriceRaw =
        req.query.maxPrice;

      const minPrice =
        minPriceRaw !== undefined &&
        minPriceRaw !== ""
          ? Number(minPriceRaw)
          : undefined;

      const maxPrice =
        maxPriceRaw !== undefined &&
        maxPriceRaw !== ""
          ? Number(maxPriceRaw)
          : undefined;

      if (
        minPrice !== undefined &&
        Number.isNaN(minPrice)
      ) {
        return res.status(400).json({
          message:
            "Некоректна мінімальна ціна",
        });
      }

      if (
        maxPrice !== undefined &&
        Number.isNaN(maxPrice)
      ) {
        return res.status(400).json({
          message:
            "Некоректна максимальна ціна",
        });
      }

      if (
        minPrice !== undefined &&
        maxPrice !== undefined &&
        minPrice > maxPrice
      ) {
        return res.status(400).json({
          message:
            "Мінімальна ціна не може бути більшою за максимальну",
        });
      }

      const where: Prisma.ProductWhereInput =
        {};

      /* SEARCH */

      if (search) {
        where.OR = [
          {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            description: {
              contains: search,
              mode: "insensitive",
            },
          },
        ];
      }

      /* CATEGORY */

      if (category) {
        where.category = {
          slug: category,
        };
      }

      /* PRICE */

      if (
        minPrice !== undefined ||
        maxPrice !== undefined
      ) {
        where.price = {
          ...(minPrice !== undefined
            ? {
                gte: minPrice,
              }
            : {}),

          ...(maxPrice !== undefined
            ? {
                lte: maxPrice,
              }
            : {}),
        };
      }

      /* DISCOUNT */

      if (discount) {
        where.oldPrice = {
          not: null,
        };
      }

      /* SORT */

      let orderBy:
        | Prisma.ProductOrderByWithRelationInput
        | Prisma.ProductOrderByWithRelationInput[];

      switch (sort) {
        case "price_asc":
        case "price-asc":
          orderBy = {
            price: "asc",
          };
          break;

        case "price_desc":
        case "price-desc":
          orderBy = {
            price: "desc",
          };
          break;

        case "name_asc":
        case "name-asc":
          orderBy = {
            name: "asc",
          };
          break;

        case "name_desc":
        case "name-desc":
          orderBy = {
            name: "desc",
          };
          break;

        case "rating":
        case "rating_desc":
        case "rating-desc":
          orderBy = [
            {
              rating: "desc",
            },
            {
              createdAt: "desc",
            },
          ];
          break;

        case "oldest":
          orderBy = {
            createdAt: "asc",
          };
          break;

        case "newest":
        default:
          orderBy = {
            createdAt: "desc",
          };
          break;
      }

      const skip =
        (page - 1) * limit;

      const [
        products,
        total,
      ] = await Promise.all([
        prisma.product.findMany({
          where,

          include: {
            category: true,
          },

          orderBy,

          skip,
          take: limit,
        }),

        prisma.product.count({
          where,
        }),
      ]);

      /*
        Prisma не може напряму зробити:
        oldPrice > price

        Тому якщо включено discount,
        додатково відфільтровуємо.
      */

      let finalProducts =
        products;

      if (discount) {
        finalProducts =
          products.filter(
            (product) =>
              product.oldPrice !== null &&
              product.oldPrice >
                product.price
          );
      }

      return res.json({
        data: finalProducts,

        pagination: {
          page,
          limit,

          total,

          totalPages:
            Math.ceil(
              total / limit
            ),

          hasNextPage:
            page <
            Math.ceil(
              total / limit
            ),

          hasPrevPage:
            page > 1,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/* =========================
   GET PRODUCT BY SLUG
========================= */

router.get(
  "/slug/:slug",
  async (req, res, next) => {
    try {
      const slug =
        req.params.slug;

      const product =
        await prisma.product.findUnique({
          where: {
            slug,
          },

          include: {
            category: true,
          },
        });

      if (!product) {
        return res
          .status(404)
          .json({
            message:
              "Product not found",
          });
      }

      return res.json({
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }
);

/* =========================
   GET PRODUCT BY ID
========================= */

router.get(
  "/:id",
  async (req, res, next) => {
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
              "Invalid product ID",
          });
      }

      const product =
        await prisma.product.findUnique({
          where: {
            id,
          },

          include: {
            category: true,
          },
        });

      if (!product) {
        return res
          .status(404)
          .json({
            message:
              "Product not found",
          });
      }

      return res.json({
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;