# 🚀 AccessibilityAI Pro: Advanced WCAG Compliance Analyzer

A full-stack accessibility auditing tool using Puppeteer and Axe-core to ensure WCAG compliance with modern CI/CD and Docker support.

---

## 📚 Table of Contents

1. [Introduction](#1-introduction)  
2. [Features](#2-features)  
3. [Technologies Used](#3-technologies-used)  
4. [Getting Started](#4-getting-started)  
5. [Authentication](#5-authentication)  
6. [CI/CD Pipeline](#6-cicd-pipeline)  
7. [Project Structure](#7-project-structure)  
8. [Future Enhancements](#8-future-enhancements)  
9. [Contributing](#9-contributing)  
10. [License](#10-license)  
11. [Contact](#11-contact)  

---

## 1. Introduction

**AccessibilityAI Pro** is a comprehensive web application designed to analyze website accessibility based on WCAG (Web Content Accessibility Guidelines). It uses **Puppeteer** for browser automation and **Axe-core** for accessibility auditing. It includes detailed reports, secure user authentication, and history tracking — all backed by a Dockerized MERN architecture.

---

## 2. Features

- 🌐 **Website Accessibility Analysis** with Axe-core  
- 📊 **Detailed Reports** with issue breakdowns  
- 💡 **Code Suggestions** (Before & After fixes)  
- 🏷️ **Category Breakdown** (Color, Contrast, Media, Forms, etc.)  
- 📄 **PDF Export** of audit results  
- 🔐 **JWT-Based Authentication**  
- 📜 **User-Specific Analysis History**  
- 📱 **Responsive UI**  
- 🐳 **Dockerized Environment**  
- 🚀 **CI/CD via GitHub Actions**

---

## 3. Technologies Used

### Frontend
- React.js
- Tailwind CSS
- Lucide React
- jsPDF, html2canvas

### Backend
- Node.js + Express.js
- Puppeteer + Axe-core
- Mongoose
- bcryptjs, JWT, express-validator

### Database
- MongoDB

### DevOps
- Docker, Docker Compose
- GitHub Actions

---

## 4. Getting Started

### 🔧 Prerequisites

- Git
- Node.js 18+ & npm
- Docker Desktop
- MongoDB (if running locally)
- GitHub + Docker Hub accounts

---

### 🖥️ Local Development Setup
Step 2: Backend Setup

 
npm install
Create .env in backend/:

env
 
PORT=3001
MONGODB_URI= 
JWT_SECRET= 
NODE_ENV= 
Start MongoDB and backend server:

 
npm start
Step 3: Frontend Setup

 
cd ../accessibility-analyzer
npm install
Create .env in accessibility-analyzer/:

 
REACT_APP_API_URL=http://localhost: 
Start the frontend:

 
npm start
Visit: http://localhost 

🐳 Dockerized Setup (Recommended)
Create root .env (next to docker-compose.yml):

 
JWT_SECRET=your_super_secret_jwt_key
# Optional
 MONGO_INITDB_ROOT_USERNAME= 
 MONGO_INITDB_ROOT_PASSWORD= 
Run All Services:

 
docker compose up --build -d
Then visit: http://localhost 

5. Authentication
Registration/Login via username & password

JWT Tokens are issued and stored in localStorage

All scan history is tied to user ID in MongoDB

6. CI/CD Pipeline
GitHub Actions runs a build on every push to main.


 

 

 

7. Project Structure
 
.
├── .github/workflows/main-ci-cd.yml
├── backend/
│   ├── Dockerfile
│   ├── server.js
│   └── .env.example
├── accessibility-analyzer/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── .env.example
├── docker-compose.yml
└── .gitignore
8. Future Enhancements
📈 Customizable reports with charts

📅 Historical trends for re-audits

🧪 Device & viewport testing

📦 Batch scanning support

🛠 Admin dashboard

☁️ Deployment automation for cloud providers

9. Contributing
We welcome contributions!
Please open issues or submit pull requests if you'd like to help improve this project.

10. License
This project is licensed under the MIT License.

11. Contact
📧 Created by Anuj Gadekar
Feel free to reach out for questions, suggestions, or collaboration.

 
