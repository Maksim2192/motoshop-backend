import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("12345678", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@motoshop.local" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@motoshop.local",
      password,
      role: "ADMIN"
    }
  });

  const user = await prisma.user.upsert({
    where: { email: "user@motoshop.local" },
    update: {},
    create: {
      name: "Test User",
      email: "user@motoshop.local",
      password,
      role: "USER"
    }
  });

  const categories = [
    { name: "Освітлення", slug: "lighting" },
    { name: "Тримачі", slug: "holders" },
    { name: "Гріпси", slug: "grips" },
    { name: "Аксесуари", slug: "accessories" }
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name },
      create: category
    });
  }

  const lighting = await prisma.category.findUniqueOrThrow({ where: { slug: "lighting" } });
  const holders = await prisma.category.findUniqueOrThrow({ where: { slug: "holders" } });
  const grips = await prisma.category.findUniqueOrThrow({ where: { slug: "grips" } });

  const products = [
    {
      name: 'LED фари "Сова"',
      slug: "led-fary-sova",
      description: "Компактні LED фари для мотоцикла з двома режимами світла.",
      price: 599,
      oldPrice: 699,
      stock: 15,
      images: [
        "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=900&q=80"
      ],
      specs: { lightModes: 2, voltage: "12V", color: "white/yellow" },
      categoryId: lighting.id
    },
    {
      name: "Тримач телефону на мотоцикл",
      slug: "telefonnyi-trymach-moto",
      description: "Універсальний тримач смартфона на кермо мотоцикла або велосипеда.",
      price: 330,
      stock: 25,
      images: [
        "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80"
      ],
      specs: { mount: "handlebar", adjustable: true },
      categoryId: holders.id
    },
    {
      name: "Lock-On гріпси 22 мм",
      slug: "lock-on-grips-22mm",
      description: "Гріпси Lock-On з фіксацією на кермі та рельєфною поверхнею.",
      price: 449,
      oldPrice: 499,
      stock: 18,
      images: [
        "https://images.unsplash.com/photo-1558980394-0c3f8b4b5f5e?auto=format&fit=crop&w=900&q=80"
      ],
      specs: { diameter: "22 mm", type: "Lock-On", material: "rubber + aluminum" },
      categoryId: grips.id
    }
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: product,
      create: product
    });
  }

  await prisma.cart.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id }
  });

  console.log("Seed completed.");
  console.log("Admin: admin@motoshop.local / 12345678");
  console.log("User:  user@motoshop.local / 12345678");
  console.log("Admin id:", admin.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
