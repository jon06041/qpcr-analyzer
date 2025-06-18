import numpy as np
from scipy.optimize import curve_fit
import matplotlib.pyplot as plt
from sklearn.metrics import r2_score
import pandas as pd
import warnings
warnings.filterwarnings('ignore')

def sigmoid(x, L, k, x0, B):
    """Sigmoid function for qPCR amplification curves"""
    return L / (1 + np.exp(-k * (x - x0))) + B

def analyze_curve_quality(cycles, rfu, plot=False):
    """Analyze if a curve matches S-shaped pattern and return quality metrics"""
    try:
        # Ensure we have enough data points
        if len(cycles) < 5 or len(rfu) < 5:
            return {'error': 'Insufficient data points', 'is_good_scurve': False}
        
        # Convert to numpy arrays
        cycles = np.array(cycles)
        rfu = np.array(rfu)
        
        # Remove any NaN or infinite values
        valid_indices = np.isfinite(cycles) & np.isfinite(rfu)
        cycles = cycles[valid_indices]
        rfu = rfu[valid_indices]
        
        if len(cycles) < 5:
            return {'error': 'Insufficient valid data points', 'is_good_scurve': False}
        
        # Dynamic initial parameter guesses based on data characteristics
        rfu_range = np.max(rfu) - np.min(rfu)
        L_guess = rfu_range * 1.1  # Amplitude with some buffer
        k_guess = 0.5  # Steepness - start conservative
        x0_guess = cycles[len(cycles)//2]  # Midpoint
        B_guess = np.min(rfu)  # Baseline
        
        # Adaptive bounds based on data
        cycle_range = np.max(cycles) - np.min(cycles)
        bounds = (
            [rfu_range * 0.1, 0.01, np.min(cycles), np.min(rfu) - rfu_range * 0.1],  # Lower bounds
            [rfu_range * 5, 10, np.max(cycles), np.max(rfu)]  # Upper bounds
        )
        
        # Fit sigmoid with bounds
        popt, pcov = curve_fit(
            sigmoid, cycles, rfu, 
            p0=[L_guess, k_guess, x0_guess, B_guess],
            bounds=bounds,
            maxfev=5000,
            method='trf'
        )
        
        # Calculate fit quality
        fit_rfu = sigmoid(cycles, *popt)
        r2 = r2_score(rfu, fit_rfu)
        
        # Calculate residuals
        residuals = rfu - fit_rfu
        rmse = np.sqrt(np.mean(residuals**2))
        
        # Extract parameters
        L, k, x0, B = popt
        
        # Dynamic quality criteria based on data characteristics
        min_amplitude = max(50, rfu_range * 0.3)  # Adaptive amplitude threshold
        r2_threshold = 0.9 if len(cycles) > 20 else 0.85  # Relaxed for shorter runs
        
        # Quality criteria for S-curve identification - convert numpy types to Python types
        criteria = {
            'r2_score': float(r2),
            'rmse': float(rmse),
            'amplitude': float(L),
            'steepness': float(k),
            'midpoint': float(x0),
            'baseline': float(B),
            'is_good_scurve': bool(r2 > r2_threshold and k > 0.05 and L > min_amplitude),
            'fit_parameters': [float(x) for x in popt],
            'parameter_errors': [float(x) for x in np.sqrt(np.diag(pcov))],
            'fitted_curve': [float(x) for x in fit_rfu],
            'data_points': int(len(cycles)),
            'cycle_range': float(cycle_range)
        }
        
        if plot:
            plt.figure(figsize=(10, 6))
            plt.plot(cycles, rfu, 'bo', label='Data', markersize=4)
            plt.plot(cycles, fit_rfu, 'r-', label='Sigmoid Fit (R²={:.3f})'.format(r2), linewidth=2)
            plt.xlabel('Cycle')
            plt.ylabel('RFU')
            plt.legend()
            plt.title('qPCR Amplification Curve Analysis\nGood S-curve: {}'.format(criteria['is_good_scurve']))
            plt.grid(True, alpha=0.3)
            plt.show()
        
        return criteria
        
    except Exception as e:
        return {'error': str(e), 'is_good_scurve': False}

def batch_analyze_wells(data_dict):
    """Analyze multiple wells/samples for S-curve patterns"""
    results = {}
    good_curves = []
    cycle_info = None
    
    for well_id, data in data_dict.items():
        cycles = data['cycles']
        rfu = data['rfu']
        
        # Store cycle info from first well - convert to Python types
        if cycle_info is None and len(cycles) > 0:
            cycle_info = {
                'min': int(min(cycles)),
                'max': int(max(cycles)),
                'count': int(len(cycles))
            }
        
        analysis = analyze_curve_quality(cycles, rfu)
        
        # Add anomaly detection
        anomalies = detect_curve_anomalies(cycles, rfu)
        analysis['anomalies'] = anomalies
        
        results[well_id] = analysis
        
        if analysis.get('is_good_scurve', False):
            good_curves.append(well_id)
    
    return {
        'individual_results': results,
        'good_curves': good_curves,
        'cycle_info': cycle_info,
        'summary': {
            'total_wells': len(results),
            'good_curves': len(good_curves),
            'success_rate': len(good_curves) / len(results) * 100 if len(results) > 0 else 0
        }
    }

def detect_curve_anomalies(cycles, rfu):
    """Detect common qPCR curve problems - adapted for variable cycle counts"""
    anomalies = []
    
    if len(cycles) < 5 or len(rfu) < 5:
        anomalies.append('insufficient_data')
        return anomalies
    
    cycles = np.array(cycles)
    rfu = np.array(rfu)
    
    # Remove NaN values
    valid_indices = np.isfinite(cycles) & np.isfinite(rfu)
    cycles = cycles[valid_indices]
    rfu = rfu[valid_indices]
    
    if len(cycles) < 5:
        anomalies.append('insufficient_valid_data')
        return anomalies
    
    rfu_range = np.max(rfu) - np.min(rfu)
    
    # Check for plateau curves (no exponential phase) - adaptive threshold
    min_amplitude = max(50, rfu_range * 0.1)
    if rfu_range < min_amplitude:
        anomalies.append('low_amplitude')
    
    # Check for early plateau - adaptive to cycle count
    plateau_check_point = min(len(rfu) // 2, len(rfu) - 5)
    if plateau_check_point > 0:
        plateau_std = np.std(rfu[plateau_check_point:])
        if plateau_std < max(20, rfu_range * 0.05):
            anomalies.append('early_plateau')
    
    # Check for irregular baseline - use first 20% of data or minimum 3 points
    baseline_points = max(3, len(rfu) // 5)
    baseline_rfu = rfu[:baseline_points]
    baseline_std = np.std(baseline_rfu)
    if baseline_std > max(50, rfu_range * 0.15):
        anomalies.append('unstable_baseline')
    
    # Check for negative amplification in potential exponential phase
    exp_start = max(baseline_points, len(rfu) // 4)
    exp_end = min(len(rfu) - 1, exp_start + len(rfu) // 3)
    if exp_end > exp_start:
        exp_phase_rfu = rfu[exp_start:exp_end]
        if len(exp_phase_rfu) > 2:
            max_decrease = np.min(np.diff(exp_phase_rfu))
            if max_decrease < -max(30, rfu_range * 0.1):
                anomalies.append('negative_amplification')
    
    # Check for data quality issues
    if np.any(rfu < 0):
        anomalies.append('negative_rfu_values')
    
    # Check for extremely high noise
    if len(rfu) > 5:
        noise_level = np.std(np.diff(rfu))
        if noise_level > rfu_range * 0.3:
            anomalies.append('high_noise')
    
    return anomalies

def process_csv_data(data_dict):
    """Process uploaded CSV data and perform comprehensive analysis"""
    try:
        if not data_dict:
            return {'error': 'No data provided', 'success': False}
        
        # Perform batch analysis
        results = batch_analyze_wells(data_dict)
        
        # Add processing metadata
        results['processing_info'] = {
            'data_points_per_well': len(list(data_dict.values())[0]['cycles']) if data_dict else 0,
            'processing_timestamp': pd.Timestamp.now().isoformat(),
            'total_wells_processed': len(data_dict)
        }
        
        results['success'] = True
        return results
        
    except Exception as e:
        return {'error': str(e), 'success': False}

def validate_csv_structure(data_dict):
    """Validate the structure of uploaded CSV data"""
    errors = []
    warnings = []
    
    if not data_dict:
        errors.append("No data provided")
        return errors, warnings
    
    # Check each well
    for well_id, well_data in data_dict.items():
        if 'cycles' not in well_data or 'rfu' not in well_data:
            errors.append(f"Well {well_id}: Missing cycles or rfu data")
            continue
        
        cycles = well_data['cycles']
        rfu = well_data['rfu']
        
        if len(cycles) != len(rfu):
            errors.append(f"Well {well_id}: Cycles and RFU data length mismatch")
            continue
        
        if len(cycles) < 5:
            warnings.append(f"Well {well_id}: Very few data points ({len(cycles)})")
        
        # Check for reasonable cycle values
        if len(cycles) > 0:
            if min(cycles) < 0 or max(cycles) > 100:
                warnings.append(f"Well {well_id}: Unusual cycle range ({min(cycles)}-{max(cycles)})")
        
        # Check for reasonable RFU values
        if len(rfu) > 0:
            if any(val < 0 for val in rfu):
                warnings.append(f"Well {well_id}: Contains negative RFU values")
    
    return errors, warnings

# Export functionality for results
def export_results_to_csv(results, filename="qpcr_analysis_results.csv"):
    """Export analysis results to CSV format"""
    if 'individual_results' not in results:
        return None
    
    export_data = []
    for well_id, well_result in results['individual_results'].items():
        row = {
            'Well': well_id,
            'Status': 'Good' if well_result.get('is_good_scurve', False) else 'Poor',
            'R2_Score': well_result.get('r2_score', 'N/A'),
            'RMSE': well_result.get('rmse', 'N/A'),
            'Amplitude': well_result.get('amplitude', 'N/A'),
            'Steepness': well_result.get('steepness', 'N/A'),
            'Midpoint': well_result.get('midpoint', 'N/A'),
            'Baseline': well_result.get('baseline', 'N/A'),
            'Data_Points': well_result.get('data_points', 'N/A'),
            'Cycle_Range': well_result.get('cycle_range', 'N/A'),
            'Anomalies': ';'.join(well_result.get('anomalies', []))
        }
        export_data.append(row)
    
    df = pd.DataFrame(export_data)
    df.to_csv(filename, index=False)
    return df

def main():
    """Main function for testing the enhanced analyzer"""
    # Example with variable cycle counts
    print('=== Enhanced qPCR S-Curve Analysis ===')
    
    # Test with different cycle lengths
    test_cases = [
        {
            'name': 'Short Run (25 cycles)',
            'cycles': list(range(1, 26)),
            'rfu': [100 + i*2 + np.random.normal(0, 5) for i in range(25)]
        },
        {
            'name': 'Standard Run (40 cycles)', 
            'cycles': list(range(1, 41)),
            'rfu': [100 + i*3 + np.random.normal(0, 8) for i in range(40)]
        },
        {
            'name': 'Extended Run (50 cycles)',
            'cycles': list(range(1, 51)),
            'rfu': [100 + i*2.5 + np.random.normal(0, 6) for i in range(50)]
        }
    ]
    
    for test_case in test_cases:
        print(f"\n--- {test_case['name']} ---")
        results = analyze_curve_quality(test_case['cycles'], test_case['rfu'])
        
        if 'error' in results:
            print(f'Error: {results["error"]}')
            continue
        
        print(f'R² Score: {results["r2_score"]:.4f}')
        print(f'Is Good S-curve: {results["is_good_scurve"]}')
        print(f'Data Points: {results["data_points"]}')
        print(f'Cycle Range: {results["cycle_range"]:.1f}')
        
        # Check for anomalies
        anomalies = detect_curve_anomalies(test_case['cycles'], test_case['rfu'])
        if anomalies:
            print(f'Anomalies: {", ".join(anomalies)}')
        else:
            print('No anomalies detected')

if __name__ == "__main__":
    main()
