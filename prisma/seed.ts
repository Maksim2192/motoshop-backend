import {
  PrismaClient,
  Prisma,
} from "@prisma/client";

import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type SeedProduct = {
  name: string;
  slug: string;
  description: string;
  price: number;
  oldPrice: number | null;
  stock: number;
  images: string[];
  specs: Prisma.InputJsonValue;
  categorySlug: string;
};

type ProductTemplate = {
  category: string;
  baseName: string;
  description: string;
  basePrice: number;
};

function createSlug(
  value: string
) {
  return value
    .toLowerCase()
    .trim()
    .replace(
      /[^a-z0-9а-яіїєґ]+/gi,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    );
}

async function main() {
  const password =
    await bcrypt.hash(
      "12345678",
      10
    );

  await prisma.user.upsert({
    where: {
      email:
        "admin@motoshop.local",
    },

    update: {},

    create: {
      name: "Admin",
      email:
        "admin@motoshop.local",
      password,
      role: "ADMIN",
    },
  });

  const user =
    await prisma.user.upsert({
      where: {
        email:
          "user@motoshop.local",
      },

      update: {},

      create: {
        name: "Test User",
        email:
          "user@motoshop.local",
        password,
        role: "USER",
      },
    });

  const categories = [
    {
      name: "Освітлення",
      slug: "lighting",
    },
    {
      name: "Тримачі",
      slug: "holders",
    },
    {
      name: "Гріпси",
      slug: "grips",
    },
    {
      name: "Аксесуари",
      slug: "accessories",
    },
    {
      name: "Шоломи",
      slug: "helmets",
    },
    {
      name: "Рукавиці",
      slug: "gloves",
    },
    {
      name: "Захист",
      slug: "protection",
    },
    {
      name: "Дзеркала",
      slug: "mirrors",
    },
    {
      name: "Масла та догляд",
      slug: "oils-care",
    },
  ];

  const categoryMap =
    new Map<string, number>();

  for (
    const category
    of categories
  ) {
    const savedCategory =
      await prisma.category.upsert({
        where: {
          slug:
            category.slug,
        },

        update: {
          name:
            category.name,
        },

        create: category,
      });

    categoryMap.set(
      category.slug,
      savedCategory.id
    );
  }

  const products: SeedProduct[] =
    [
      {
        name: 'LED фари "Сова"',

        slug:
          "led-fary-sova",

        description:
          "Компактні LED фари для мотоцикла з двома режимами світла.",

        price: 599,
        oldPrice: 699,
        stock: 15,

        images: [
          "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=900&q=80",
        ],

        specs: {
          lightModes: 2,
          voltage: "12V",
          color:
            "white/yellow",
        },

        categorySlug:
          "lighting",
      },

      {
        name:
          "Тримач телефону на мотоцикл",

        slug:
          "telefonnyi-trymach-moto",

        description:
          "Універсальний тримач смартфона на кермо мотоцикла або велосипеда.",

        price: 330,
        oldPrice: null,
        stock: 25,

        images: [
          "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80",
        ],

        specs: {
          mount:
            "handlebar",
          adjustable: true,
        },

        categorySlug:
          "holders",
      },

      {
        name:
          "Lock-On гріпси 22 мм",

        slug:
          "lock-on-grips-22mm",

        description:
          "Гріпси Lock-On з фіксацією на кермі та рельєфною поверхнею.",

        price: 449,
        oldPrice: 499,
        stock: 18,

        images: [
          "https://images.unsplash.com/photo-1558980394-0c3f8b4b5f5e?auto=format&fit=crop&w=900&q=80",
        ],

        specs: {
          diameter:
            "22 mm",
          type:
            "Lock-On",
          material:
            "rubber + aluminum",
        },

        categorySlug:
          "grips",
      },
    ];

  const templates: ProductTemplate[] =
    [
      {
        category: "helmets",
        baseName:
          "Мотошолом Street Pro",
        description:
          "Інтегральний мотошолом для міста та траси.",
        basePrice: 3899,
      },

      {
        category: "helmets",
        baseName:
          "Мотошолом Touring X",
        description:
          "Комфортний мотошолом для тривалих поїздок.",
        basePrice: 4299,
      },

      {
        category: "gloves",
        baseName:
          "Моторукавиці Air Ride",
        description:
          "Легкі моторукавиці з вентиляцією та захистом кісточок.",
        basePrice: 1299,
      },

      {
        category: "gloves",
        baseName:
          "Моторукавиці Road Pro",
        description:
          "Шкіряні рукавиці для щоденних і туристичних поїздок.",
        basePrice: 1799,
      },

      {
        category:
          "protection",
        baseName:
          "Захист колін MX Guard",
        description:
          "Зручний захист колін для міста та бездоріжжя.",
        basePrice: 2199,
      },

      {
        category:
          "protection",
        baseName:
          "Захист спини Rider Armor",
        description:
          "Ергономічний захист спини з вентиляцією.",
        basePrice: 2799,
      },

      {
        category:
          "lighting",
        baseName:
          "LED фара Moto Beam",
        description:
          "Додаткова LED-фара для мотоцикла.",
        basePrice: 1699,
      },

      {
        category:
          "lighting",
        baseName:
          "LED поворотники Mini Flash",
        description:
          "Компактні LED-поворотники для мотоцикла.",
        basePrice: 899,
      },

      {
        category: "grips",
        baseName:
          "Гріпси Soft Ride",
        description:
          "М'які гумові гріпси для комфортної їзди.",
        basePrice: 399,
      },

      {
        category: "grips",
        baseName:
          "Гріпси Sport Grip",
        description:
          "Спортивні гріпси з рельєфною поверхнею.",
        basePrice: 549,
      },

      {
        category:
          "holders",
        baseName:
          "Тримач телефону X-Grip",
        description:
          "Універсальний тримач смартфона для керма.",
        basePrice: 1099,
      },

      {
        category:
          "holders",
        baseName:
          "Тримач GPS Moto Mount",
        description:
          "Надійний тримач GPS або смартфона.",
        basePrice: 1299,
      },

      {
        category:
          "mirrors",
        baseName:
          "Дзеркала Street Mini",
        description:
          "Компактні дзеркала для міських мотоциклів.",
        basePrice: 1199,
      },

      {
        category:
          "mirrors",
        baseName:
          "Дзеркала Cafe Racer",
        description:
          "Бар-енд дзеркала у стилі Cafe Racer.",
        basePrice: 1499,
      },

      {
        category:
          "oils-care",
        baseName:
          "Моторне масло 10W-40",
        description:
          "Моторне масло для 4-тактних мотоциклів.",
        basePrice: 599,
      },

      {
        category:
          "oils-care",
        baseName:
          "Спрей для ланцюга Chain Care",
        description:
          "Мастило для мотоциклетного ланцюга.",
        basePrice: 449,
      },

      {
        category:
          "accessories",
        baseName:
          "USB зарядка Moto USB",
        description:
          "USB зарядний пристрій для мотоцикла.",
        basePrice: 699,
      },

      {
        category:
          "accessories",
        baseName:
          "Сумка на бак Moto Bag",
        description:
          "Компактна сумка на бак для щоденних поїздок.",
        basePrice: 1599,
      },
    ];

  for (
    let series = 1;
    series <= 4;
    series++
  ) {
    for (
      const template
      of templates
    ) {
      const name =
        `${template.baseName} ${series}`;

      const price =
        template.basePrice +
        series * 100;

      products.push({
        name,

        slug: createSlug(
          `${template.category}-${name}`
        ),

        description:
          template.description,

        price,

        oldPrice:
          series % 2 === 0
            ? price + 300
            : null,

        stock:
          6 + series * 4,

        images: [],

        specs: {
          series,
          category:
            template.category,
        },

        categorySlug:
          template.category,
      });
    }
  }

  for (
    const product
    of products
  ) {
    const categoryId =
      categoryMap.get(
        product.categorySlug
      );

    if (!categoryId) {
      throw new Error(
        `Категорія "${product.categorySlug}" не знайдена`
      );
    }

    const {
      categorySlug,
      ...data
    } = product;

    await prisma.product.upsert({
      where: {
        slug: data.slug,
      },

      update: {
        name:
          data.name,

        description:
          data.description,

        price:
          data.price,

        oldPrice:
          data.oldPrice,

        stock:
          data.stock,

        images:
          data.images,

        specs:
          data.specs,

        categoryId,
      },

      create: {
        name:
          data.name,

        slug:
          data.slug,

        description:
          data.description,

        price:
          data.price,

        oldPrice:
          data.oldPrice,

        stock:
          data.stock,

        images:
          data.images,

        specs:
          data.specs,

        categoryId,
      },
    });
  }

  await prisma.cart.upsert({
    where: {
      userId: user.id,
    },

    update: {},

    create: {
      userId: user.id,
    },
  });
}

main()
  .catch((error) => {
    console.error(
      "Seed failed:",
      error
    );

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });