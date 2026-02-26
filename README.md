# 🌾 AgriMarket

<p align="center">
  <img src="client/public/agdata_logo.svg" alt="AgriMarket Logo" width="200">
</p>

<p align="center">
  <b>A Modern Agricultural Marketplace Platform</b><br>
  Connecting Growers, Manufacturers, and Retailers in One Unified Ecosystem
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-folder-structure">Folder Structure</a> •
  <a href="#-setup-instructions">Setup</a> •
  <a href="#-deployment">Deployment</a>
</p>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Folder Structure](#-folder-structure)
- [Setup Instructions](#-setup-instructions)
- [Environment Variables](#-environment-variables)
- [Running the Project](#-running-the-project)
- [Building for Production](#-building-for-production)
- [API Integration](#-api-integration)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

**AgriMarket** is a comprehensive agricultural marketplace web application built with Angular 21. It serves as a digital platform that connects three key stakeholders in the agricultural supply chain:

- 👨‍🌾 **Growers** - Farmers and agricultural producers
- 🏭 **Manufacturers** - Food processing and agricultural product manufacturers  
- 🏪 **Retailers** - Grocery stores and agricultural product retailers

The platform provides role-based dashboards, event management, product catalogs, points & rewards systems, and real-time notifications to streamline agricultural commerce.

### Key Capabilities

| Feature | Description |
|---------|-------------|
| 🔐 **Multi-Role Authentication** | Secure login system with role-based access control |
| 📊 **Role-Specific Dashboards** | Tailored dashboards for Growers, Manufacturers, and Retailers |
| 📅 **Event Management** | Create, manage, and participate in agricultural events |
| 🛍️ **Product Catalog** | Browse and manage agricultural products |
| 🎁 **Points & Rewards** | Gamified loyalty system with point redemption |
| 🔔 **Real-time Notifications** | Stay updated with marketplace activities |
| 👤 **User Profile Management** | Manage personal information and preferences |

---

## ✨ Features

### Authentication & Authorization
- Secure JWT-based authentication
- Role-based access control (RBAC)
- Password reset and change functionality
- Route guards for protected pages

### Dashboard Modules

| Role | Dashboard Features |
|------|-------------------|
| **Grower** | Crop management, participation tracking, event registration |
| **Manufacturer** | Product listings, inventory management, supply chain tracking |
| **Retailer** | Product sourcing, order management, retailer-specific analytics |
| **Admin** | User management, event administration, system analytics |

### Event System
- Create and manage agricultural events
- Event participation tracking
- Event detail modal with comprehensive information

### Points & Rewards
- Earn points through platform participation
- Redeem points for rewards
- Transaction history tracking

---

## 🛠️ Tech Stack

### Core Framework
| Technology | Version | Purpose |
|------------|---------|---------|
| [Angular](https://angular.io/) | ^21.0.0 | Frontend framework |
| [TypeScript](https://www.typescriptlang.org/) | ~5.9.2 | Type-safe JavaScript |
| [RxJS](https://rxjs.dev/) | ~7.8.0 | Reactive programming |

### Server-Side Rendering (SSR)
| Technology | Version | Purpose |
|------------|---------|---------|
| [Angular SSR](https://angular.io/guide/ssr) | ^21.0.4 | Server-side rendering |
| [Express](https://expressjs.com/) | ^5.1.0 | Node.js server framework |

### Build & Development Tools
| Tool | Version | Purpose |
|------|---------|---------|
| [Angular CLI](https://cli.angular.io/) | ^21.0.4 | CLI for Angular |
| [Vitest](https://vitest.dev/) | ^4.0.8 | Unit testing |
| [JSDOM](https://github.com/jsdom/jsdom) | ^27.1.0 | DOM environment for testing |

### Additional Libraries
- **node-vibrant** - Extract prominent colors from images
- **Prettier** - Code formatting

---

## 📁 Folder Structure

```
frontend/
├── 📁 client/                          # Angular application root
│   ├── 📁 src/
│   │   ├── 📁 app/
│   │   │   ├── 📁 core/               # Core functionality
│   │   │   │   ├── 📁 guards/         # Route guards (auth, role-based)
│   │   │   │   ├── 📁 interceptors/   # HTTP interceptors
│   │   │   │   ├── 📁 models/         # TypeScript interfaces/models
│   │   │   │   ├── 📁 services/       # Business logic services
│   │   │   │   └── 📁 mock/           # Mock data for development
│   │   │   │
│   │   │   ├── 📁 pages/              # Page components
│   │   │   │   ├── 📁 login/          # Login page
│   │   │   │   ├── 📁 forgot-password/# Password recovery
│   │   │   │   ├── 📁 reset-password/ # Password reset
│   │   │   │   ├── 📁 change-password/# Password change
│   │   │   │   ├── 📁 grower-dashboard/# Grower dashboard
│   │   │   │   ├── 📁 manufacturer-dashboard/ # Manufacturer dashboard
│   │   │   │   ├── 📁 retailer-dashboard/     # Retailer dashboard
│   │   │   │   ├── 📁 admin-dashboard/        # Admin dashboard
│   │   │   │   ├── 📁 admin-users/     # User management
│   │   │   │   ├── 📁 admin-events/    # Event management
│   │   │   │   ├── 📁 admin-products/  # Product management
│   │   │   │   ├── 📁 admin-points/    # Points management
│   │   │   │   ├── 📁 admin-redemptions/# Redemption management
│   │   │   │   ├── 📁 admin-add-admin/ # Admin creation
│   │   │   │   ├── 📁 events/          # Event listing
│   │   │   │   ├── 📁 products/        # Product catalog
│   │   │   │   ├── 📁 transactions/    # Transaction history
│   │   │   │   ├── 📁 profile/         # User profile
│   │   │   │   └── 📁 unauthorized/    # 403 page
│   │   │   │
│   │   │   └── 📁 shared/             # Shared components
│   │   │       └── 📁 components/     # Reusable UI components
│   │   │           ├── 📁 admin-header/
│   │   │           ├── 📁 grower-navbar/
│   │   │           ├── 📁 retailer-navbar/
│   │   │           ├── 📁 notification-dropdown/
│   │   │           ├── 📁 filter-sidebar/
│   │   │           ├── 📁 event-detail-modal/
│   │   │           └── 📁 footer/
│   │   │
│   │   ├── 📁 environments/           # Environment configurations
│   │   │   ├── environment.ts         # Development environment
│   │   │   └── environment.prod.ts    # Production environment
│   │   │
│   │   ├── 📄 main.ts                 # Application entry point
│   │   ├── 📄 main.server.ts          # Server entry point (SSR)
│   │   ├── 📄 server.ts               # Express server setup
│   │   ├── 📄 index.html              # Main HTML template
│   │   └── 📄 styles.css              # Global styles
│   │
│   ├── 📁 public/                     # Static assets
│   │   ├── agdata_logo.svg            # Application logo
│   │   ├── adata_white.png            # White logo variant
│   │   └── favicon.ico                # Browser favicon
│   │
│   ├── 📄 angular.json                # Angular CLI configuration
│   ├── 📄 package.json                # Dependencies & scripts
│   ├── 📄 tsconfig.json               # TypeScript base config
│   ├── 📄 tsconfig.app.json           # TypeScript app config
│   ├── 📄 tsconfig.spec.json          # TypeScript test config
│   └── 📄 .editorconfig               # Editor configuration
│
├── 📄 .gitignore                      # Git ignore rules
├── 📄 .env.example                    # Environment variables template
└── 📄 README.md                       # This file
```

---

## 🚀 Setup Instructions

### Prerequisites

Ensure you have the following installed:

| Requirement | Version | Download |
|-------------|---------|----------|
| Node.js | ^18.19.1 or ^20.11.0 | [Download](https://nodejs.org/) |
| npm | ^11.6.2 | Included with Node.js |
| Angular CLI | ^21.0.4 | `npm install -g @angular/cli` |
| Git | Latest | [Download](https://git-scm.com/) |

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/Legend-Raj/Agrimartet.git
   cd Agrimartet
   ```

2. **Navigate to the client directory**
   ```bash
   cd client
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Set up environment variables (Optional for development)**
   ```bash
   # Copy the example environment file
   cp ../.env.example ../.env
   
   # Edit .env with your configuration
   # Note: Development uses mock API by default
   ```

---

## 🔧 Environment Variables

The application uses environment-specific configuration files located in `client/src/environments/`.

### Development Environment (`environment.ts`)

```typescript
{
  production: false,
  apiUrl: 'https://your-dev-api.azurewebsites.net',
  useMockApi: true,        // Set to false to use real backend
  tokenKey: 'marketplace_access_token',
  refreshTokenKey: 'marketplace_refresh_token',
  userKey: 'marketplace_user',
  appName: 'AgriMarket'
}
```

### Production Environment (`environment.prod.ts`)

```typescript
{
  production: true,
  apiUrl: 'https://your-prod-api.azurewebsites.net',
  useMockApi: false,       // Always false in production
  tokenKey: 'marketplace_access_token',
  refreshTokenKey: 'marketplace_refresh_token',
  userKey: 'marketplace_user',
  appName: 'AgriMarket'
}
```

### Important Notes

- 🔴 **Never commit sensitive API keys or credentials**
- 🟡 Use mock API (`useMockApi: true`) for frontend development without backend
- 🟢 Update `apiUrl` to point to your actual backend API when ready

---

## ▶️ Running the Project

### Development Server

Start the development server with hot reload:

```bash
cd client
npm start
```

The application will be available at:
- 🌐 **URL**: http://localhost:4200/
- 🔄 **Live Reload**: Enabled

### Available Development Accounts

When using mock API (`useMockApi: true`), you can log in with:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@agrimarket.com | admin123 |
| Grower | grower@agrimarket.com | grower123 |
| Manufacturer | manufacturer@agrimarket.com | manufacturer123 |
| Retailer | retailer@agrimarket.com | retailer123 |

### Running Tests

Execute unit tests:

```bash
npm test
```

### Server-Side Rendering (SSR) Development

To test SSR locally:

```bash
# Build the application
npm run build

# Serve with SSR
npm run serve:ssr:client
```

---

## 📦 Building for Production

### Standard Production Build

```bash
cd client
npm run build
```

Output will be in `client/dist/client/` directory.

### Production Build with Optimization

```bash
npm run build -- --configuration production
```

### Build Outputs

| Directory | Contents |
|-----------|----------|
| `dist/client/browser/` | Client-side bundle |
| `dist/client/server/` | Server-side bundle (SSR) |

### Deploying to Azure

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Deploy the `dist/client/browser` folder to Azure Static Web Apps**
   
   Or for SSR deployment, deploy the entire `dist/client` folder to Azure App Service.

---

## 🔌 API Integration

### Mock API Mode

By default, the application runs with `useMockApi: true`, which uses mock data from `client/src/app/core/mock/mock-data.ts`.

### Switching to Real Backend

1. Update `client/src/environments/environment.ts`:
   ```typescript
   useMockApi: false,
   apiUrl: 'https://your-actual-api.com'
   ```

2. Restart the development server

### API Services

| Service | File Path | Description |
|---------|-----------|-------------|
| Auth Service | `core/services/auth.service.ts` | Authentication operations |
| Dashboard Service | `core/services/dashboard.service.ts` | Dashboard data |
| Participation Service | `core/services/participation.service.ts` | Event participation |
| Notification Service | `core/services/notification.service.ts` | Notifications |
| Admin Service | `core/services/admin.service.ts` | Admin operations |

---

## 🤝 Contributing

We welcome contributions to AgriMarket! Please follow these guidelines:

### Getting Started

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

### Code Style

- Use **Prettier** for code formatting
- Follow Angular style guidelines
- Use TypeScript strict mode
- Write meaningful commit messages

### Commit Message Format

```
type(scope): subject

body (optional)

footer (optional)
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Example:
```
feat(auth): add password reset functionality

- Implement forgot password page
- Add email verification step
- Update auth service with reset method
```

### Pull Request Process

1. Ensure your code follows the existing style
2. Update documentation if needed
3. Test your changes thoroughly
4. Create a PR with a clear description

---

## 📄 License

This project is licensed under the MIT License - see below for details:

```
MIT License

Copyright (c) 2026 AgriMarket

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🙏 Acknowledgments

- Built with [Angular](https://angular.io/)
- Powered by [Node.js](https://nodejs.org/)
- Icons and branding by the AgriMarket team

---

<p align="center">
  <b>🌾 Made with ❤️ for the Agricultural Community 🌾</b>
</p>

<p align="center">
  <a href="https://github.com/Legend-Raj/Agrimartet">⭐ Star this repo if you find it helpful!</a>
</p>
