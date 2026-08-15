# MotoShop Backend

Навчальний REST API для Frontend e-commerce проєкту.

## Stack

- Node.js
- Express
- TypeScript
- PostgreSQL
- Prisma
- JWT + HttpOnly cookie
- Zod

## 1. PostgreSQL

Створи базу:

```sql
CREATE DATABASE motoshop;
```

## 2. Install

```bash
npm install
```

## 3. Environment

Скопіюй `.env.example` у `.env` і перевір:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/motoshop?schema=public"
JWT_SECRET="your-secret"
PORT=4000
FRONTEND_URL="http://localhost:3000"
NODE_ENV="development"
```

## 4. Prisma

```bash
npm run prisma:generate
npx prisma migrate dev --name init
npm run prisma:seed
```

## 5. Run

```bash
npm run dev
```

API:

```text
http://localhost:4000
```

Health check:

```text
GET http://localhost:4000/api/health
```

## Test accounts

```text
Admin:
admin@motoshop.local
12345678

User:
user@motoshop.local
12345678
```

## Frontend

Для fetch із Next.js:

```ts
fetch("http://localhost:4000/api/products", {
  credentials: "include"
});
```

Авторизація використовує HttpOnly cookie, тому frontend не повинен зберігати JWT у localStorage.

## Main endpoints

### Public

```text
GET /api/health
GET /api/products
GET /api/products/:id
GET /api/products/slug/:slug
GET /api/categories
GET /api/reviews/product/:productId
```

### Auth

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### User

```text
GET    /api/cart
POST   /api/cart
PATCH  /api/cart/:itemId
DELETE /api/cart/:itemId
DELETE /api/cart

GET    /api/orders
GET    /api/orders/:id
POST   /api/orders

GET    /api/favorites
POST   /api/favorites/:productId
DELETE /api/favorites/:productId

POST   /api/reviews/product/:productId
```

### Admin

```text
GET    /api/admin/stats
POST   /api/admin/products
PATCH  /api/admin/products/:id
DELETE /api/admin/products/:id
GET    /api/admin/orders
PATCH  /api/admin/orders/:id/status
```
