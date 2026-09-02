import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { resend } from "../lib/resend";
import { auth } from "../middleware/auth";
import { AuthRequest } from "../types/auth";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET!;

const registerSchema = z.object({
  name: z.string().trim().min(2),
  email: z.email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8),
});

function setToken(
  res: any,
  id: number,
  role: "USER" | "ADMIN"
) {
  const token = jwt.sign(
    {
      id,
      role,
    },
    JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );

  res.cookie(
    "accessToken",
    token,
    {
      httpOnly: true,
      sameSite: "none",
      secure:
        process.env.NODE_ENV ===
        "production",
      maxAge:
        7 *
        24 *
        60 *
        60 *
        1000,
    }
  );
}

function escapeHtml(
  value: string
) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =========================
   REGISTER
========================= */

router.post(
  "/register",
  async (req, res, next) => {
    try {
      const data =
        registerSchema.parse(
          req.body
        );

      const exists =
        await prisma.user.findUnique({
          where: {
            email: data.email,
          },
        });

      if (exists) {
        return res
          .status(409)
          .json({
            message:
              "Email already exists",
          });
      }

      const password =
        await bcrypt.hash(
          data.password,
          10
        );

      const user =
        await prisma.user.create({
          data: {
            name: data.name,
            email: data.email,
            password,
          },
        });

      await prisma.cart.create({
        data: {
          userId: user.id,
        },
      });

      setToken(
        res,
        user.id,
        user.role
      );

      return res
        .status(201)
        .json({
          data: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        });
    } catch (error) {
      next(error);
    }
  }
);

/* =========================
   LOGIN
========================= */

router.post(
  "/login",
  async (req, res, next) => {
    try {
      const data =
        loginSchema.parse(
          req.body
        );

      const user =
        await prisma.user.findUnique({
          where: {
            email: data.email,
          },
        });

      if (!user) {
        return res
          .status(401)
          .json({
            message:
              "Invalid email or password",
          });
      }

      const passwordValid =
        await bcrypt.compare(
          data.password,
          user.password
        );

      if (!passwordValid) {
        return res
          .status(401)
          .json({
            message:
              "Invalid email or password",
          });
      }

      setToken(
        res,
        user.id,
        user.role
      );

      return res.json({
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/* =========================
   LOGOUT
========================= */

router.post(
  "/logout",
  (_req, res) => {
    res.clearCookie(
      "accessToken",
      {
        httpOnly: true,
        sameSite: "none",
        secure:
          process.env
            .NODE_ENV ===
          "production",
      }
    );

    return res.json({
      message: "Logged out",
    });
  }
);

/* =========================
   CURRENT USER
========================= */

router.get(
  "/me",
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
            name: true,
            email: true,
            role: true,
            createdAt: true,
          },
        });

      if (!user) {
        return res
          .status(404)
          .json({
            message:
              "User not found",
          });
      }

      return res.json({
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }
);

/* =========================
   FORGOT PASSWORD
========================= */

router.post(
  "/forgot-password",
  async (req, res, next) => {
    try {
      const { email } =
        forgotPasswordSchema.parse(
          req.body
        );

      const user =
        await prisma.user.findUnique({
          where: {
            email,
          },
        });

      /*
        Не повідомляємо,
        чи існує користувач.
      */
      if (!user) {
        return res.json({
          message:
            "Якщо такий email існує, інструкцію надіслано.",
        });
      }

      const token =
        crypto
          .randomBytes(32)
          .toString("hex");

      const tokenHash =
        crypto
          .createHash("sha256")
          .update(token)
          .digest("hex");

      const expiresAt =
        new Date(
          Date.now() +
            30 *
              60 *
              1000
        );

      await prisma.user.update({
        where: {
          id: user.id,
        },

        data: {
          resetPasswordToken:
            tokenHash,

          resetPasswordExpiresAt:
            expiresAt,
        },
      });

      const frontendUrl =
        process.env
          .FRONTEND_URL ||
        "http://localhost:3000";

      const resetUrl =
        `${frontendUrl}/reset-password?token=${token}`;

      const { error } =
        await resend.emails.send({
          from:
            process.env
              .RESEND_FROM_EMAIL ||
            "MotoShop <onboarding@resend.dev>",

          to: [user.email],

          subject:
            "Скидання пароля MotoShop",

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
                Вітаємо, ${escapeHtml(
                  user.name
                )}!
              </h2>

              <p>
                Ми отримали запит
                на скидання пароля
                для вашого акаунта
                MotoShop.
              </p>

              <p>
                Посилання дійсне
                протягом 30 хвилин.
              </p>

              <a
                href="${resetUrl}"
                style="
                  display:inline-block;
                  margin:20px 0;
                  padding:14px 22px;
                  background:#111;
                  color:#fff;
                  text-decoration:none;
                  border-radius:8px;
                  font-weight:700;
                "
              >
                Скинути пароль
              </a>

              <p
                style="
                  color:#777;
                  font-size:13px;
                  line-height:1.6;
                "
              >
                Якщо ви не надсилали
                цей запит, просто
                проігноруйте цей лист.
              </p>
            </div>
          `,
        });

      if (error) {
        console.error(
          "FORGOT PASSWORD EMAIL ERROR:",
          error
        );

        return res
          .status(502)
          .json({
            message:
              error.message ||
              "Не вдалося надіслати email",
          });
      }

      return res.json({
        message:
          "Якщо такий email існує, інструкцію надіслано.",
      });
    } catch (error) {
      next(error);
    }
  }
);

/* =========================
   RESET PASSWORD
========================= */

router.post(
  "/reset-password",
  async (req, res, next) => {
    try {
      const {
        token,
        password,
      } =
        resetPasswordSchema.parse(
          req.body
        );

      const tokenHash =
        crypto
          .createHash("sha256")
          .update(token)
          .digest("hex");

      const user =
        await prisma.user.findFirst({
          where: {
            resetPasswordToken:
              tokenHash,

            resetPasswordExpiresAt:
              {
                gt: new Date(),
              },
          },
        });

      if (!user) {
        return res
          .status(400)
          .json({
            message:
              "Посилання недійсне або термін його дії завершився",
          });
      }

      const hashedPassword =
        await bcrypt.hash(
          password,
          10
        );

      await prisma.user.update({
        where: {
          id: user.id,
        },

        data: {
          password:
            hashedPassword,

          resetPasswordToken:
            null,

          resetPasswordExpiresAt:
            null,
        },
      });

      return res.json({
        message:
          "Пароль успішно змінено",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;