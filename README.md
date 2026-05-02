# Orientation — Real Estate Video Platform

Orientation is a full-stack video platform built for the Egyptian real estate industry. It lets property developers publish cinematic project orientations — episodes, reels, PDFs, and inventory sheets — so that sales brokers and agents can learn every project on their own time, anywhere, without pulling developers away from their work.

---

## Features

**For Viewers (Brokers & Sales Agents)**
- Browse and watch project orientation episodes and reels
- Continue watching from where you left off, synced across sessions
- Save favourite projects and revisit them from a dedicated saved-projects page
- Search projects by title, developer, or area
- Discover projects filtered by location (New Cairo, North Coast, October, etc.)
- Share projects via WhatsApp or copy-link
- Open project inventory sheets and PDF brochures directly in-browser
- View the developer's Google Maps location in one tap

**For Developers (Content Owners)**
- Personal developer profile with project portfolio
- Upload and manage episodes (title, order, duration, thumbnail, video)
- Upload and manage reels (short-form vertical video)
- Upload inventory Excel sheets and PDF brochures per project
- Copy the project sales script to clipboard for use in client calls

**For Admins**
- Full dashboard to manage users, developers, and projects
- Create, edit, and delete projects with logo, hero video, and thumbnail
- Publish / unpublish projects and mark them as featured
- Inline episode, reel, inventory, and PDF management inside the project editor
- Role-based access control (user · developer · admin · superadmin)

**Platform**
- JWT authentication with access + refresh token rotation and reuse detection
- Email verification via OTP on registration; OTP-based password reset
- Watch-history tracking with progress percentage and "continue watching" queue
- Trending score calculated from views and saves with time-decay
- AWS S3 storage (with CloudFront CDN) for all media assets
- Auto-scrolling carousels, drag-to-scroll, and swipe gestures on the hero

---

## The Process

The platform is split into two independently deployable applications that communicate over HTTP.

```
┌─────────────────────────┐        REST API        ┌──────────────────────────┐
│   Next.js Frontend      │ ◄────────────────────► │   NestJS Backend         │
│   (React / TypeScript)  │                        │   (TypeScript / MongoDB) │
└─────────────────────────┘                        └──────────────┬───────────┘
                                                                  │
                                                         ┌────────▼────────┐
                                                         │  AWS S3 + CDN   │
                                                         │  MongoDB Atlas  │
                                                         └─────────────────┘
```

## Running the Project

### Prerequisites

- Node.js ≥ 18
- MongoDB (local or Atlas)
- AWS account with an S3 bucket and CloudFront distribution
- SMTP credentials (e.g. Gmail app password)

---

### Backend

```bash
# 1. Install dependencies
cd backend
npm install

# 2. Create environment file
cp .env.example .env
```

Fill in `.env`:

```bash
# 3. Start in development mode
npm run start:dev

# 4. Build for production
npm run build
npm run start:prod
```

The API will be available at `http://localhost:3000`.

---

### Frontend

```bash
# 1. Install dependencies
cd frontend
npm install

# 2. Create environment file
cp .env.local.example .env.local
```

```bash
# 3. Start development server
npm run dev        # http://localhost:3001

# 4. Build for production
npm run build
npm run start
```

---

## License

This project and all associated video content are proprietary.

**© 2026 FBM Team. All Rights Reserved.**

All videos and shows on this platform are trademarks of, and all related images and content are the property of, Aziz Film. Duplication and copying of this material is strictly prohibited. Unauthorised reproduction, distribution, or modification of any part of this codebase or its content — in whole or in part — is not permitted without explicit written consent from AlRawaabit.
