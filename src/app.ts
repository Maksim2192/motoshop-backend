import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import productsRouter from "./routes/products";
import categoriesRouter from "./routes/categories";
import authRouter from "./routes/auth";
import cartRouter from "./routes/cart";
import ordersRouter from "./routes/orders";
import reviewsRouter from "./routes/reviews";
import favoritesRouter from "./routes/favorites";
import adminRouter from "./routes/admin";
import uploadRouter from "./routes/upload";
import { errorHandler } from "./middleware/error";

export const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", message: "MotoShop API is running" });
});

app.use("/api/products", productsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/auth", authRouter);
app.use("/api/cart", cartRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/favorites", favoritesRouter);
app.use("/api/admin/upload", uploadRouter);
app.use("/api/admin", adminRouter);

app.use(errorHandler);
