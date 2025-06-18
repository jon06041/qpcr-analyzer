# qPCR Analyzer - Production Deployment Guide

## Quick Deploy Options (Choose One)

### 🚀 Option 1: Railway (Recommended - Free Tier Available)

1. **Sign up** at [railway.app](https://railway.app)
2. **Connect GitHub**: Link your GitHub account
3. **Deploy from GitHub**:
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository (fork this repo to your GitHub first)
   - Railway will auto-detect it's a Python app
4. **Add Database**:
   - Click "New" → "Database" → "PostgreSQL"
   - Railway will automatically set DATABASE_URL environment variable
5. **Deploy**: Your app will be live in minutes with a public URL!

### 🚀 Option 2: Render (Also Free Tier)

1. **Sign up** at [render.com](https://render.com)
2. **Create Web Service**:
   - Click "New" → "Web Service"
   - Connect your GitHub repository
3. **Configure**:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
   - **Python Version**: 3.12
4. **Add Database**:
   - Create new PostgreSQL database service
   - Copy connection string to environment variables
5. **Environment Variables**:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `FLASK_SECRET_KEY`: Any random string for security

### 🚀 Option 3: Heroku (Requires Credit Card)

1. **Sign up** at [heroku.com](https://heroku.com)
2. **Install Heroku CLI** (optional, can use web interface)
3. **Create App**:
   - New app on Heroku dashboard
   - Connect GitHub repository
4. **Add PostgreSQL**:
   - Go to Resources tab
   - Add "Heroku Postgres" addon
5. **Deploy**: Enable automatic deployments from GitHub

## Files Ready for Deployment ✅

Your project now includes:
- ✅ `Procfile` - Tells hosting platform how to run your app
- ✅ `requirements.txt` - Lists all Python dependencies
- ✅ Production-ready Flask configuration
- ✅ Database configuration with environment variables

## 🔧 Environment Variables Needed

Set these in your hosting platform:

- `DATABASE_URL`: PostgreSQL connection string (auto-set by database addon)
- `FLASK_SECRET_KEY`: Random string for session security (optional)

## 📝 Next Steps

1. **Push to GitHub** (if not already done)
2. **Choose a hosting platform** from above
3. **Deploy your repository**
4. **Your app will be live** with a public URL!

## 🌐 Your App Features

Once deployed, your app will have:
- Public URL accessible from anywhere
- Automatic SSL/HTTPS security
- PostgreSQL database for storing analysis results
- File upload and qPCR curve analysis
- Responsive web interface

## Need Help?

- Check the hosting platform's documentation
- Most platforms auto-detect Flask apps and deploy automatically
- Database connections are typically handled automatically
