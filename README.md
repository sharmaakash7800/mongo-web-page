# R2D Database Web Portal (MongoDB Atlas Connected)

Welcome! This application connects your **MongoDB Atlas database (`R2D`)** directly to a modern web page dashboard.

---

## 📁 Project Structure

- `server.js` - Express backend server with MongoDB Mongoose schemas & REST APIs.
- `index.html` / `public/index.html` - Premium interactive web dashboard UI.
- `style.css` / `public/style.css` - Custom dark mode CSS with glassmorphism & responsive grid.
- `app.js` / `public/app.js` - Dynamic frontend logic supporting auto-detection of backend API & GitHub Pages hosting.
- `.env` - Environment variables (MongoDB connection string & port).
- `.gitignore` - Prevents uploading `.env` and `node_modules` to GitHub.

---

## 🚀 How to Run & Connect

### Step 1: Add your MongoDB Atlas Connection String
1. Open [cloud.mongodb.com](https://cloud.mongodb.com) and log into your Atlas account.
2. Click **Connect** on `Cluster0` -> choose **Drivers** (Node.js).
3. Copy the URI string (looks like `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/R2D?retryWrites=true&w=majority`).
4. Open `.env` file in this folder and verify `MONGODB_URI`.

### Step 2: Run Backend Server Locally
1. Open terminal/command prompt in this directory (`mongo db test`).
2. Run:
   ```bash
   npm install
   npm start
   ```
3. Open your browser at: `http://localhost:3000`

---

## 🌐 Using with GitHub Pages (`sharmaakash7800.github.io/mongo_web_page/`)

GitHub Pages hosts static HTML/JS files. Since GitHub Pages does not run Node.js backend servers natively:

1. **Option A: Connect GitHub Pages to your Local Machine**
   - Keep `npm start` running locally on your computer (`http://localhost:3000`).
   - Open your GitHub Pages site (`sharmaakash7800.github.io/mongo_web_page/`).
   - The web page will auto-detect and connect to `http://localhost:3000`, fetching live data directly from MongoDB Atlas!
   - You can also click **"Server URL"** in the top bar to set or test `http://localhost:3000`.

2. **Option B: Host Backend Cloud API (Render / Railway / Vercel)**
   - Deploy `server.js` for free on Render.com or Railway.
   - Click **"Server URL"** on your GitHub Pages dashboard and enter your backend service URL (e.g. `https://your-api.onrender.com`).
