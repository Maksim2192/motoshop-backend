import { Router } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { auth } from "../middleware/auth";

const router = Router();

router.use(auth("ADMIN"));

const upload = multer({
  storage: multer.memoryStorage(),
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

router.post(
  "/",
  upload.single("image"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Image is required",
        });
      }

      const base64 = req.file.buffer.toString("base64");

      const dataUri = `data:${req.file.mimetype};base64,${base64}`;

      const result = await cloudinary.uploader.upload(
        dataUri,
        {
          folder: "motoshop/products",
        }
      );

      res.json({
        data: {
          url: result.secure_url,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;