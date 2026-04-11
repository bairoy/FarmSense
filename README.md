# FarmSense 🌾

**A comprehensive farm management system designed to help farmers optimize crop production, track irrigation & fertilizer usage, and monitor crop health efficiently.**

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Project Structure](#project-structure)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [Project Roadmap](#project-roadmap)
- [Contributing](#contributing)

---

## 📖 Overview

**FarmSense** is an intelligent farm management platform that enables farmers to:

- Efficiently manage multiple fields and crop instances
- Track irrigation and fertilizer applications with precise dates and quantities
- Monitor crop health status through image analysis
- Access comprehensive dashboards for better decision-making
- Maintain detailed records for compliance and optimization

The platform is built with a **modern full-stack architecture** using TypeScript, Express.js for the backend, React for the frontend, and Python (FastAPI + PyTorch) for AI-powered disease detection, with Supabase as the database and authentication provider.

---

## ✨ Key Features

### 🔐 **Authentication & User Management**

- Secure user registration and login
- JWT-based token authentication with refresh token mechanism
- Protected routes and role-based access control
- User profile management

### 🌾 **Field Management**

- Create and manage multiple agricultural fields
- Store field information (location, area, soil type)
- View field-wise crop history
- Track field-specific metrics

### 🌱 **Crop Management**

- Create crop instances for each field
- Record crop type, sowing date, and irrigation method
- Monitor crop status (healthy, stressed, diseased, harvested)
- Track multiple crops per field
- Detailed crop history and timeline

### 💧 **Irrigation Tracking**

- Record irrigation actions with date and water quantity
- Track irrigation history for each crop
- Analyze water usage patterns
- Generate irrigation reports for optimization

### 🧪 **Fertilizer Management**

- Log fertilizer applications (type, quantity, date)
- Maintain fertilizer usage history per crop
- Track multiple fertilizer types
- Optimize fertilizer usage for better yields

### 📸 **Crop Health Monitoring (AI)**
- Upload crop images for analysis
- AI-powered health status detection
- Confidence scoring for predictions
- Track health status history over time

### 🤖 **Conversational AI Farm Assistant**
- Interactive NLP chat widget integrated into crop details pages
- Powered by LangChain, LangGraph, and OpenAI GPT-3.5
- Context-aware discussions combining real-time crop, fertilizer, and irrigation history
- Tool-based querying connecting directly to the Node.js backend

### 📊 **Dashboard & Analytics**

- Overview of all fields and active crops
- Quick access to key metrics
- Recent activity tracking
- Intuitive user interface with Tailwind CSS

---

## 📁 Project Structure

```
FarmSense/
├── backend/                          # Express.js REST API
│   ├── src/
│   │   ├── app.ts                   # Express app configuration
│   │   ├── server.ts                # Server entry point
│   │   ├── config/
│   │   │   └── supabase.ts          # Supabase client setup
│   │   ├── middlewares/
│   │   │   └── auth.middleware.ts   # JWT authentication middleware
│   │   ├── modules/                 # Feature modules
│   │   │   ├── auth/                # Authentication module
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.routes.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   └── auth.validation.ts
│   │   │   ├── fields/              # Field management
│   │   │   ├── crops/               # Crop management
│   │   │   ├── crop-state/          # Crop health status
│   │   │   ├── irrigation/          # Irrigation tracking
│   │   │   ├── fertilizer/          # Fertilizer management
│   │   │   ├── images/              # Image upload & analysis
│   │   │   └── users/               # User management
│   │   ├── types/
│   │   │   ├── database.types.ts    # Auto-generated Supabase types
│   │   │   └── express.d.ts         # Express type extensions
│   │   └── utils/
│   │       └── apiResponse.ts       # API response utilities
│   ├── supabase/
│   │   └── config.toml              # Supabase configuration
│   └── package.json
│
├── farmsense-frontend/              # React + Vite frontend
│   ├── src/
│   │   ├── main.tsx                 # React entry point
│   │   ├── app/
│   │   │   └── App.tsx              # Main app component with routing
│   │   ├── components/              # Reusable UI components
│   │   │   ├── Header.tsx
│   │   │   ├── layout/              # Layout components
│   │   │   └── routes/              # Route guards
│   │   ├── features/                # Feature modules
│   │   │   ├── auth/                # Authentication UI
│   │   │   ├── dashboard/           # Dashboard pages
│   │   │   ├── fields/              # Field management UI
│   │   │   ├── crops/               # Crop management UI
│   │   │   ├── irrigation/          # Irrigation UI
│   │   │   └── fertilizer/          # Fertilizer UI
│   │   ├── services/
│   │   │   └── api.ts               # Axios HTTP client setup
│   │   ├── store/
│   │   │   └── authStore.ts         # Zustand auth store
│   │   └── types/                   # TypeScript type definitions
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── ai/                              # AI Service for Disease & NLP Chat
│   ├── api.py                       # FastAPI application
│   ├── chat_service.py              # LangGraph Chat Agent
│   ├── tools.py                     # AI Tools fetching Backend Data
│   ├── disease_model.py             # PyTorch model integration
│   ├── rice_model.pth               # Trained PyTorch ResNet18 model
│   ├── requirements.txt             # Python dependencies
│   └── .env                         # Environment Variables (OpenAI Keys)
│
└── README.md
```

---

## 🛠️ Technology Stack

### **Backend**

- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js ^5.2.1 - Modern web framework
- **Database:** Supabase (PostgreSQL) - Cloud database with authentication
- **Authentication:** JWT tokens via Supabase Auth
- **Validation:** Zod ^4.3.6 - Runtime schema validation
- **Date Handling:** date-fns ^4.1.0 - Utility libraries for date operations
- **CORS:** cors ^2.8.6 - Cross-origin request handling
- **Environment:** dotenv ^17.2.3 - Environment variable management
- **Dev Tools:** Nodemon - Auto-restart during development

### **AI Service**

- **Language:** Python 3.12+
- **Framework:** FastAPI - High-performance API framework
- **NLP & Agents:** LangChain & LangGraph - Conversational AI flow
- **LLMs:** OpenAI GPT APIs - Core intelligence engine
- **Machine Learning:** PyTorch & Torchvision - Deep learning for computer vision
- **Image Processing:** Pillow (PIL) - Image manipulation

### **Frontend**

- **Library:** React 19.2.0 - UI building
- **Build Tool:** Vite 7.3.1 - Ultra-fast build tool
- **Language:** TypeScript ~5.9.3 - Type-safe JavaScript
- **Routing:** react-router-dom 7.13.0 - Client-side routing
- **State Management:** Zustand 5.0.11 - Lightweight state management
- **HTTP Client:** axios 1.13.5 - Promise-based HTTP client
- **Styling:** Tailwind CSS 4.1.18 - Utility-first CSS framework
- **UI Icons:** lucide-react 0.575.0 - Beautiful SVG icons
- **Linting:** ESLint 9.39.1 - Code quality

### **Database Schema (Supabase PostgreSQL)**

- **users** - User accounts and profile
- **fields** - Agricultural field metadata
- **crop_instances** - Crop plantings
- **crop_states** - Crop health status history
- **irrigation_actions** - Irrigation records
- **fertilizer_actions** - Fertilizer applications
- **crop_images** - Crop health images with AI analysis results

---

## 🚀 Getting Started

### **Prerequisites**

- Node.js 16+ and npm/yarn
- Supabase account (https://supabase.com)
- Environment variables setup

### **Backend Setup**

1. **Navigate to backend directory:**

   ```bash
   cd backend
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Create `.env` file with Supabase credentials:**

   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_PUBLISHABLE_OR_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```
   The API will run on `http://localhost:3000`

### **AI Service Setup**

1. **Navigate to ai directory:**

   ```bash
   cd ai
   ```

2. **Create and activate a virtual environment (optional but recommended):**

   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\\Scripts\\activate
   ```

3. **Install dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

4. **Create `.env` file with OpenAI credentials:**

   ```env
   OPENAI_API_KEY=your_openai_api_key
   ```

5. **Start the FastAPI server:**

   ```bash
   uvicorn api:app --reload --port 8000
   ```
   The AI API will run on `http://localhost:8000` (API docs at `http://localhost:8000/docs`)

### **Frontend Setup**

1. **Navigate to frontend directory:**

   ```bash
   cd farmsense-frontend
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start development server:**

   ```bash
   npm run dev
   ```

   The frontend will run on `http://localhost:5173`

4. **Build for production:**
   ```bash
   npm run build
   ```

---

## 📡 API Documentation

### **Authentication Endpoints**

```
POST   /api/auth/signup      - Register new user
POST   /api/auth/signin      - Login user
POST   /api/auth/refresh     - Refresh access token
```

### **Field Management**

```
GET    /api/fields           - Get all user fields
POST   /api/fields           - Create new field
GET    /api/fields/:id       - Get field details
PUT    /api/fields/:id       - Update field
DELETE /api/fields/:id       - Delete field
```

### **Crop Management**

```
POST   /api/crops            - Create crop instance
GET    /api/crops/:fieldId   - Get crops by field
GET    /api/crops/:cropId    - Get crop details
PUT    /api/crops/:cropId    - Update crop
DELETE /api/crops/:cropId    - Delete crop
```

### **Crop Health Status**

```
GET    /api/crop-states/:cropId     - Get crop health history
POST   /api/crop-states             - Add health status
DELETE /api/crop-states/:stateId    - Remove status
```

### **Irrigation Tracking**

```
POST   /api/irrigation              - Record irrigation action
GET    /api/irrigation/:cropId      - Get irrigation history
DELETE /api/irrigation/:irrigationId - Remove irrigation record
```

### **Fertilizer Management**

```
POST   /api/fertilizer              - Record fertilizer application
GET    /api/fertilizer/:cropId      - Get fertilizer history
DELETE /api/fertilizer/:fertilizerId - Remove fertilizer record
```

### **AI Analysis & Chat (FastAPI)**

```
POST   /detect-disease              - Analyze crop image (Requires form-data with 'file')
POST   /chat                        - Send NLP chat request to LangGraph Agent
```

**Backend endpoints require JWT authentication** via `Authorization: Bearer <token>` header.

---

## 🗺️ Project Roadmap

### **Version 1.0 - Current** ✅

- [x] User authentication & authorization
- [x] Field management (CRUD)
- [x] Crop instance tracking
- [x] Irrigation action logging
- [x] Fertilizer application tracking
- [x] User dashboard
- [x] Basic CRUD operations for all modules
- [x] Input validation with Zod
- [x] Responsive UI with Tailwind CSS
- [x] **AI-Powered Crop Health Detection (PyTorch & FastAPI)**
  - Crop disease detection (Brown Spot, Hispa, Leaf Blast)
  - Confidence scoring for predictions

### **Version 1.1 - Planned** 🔄

- [ ] **Advanced Analytics Dashboard**
  - Charts and graphs for water usage trends
  - Fertilizer cost analysis
  - Yield predictions based on history
  - Field-wise performance comparison

- [ ] **AI Integration Expansion**
  - Automated health status updates in UI
  - Integration of FastAPI service with backend logic
  - Broader crop disease coverage

- [ ] **Mobile Responsive Improvements**
  - Mobile-optimized interface
  - Offline capability for crop tracking
  - Mobile app (React Native) consideration

### **Version 1.2 - Future** 🌟

- [ ] **Weather Integration**
  - Real-time weather data API integration
  - Rainfall forecasting
  - Irrigation recommendations based on weather
  - Temperature and humidity tracking

- [ ] **Notification System**
  - Push notifications for critical events
  - Email alerts for important actions
  - SMS notifications for urgent issues
  - Customizable alert preferences

- [ ] **Compliance & Reporting**
  - Generate compliance reports
  - Export data to PDF/Excel
  - Audit logs for all operations
  - Data backup and recovery

- [ ] **Multi-language Support**
  - Localization for different regions
  - Support for regional languages
  - Currency and unit customization

### **Version 2.0 - Long-term Vision** 🚀

- [ ] **Machine Learning Integration**
  - Predictive yield models
  - Optimal fertilizer recommendations
  - Smart irrigation scheduling
  - Market price predictions

- [ ] **IoT Device Integration**
  - Soil moisture sensors
  - Weather stations
  - Irrigation system automation
  - Real-time data synchronization

- [ ] **Marketplace Features**
  - Buy/sell crops locally
  - Equipment rental marketplace
  - Agricultural input purchasing
  - Farmer-to-farmer knowledge sharing

- [ ] **Community & Social**
  - Farmer community forums
  - Best practices sharing
  - Expert consultation booking
  - Group purchasing discounts

---

## 🔒 Security Considerations

- **JWT Token Security:** Tokens stored securely with refresh token rotation
- **Request Validation:** All inputs validated with Zod schema validation
- **CORS Configuration:** Restricted to trusted origins
- **Protected Routes:** All authenticated endpoints require valid JWT
- **User Data Isolation:** Queries filtered by user_id for data privacy
- **Supabase RLS:** Row-level security policies on database tables

---

## 📝 Development Standards

### **Naming Conventions**

- Backend: PascalCase for types, camelCase for variables/functions
- Frontend: PascalCase for components, camelCase for utilities
- Database: snake_case for tables and columns

### **Code Organization**

- Modular structure with separation of concerns (Controller, Service, Routes, Validation)
- Feature-based folder organization
- Reusable components and utilities
- Type-safe TypeScript throughout

### **Error Handling**

- Centralized error handling middleware
- Meaningful error messages
- Proper HTTP status codes
- Validation error responses with field details

---

## 🤝 Contributing

We welcome contributions to FarmSense! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure:

- Code follows project conventions
- TypeScript types are properly defined
- Validation rules are implemented
- Appropriate error handling is included

---

## 📞 Support & Contact

For issues, questions, or suggestions:

- Open an issue on GitHub
- Email us for support

---

## 📄 License

This project is licensed under the ISC License - see LICENSE file for details.

---

## 🙏 Acknowledgments

- **Supabase** - Backend as a Service platform
- **React Team** - UI library
- **Express.js** - Web framework
- **Tailwind CSS** - Utility-first CSS framework
- All open-source contributors and the agriculture tech community

---

**Happy Farming! 🌽🥕🥬**

_Last Updated: March 2026_
_Version: 1.0.0_
