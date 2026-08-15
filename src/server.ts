import "dotenv/config";
import { app } from "./app";

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`MotoShop API running on port ${PORT}`);
});