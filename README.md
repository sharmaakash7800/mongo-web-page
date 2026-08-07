# R2D Database Web Portal (MongoDB Atlas Connected)

Welcome! This application connects your **MongoDB Atlas database (`R2D`)** directly to a modern web page dashboard.

---

## 📁 Project Structure

- `server.js` - Express backend server with MongoDB Mongoose schemas & REST APIs.
- `public/index.html` - Premium interactive web dashboard UI.
- `public/style.css` - Custom dark mode CSS with glassmorphism & responsive grid.
- `public/app.js` - Frontend logic for sending & fetching live data to/from MongoDB Atlas.
- `.env` - Environment variables (MongoDB connection string & port).
- `.gitignore` - Prevents uploading `.env` and `node_modules` to GitHub.

---

## 🚀 How to Run & Connect

### Step 1: Add your MongoDB Atlas Connection String
1. Open [cloud.mongodb.com](https://cloud.mongodb.com) and log into your Atlas account.
2. Click **Connect** on `Cluster0` -> choose **Drivers** (Node.js).
3. Copy the URI string (looks like `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/R2D?retryWrites=true&w=majority`).
4. Open `.env` file in this folder and replace `MONGODB_URI` with your actual connection string.

### Step 2: Install Node.js & Run Locally
1. Download & Install [Node.js](https://nodejs.org/).
2. Open terminal/command prompt in this directory (`mongo db test`).
3. Run:
   ```bash
   npm install
   npm start
   ```
4. Open your browser at: `http://localhost:3000`

---

## 🌐 Upload to GitHub & Host Online (Render / Vercel)

### Push to GitHub:
```bash
git init
git add .
git commit -m "Initial MongoDB Web Application"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

### Host for free on Render.com:
1. Sign up at [Render.com](https://render.com).
2. Click **New Web Service** -> Connect your GitHub repository.
3. Build Command: `npm install`
4. Start Command: `node server.js`
5. In **Environment Variables**, add `MONGODB_URI` = your connection string.
6. Click **Deploy**! Your web app will now be live on the internet!
