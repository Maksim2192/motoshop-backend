import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const router = Router();

const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Вкажіть ім'я")
    .max(100),

  phone: z
    .string()
    .trim()
    .min(8, "Вкажіть коректний номер телефону")
    .max(30),

  email: z
    .email("Вкажіть коректний email"),

  message: z
    .string()
    .trim()
    .min(5, "Повідомлення занадто коротке")
    .max(2000),
});

router.post("/", async (req, res, next) => {
  try {
    const data = contactSchema.parse(req.body);

    const contactMessage =
      await prisma.contactMessage.create({
        data: {
          name: data.name,
          phone: data.phone,
          email: data.email,
          message: data.message,
        },
      });

    return res.status(201).json({
      message: "Повідомлення успішно надіслано",
      data: contactMessage,
    });
  } catch (error) {
    next(error);
  }
});

export default router;