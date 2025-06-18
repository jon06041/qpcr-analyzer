# qPCR S-Curve Analyzer

A sophisticated web-based application for analyzing qPCR (quantitative Polymerase Chain Reaction) amplification curves. The system automatically identifies S-shaped amplification patterns and provides comprehensive quality metrics with database storage for historical analysis.

## Features

### Core Analysis
- **Variable Cycle Support**: Handles 30+ PCR cycles (30, 35, 38, 40, 45+ cycles)
- **Sigmoid Curve Fitting**: Mathematical modeling using scipy optimization
- **Quality Metrics**: R² score, RMSE, amplitude, steepness analysis
- **Anomaly Detection**: Identifies common qPCR problems automatically
- **Adaptive Parameters**: Dynamic fitting bounds based on data characteristics

### User Interface
- **Drag & Drop Upload**: Easy CSV file handling
- **Interactive Charts**: Real-time curve visualization with Chart.js
- **Responsive Design**: Mobile-friendly interface
- **Export Functionality**: Download results as CSV

### Database Features
- **Analysis History**: PostgreSQL storage of all analysis sessions
- **Session Management**: View, reload, and delete past analyses
- **Comprehensive Storage**: Raw data, fitted curves, and metadata
- **Data Integrity**: Robust validation and error handling

## 🌐 Deploy to Share Publicly

### Option 1: Deploy to Heroku (Recommended)
1. **Create Heroku account** at [heroku.com](https://heroku.com)
2. **Fork this repository** to your GitHub account
3. **Connect to Heroku**:
   - Create new app on Heroku dashboard
   - Connect your GitHub repository
   - Add PostgreSQL addon: `heroku addons:create heroku-postgresql:hobby-dev`
4. **Deploy**: Heroku will automatically detect and deploy your Flask app
5. **Share the URL**: Your app will be live at `https://your-app-name.herokuapp.com`

### Option 2: Deploy to Railway
1. Visit [railway.app](https://railway.app) and sign up
2. Click "Deploy from GitHub repo"
3. Select your forked repository
4. Add PostgreSQL database from Railway's addon marketplace
5. Your app will be deployed automatically with a public URL

### Option 3: Deploy to Render
1. Visit [render.com](https://render.com) and create account
2. Create new "Web Service" from your GitHub repo
3. Add PostgreSQL database service
4. Use these settings:
   - **Build Command**: `pip install -r deploy-requirements.txt`
   - **Start Command**: `gunicorn app:app`
5. Your public URL will be provided after deployment

## 💻 Local Installation

### Prerequisites
- Python 3.11+
- PostgreSQL database
- Modern web browser

### Dependencies
```bash
pip install flask flask-sqlalchemy psycopg2-binary numpy scipy matplotlib scikit-learn pandas
```

### Environment Variables
```bash
DATABASE_URL=postgresql://username:password@localhost/qpcr_db
FLASK_SECRET_KEY=your_secret_key_here
```

## Quick Start

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/qpcr-analyzer.git
cd qpcr-analyzer
```

2. **Install dependencies**
```bash
pip install -r requirements.txt
```

3. **Set up database**
```bash
export DATABASE_URL="your_postgresql_url"
```

4. **Run the application**
```bash
python app.py
```

5. **Open browser**
Navigate to `http://localhost:5000`

## Usage

### Uploading Data
1. Export your qPCR data from CFX Manager as CSV
2. Drag and drop the file or click to browse
3. Click "Analyze Curves" to process

### Understanding Results
- **Good S-Curves**: High R² score (>0.9), proper amplitude and steepness
- **Quality Metrics**: Mathematical parameters describing curve shape
- **Anomaly Detection**: Automated identification of common issues

### Managing History
- View all past analyses in the History section
- Click any session to reload detailed results
- Delete individual sessions or clear all history

## File Structure

```
qpcr-analyzer/
├── app.py              # Flask application and API endpoints
├── models.py           # Database models for SQLAlchemy
├── qpcr_analyzer.py    # Core analysis engine
├── index.html          # Main application interface
├── static/
│   ├── style.css       # Application styling
│   └── script.js       # Frontend functionality
└── README.md          # This file
```

## API Endpoints

### Analysis
- `POST /analyze` - Process qPCR data and store results
- `GET /health` - Application health check

### Database
- `GET /sessions` - List all analysis sessions
- `GET /sessions/<id>` - Get detailed session results
- `DELETE /sessions/<id>` - Delete specific session

## Data Format

### Input CSV Structure
```
Cycle,Well_A01,Well_A02,Well_A03,...
1,100.5,98.2,102.1,...
2,105.3,103.7,108.9,...
...
```

### Analysis Output
```json
{
  "individual_results": {
    "Well_A01": {
      "r2_score": 0.9856,
      "rmse": 12.3,
      "amplitude": 2847.5,
      "steepness": 0.847,
      "is_good_scurve": true,
      "anomalies": []
    }
  },
  "cycle_info": {
    "min": 1,
    "max": 40,
    "count": 40
  }
}
```

## Technical Details

### Analysis Algorithm
1. **Data Validation**: Checks cycle/RFU data integrity
2. **Parameter Estimation**: Dynamic initial guesses based on data
3. **Curve Fitting**: Scipy optimization with adaptive bounds
4. **Quality Assessment**: Multiple metrics for curve evaluation
5. **Anomaly Detection**: Pattern recognition for common issues

### Database Schema
- **AnalysisSession**: Metadata for each analysis run
- **WellResult**: Detailed results for individual wells

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is open source. Please check the license file for details.

## Support

For issues or questions:
1. Check the documentation
2. Review existing issues
3. Create a new issue with detailed information

## Acknowledgments

Built with modern web technologies:
- Flask (Python web framework)
- PostgreSQL (Database)
- Chart.js (Visualization)
- NumPy/SciPy (Scientific computing)
- Bootstrap-inspired responsive design