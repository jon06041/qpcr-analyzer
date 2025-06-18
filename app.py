from flask import Flask, request, jsonify, send_from_directory
import json
import os
from qpcr_analyzer import process_csv_data, validate_csv_structure
from models import db, AnalysisSession, WellResult
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY") or "qpcr_analyzer_secret_key_2025"
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL")
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}

db.init_app(app)

with app.app_context():
    db.create_all()

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

@app.route('/analyze', methods=['POST'])
def analyze_data():
    """Endpoint to analyze qPCR data and save results to database"""
    try:
        # Get JSON data from request
        data = request.get_json()
        filename = request.headers.get('X-Filename', 'unknown.csv')
        
        if not data:
            return jsonify({'error': 'No data provided', 'success': False}), 400
        
        # Validate data structure
        errors, warnings = validate_csv_structure(data)
        
        if errors:
            return jsonify({
                'error': 'Data validation failed',
                'validation_errors': errors,
                'validation_warnings': warnings,
                'success': False
            }), 400
        
        # Process the data
        results = process_csv_data(data)
        
        if not results.get('success', False):
            return jsonify(results), 500
        
        # Save results to database
        try:
            session = AnalysisSession(
                filename=filename,
                total_wells=results['summary']['total_wells'],
                good_curves=results['summary']['good_curves'],
                success_rate=results['summary']['success_rate'],
                cycle_min=results['cycle_info']['min'] if results.get('cycle_info') else None,
                cycle_max=results['cycle_info']['max'] if results.get('cycle_info') else None,
                cycle_count=results['cycle_info']['count'] if results.get('cycle_info') else None
            )
            
            db.session.add(session)
            db.session.flush()  # Get the session ID
            
            # Save individual well results
            for well_id, well_result in results['individual_results'].items():
                well_record = WellResult.from_analysis_result(
                    session.id, well_id, well_result, data.get(well_id, {})
                )
                db.session.add(well_record)
            
            db.session.commit()
            
            results['session_id'] = session.id
            
        except Exception as db_error:
            db.session.rollback()
            print(f"Database error: {db_error}")
            # Continue without database save - don't fail the analysis
            results['database_warning'] = 'Results analyzed but not saved to database'
        
        # Include validation warnings in successful response
        if warnings:
            results['validation_warnings'] = warnings
        
        return jsonify(results)
        
    except Exception as e:
        return jsonify({
            'error': f'Server error: {str(e)}',
            'success': False
        }), 500

@app.route('/sessions', methods=['GET'])
def get_sessions():
    """Get all analysis sessions"""
    try:
        sessions = AnalysisSession.query.order_by(AnalysisSession.upload_timestamp.desc()).all()
        return jsonify({
            'sessions': [session.to_dict() for session in sessions],
            'total': len(sessions)
        })
    except Exception as e:
        return jsonify({'error': f'Database error: {str(e)}'}), 500

@app.route('/sessions/<int:session_id>', methods=['GET'])
def get_session_details(session_id):
    """Get detailed results for a specific session"""
    try:
        session = AnalysisSession.query.get_or_404(session_id)
        wells = WellResult.query.filter_by(session_id=session_id).all()
        
        return jsonify({
            'session': session.to_dict(),
            'wells': [well.to_dict() for well in wells]
        })
    except Exception as e:
        return jsonify({'error': f'Database error: {str(e)}'}), 500

@app.route('/sessions/<int:session_id>', methods=['DELETE'])
def delete_session(session_id):
    """Delete a specific session and its results"""
    try:
        session = AnalysisSession.query.get_or_404(session_id)
        db.session.delete(session)  # Cascade will delete associated wells
        db.session.commit()
        
        return jsonify({'message': 'Session deleted successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Database error: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'message': 'qPCR S-Curve Analyzer with Database',
        'version': '2.1.0-database'
    })

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Ensure static directory exists
    if not os.path.exists('static'):
        os.makedirs('static')
    
    # Run the Flask app
    app.run(host='0.0.0.0', port=5000, debug=True)
