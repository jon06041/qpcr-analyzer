// Global variables
let csvData = null;
let analysisResults = {};
let currentChart = null;

// DOM elements
const fileUpload = document.getElementById('fileUpload');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const analyzeBtn = document.getElementById('analyzeBtn');
const analysisSection = document.getElementById('analysisSection');
const loadingIndicator = document.getElementById('loadingIndicator');

// File upload handling
fileUpload.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileUpload.classList.add('dragover');
});

fileUpload.addEventListener('dragleave', () => {
    fileUpload.classList.remove('dragover');
});

fileUpload.addEventListener('drop', (e) => {
    e.preventDefault();
    fileUpload.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileUpload(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileUpload(e.target.files[0]);
    }
});

function handleFileUpload(file) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
        alert('Please upload a CSV file');
        return;
    }

    Papa.parse(file, {
        complete: function(results) {
            if (results.errors.length > 0) {
                alert('Error parsing CSV file: ' + results.errors[0].message);
                return;
            }
            
            csvData = results.data;
            displayFileInfo(file, csvData);
        },
        header: false,
        skipEmptyLines: true
    });
}

function displayFileInfo(file, data) {
    // Parse the CSV data to extract cycle information
    if (data.length < 2) {
        alert('CSV file appears to be empty or invalid');
        return;
    }

    console.log('Total CSV rows:', data.length);
    console.log('First few rows:', data.slice(0, 3));

    // First row should contain headers (cycle, well names)
    const headers = data[0];
    const wellNames = headers.slice(1); // Remove first column (cycles)
    
    // Extract cycle data - check both first and second columns for cycle numbers
    const cycles = [];
    const invalidRows = [];
    let cycleColumnIndex = 0;
    
    // Smart detection of cycle column - same logic as prepareAnalysisData
    for (let i = 0; i < headers.length; i++) {
        if (headers[i] && headers[i].toLowerCase().includes('cycle')) {
            cycleColumnIndex = i;
            console.log(`Found "Cycle" header in column ${i}`);
            break;
        }
    }
    
    // Auto-detect by examining data patterns if no "Cycle" header found
    if (cycleColumnIndex === 0 && (!headers[0] || !headers[0].toLowerCase().includes('cycle'))) {
        for (let col = 0; col < Math.min(3, headers.length); col++) {
            let validNumbers = 0;
            let sequentialPattern = true;
            let lastNum = 0;
            
            for (let row = 1; row < Math.min(6, data.length); row++) {
                if (data[row] && data[row][col] !== undefined && data[row][col] !== '' && !isNaN(data[row][col])) {
                    const num = parseFloat(data[row][col]);
                    validNumbers++;
                    
                    if (row === 1) {
                        lastNum = num;
                    } else if (num !== lastNum + 1) {
                        sequentialPattern = false;
                    } else {
                        lastNum = num;
                    }
                }
            }
            
            if (validNumbers >= 3 && sequentialPattern) {
                cycleColumnIndex = col;
                console.log(`Auto-detected cycle column ${col} with sequential pattern`);
                break;
            }
        }
    }
    
    for (let i = 1; i < data.length; i++) {
        const cellValue = data[i][cycleColumnIndex];
        if (cellValue !== undefined && cellValue !== '' && !isNaN(cellValue)) {
            cycles.push(parseFloat(cellValue));
        } else {
            invalidRows.push({row: i, value: cellValue, column: cycleColumnIndex});
        }
    }
    
    console.log('Valid cycles found:', cycles.length);
    console.log('Invalid rows:', invalidRows.slice(0, 5)); // Show first 5 invalid rows
    console.log('Cycle range detected:', cycles.length > 0 ? `${Math.min(...cycles)} to ${Math.max(...cycles)}` : 'none');
    
    if (cycles.length === 0) {
        alert('No valid cycle data found in CSV. Check console for details.');
        return;
    }

    const minCycle = Math.min(...cycles);
    const maxCycle = Math.max(...cycles);
    const cycleCount = cycles.length;

    // Update file info display
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = (file.size / 1024).toFixed(1) + ' KB';
    document.getElementById('cycleRange').textContent = `${minCycle} - ${maxCycle} (${cycleCount} cycles)`;
    document.getElementById('wellCount').textContent = wellNames.length;

    fileInfo.style.display = 'block';
}

// Analysis button handler
analyzeBtn.addEventListener('click', performAnalysis);

async function performAnalysis() {
    if (!csvData) {
        alert('No CSV data loaded');
        return;
    }

    loadingIndicator.style.display = 'flex';

    try {
        // Prepare data for analysis
        const analysisData = prepareAnalysisData(csvData);
        
        // Validate we have data to analyze
        if (!analysisData || Object.keys(analysisData).length === 0) {
            throw new Error('No valid well data found in CSV. Please check your file format.');
        }
        
        console.log('Sending analysis data:', analysisData);
        
        // Send to backend for analysis
        const response = await fetch('/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Filename': document.getElementById('fileName').textContent || 'unknown.csv'
            },
            body: JSON.stringify(analysisData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Server error response:', errorData);
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        const results = await response.json();
        console.log('Analysis results:', results);
        analysisResults = results;
        
        displayAnalysisResults(results);
        
    } catch (error) {
        console.error('Analysis error:', error);
        alert('Error performing analysis: ' + error.message);
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

function prepareAnalysisData(data) {
    console.log('Raw CSV data:', data);
    
    if (!data || data.length < 2) {
        console.error('Insufficient CSV data');
        return {};
    }
    
    const headers = data[0];
    console.log('Headers:', headers);
    
    if (!headers || headers.length < 2) {
        console.error('Invalid headers');
        return {};
    }
    
    // Smart detection of cycle column - handle all CFX Manager formats
    let cycleColumnIndex = -1;
    let wellNames = [];
    
    // Method 1: Look for "Cycle" in headers
    for (let i = 0; i < headers.length; i++) {
        if (headers[i] && headers[i].toLowerCase().includes('cycle')) {
            cycleColumnIndex = i;
            wellNames = headers.slice(i + 1).filter(name => name && name.trim() && !name.toLowerCase().includes('cycle'));
            console.log(`Found "Cycle" header in column ${i}`);
            break;
        }
    }
    
    // Method 2: Auto-detect by examining data patterns
    if (cycleColumnIndex === -1) {
        for (let col = 0; col < Math.min(3, headers.length); col++) {
            let validNumbers = 0;
            let sequentialPattern = true;
            let lastNum = 0;
            
            // Check first 10 rows for numeric sequence
            for (let row = 1; row < Math.min(11, data.length); row++) {
                if (data[row] && data[row][col] !== undefined && data[row][col] !== '' && !isNaN(data[row][col])) {
                    const num = parseFloat(data[row][col]);
                    validNumbers++;
                    
                    if (row === 1) {
                        lastNum = num;
                    } else if (num !== lastNum + 1) {
                        sequentialPattern = false;
                    } else {
                        lastNum = num;
                    }
                }
            }
            
            // If we found a column with sequential numbers, likely cycle data
            if (validNumbers >= 5 && sequentialPattern) {
                cycleColumnIndex = col;
                wellNames = headers.slice(col + 1).filter(name => name && name.trim() && !name.toLowerCase().includes('cycle'));
                console.log(`Auto-detected cycle column ${col} with sequential pattern`);
                break;
            }
        }
    }
    
    // Method 3: Fallback - use first column with most numeric data
    if (cycleColumnIndex === -1) {
        let bestColumn = 0;
        let maxValidNumbers = 0;
        
        for (let col = 0; col < Math.min(3, headers.length); col++) {
            let validNumbers = 0;
            for (let row = 1; row < data.length; row++) {
                if (data[row] && data[row][col] !== undefined && data[row][col] !== '' && !isNaN(data[row][col])) {
                    validNumbers++;
                }
            }
            
            if (validNumbers > maxValidNumbers) {
                maxValidNumbers = validNumbers;
                bestColumn = col;
            }
        }
        
        if (maxValidNumbers > 0) {
            cycleColumnIndex = bestColumn;
            wellNames = headers.slice(bestColumn + 1).filter(name => name && name.trim());
            console.log(`Fallback: using column ${bestColumn} with ${maxValidNumbers} valid numbers`);
        }
    }
    
    if (cycleColumnIndex === -1) {
        console.error('Could not detect cycle column');
        return {};
    }
    
    console.log('Well names:', wellNames);
    
    const wellData = {};
    
    // Extract cycles
    const cycles = [];
    for (let i = 1; i < data.length; i++) {
        if (data[i] && data[i][cycleColumnIndex] !== undefined && data[i][cycleColumnIndex] !== '' && !isNaN(data[i][cycleColumnIndex])) {
            cycles.push(parseFloat(data[i][cycleColumnIndex]));
        }
    }
    
    console.log('Cycles extracted:', cycles.length, 'Range:', cycles.length > 0 ? `${Math.min(...cycles)}-${Math.max(...cycles)}` : 'none', 'First 5:', cycles.slice(0, 5));
    
    if (cycles.length === 0) {
        console.error('No valid cycles found');
        return {};
    }
    
    // Extract RFU data for each well
    const wellStartColumn = cycleColumnIndex + 1;
    wellNames.forEach((wellName, wellIndex) => {
        if (!wellName || wellName.trim() === '') return;
        
        const rfuColumnIndex = wellStartColumn + wellIndex;
        const rfu = [];
        
        for (let i = 1; i < data.length; i++) {
            if (data[i] && data[i][rfuColumnIndex] !== undefined && data[i][rfuColumnIndex] !== '' && !isNaN(data[i][rfuColumnIndex])) {
                rfu.push(parseFloat(data[i][rfuColumnIndex]));
            }
        }
        
        console.log(`Well ${wellName}: ${rfu.length} RFU values from column ${rfuColumnIndex}`);
        
        if (rfu.length === cycles.length && rfu.length > 0) {
            wellData[wellName.trim()] = {
                cycles: cycles,
                rfu: rfu
            };
        } else {
            console.warn(`Well ${wellName}: RFU length (${rfu.length}) doesn't match cycles length (${cycles.length})`);
        }
    });
    
    console.log('Final well data:', Object.keys(wellData));
    return wellData;
}

function displayAnalysisResults(results) {
    analysisSection.style.display = 'block';
    
    // Update summary statistics
    const totalWells = Object.keys(results.individual_results).length;
    const goodCurves = results.good_curves.length;
    const successRate = totalWells > 0 ? ((goodCurves / totalWells) * 100).toFixed(1) : 0;
    
    document.getElementById('totalWells').textContent = totalWells;
    document.getElementById('goodCurves').textContent = goodCurves;
    document.getElementById('successRate').textContent = successRate + '%';
    
    // Update cycle range
    if (results.cycle_info) {
        document.getElementById('cycleRangeResult').textContent = 
            `${results.cycle_info.min} - ${results.cycle_info.max} (${results.cycle_info.count} cycles)`;
    }
    
    // Populate well selector
    populateWellSelector(results.individual_results);
    
    // Populate results table
    populateResultsTable(results.individual_results);
    
    // Show first well by default
    const firstWell = Object.keys(results.individual_results)[0];
    if (firstWell) {
        showWellDetails(firstWell);
    }
}

function populateWellSelector(individualResults) {
    const wellSelect = document.getElementById('wellSelect');
    wellSelect.innerHTML = '';
    
    // Add "All Wells" option
    const allOption = document.createElement('option');
    allOption.value = 'ALL_WELLS';
    allOption.textContent = 'All Wells Overlay';
    wellSelect.appendChild(allOption);
    
    // Add separator
    const separator = document.createElement('option');
    separator.disabled = true;
    separator.textContent = '────────────';
    wellSelect.appendChild(separator);
    
    Object.keys(individualResults).forEach(wellId => {
        const option = document.createElement('option');
        option.value = wellId;
        option.textContent = wellId;
        wellSelect.appendChild(option);
    });
    
    wellSelect.addEventListener('change', (e) => {
        if (e.target.value === 'ALL_WELLS') {
            showAllWellsOverlay();
        } else {
            showWellDetails(e.target.value);
        }
    });
}

function showWellDetails(wellId) {
    const wellResult = analysisResults.individual_results[wellId];
    if (!wellResult) return;
    
    // Update curve details
    const detailsContent = document.getElementById('curveDetails');
    
    let statusClass = wellResult.is_good_scurve ? 'status-good' : 'status-poor';
    let statusText = wellResult.is_good_scurve ? 'Good S-Curve' : 'Poor Curve';
    
    let anomaliesHtml = '';
    if (wellResult.anomalies && wellResult.anomalies.length > 0) {
        anomaliesHtml = '<div class="anomaly-list"><strong>Anomalies:</strong><br>' +
            wellResult.anomalies.map(anomaly => `<span class="anomaly-item">${anomaly}</span>`).join('') +
            '</div>';
    }
    
    detailsContent.innerHTML = `
        <div class="parameter-item">
            <span class="parameter-label">Well ID:</span>
            <span class="parameter-value">${wellId}</span>
        </div>
        <div class="parameter-item">
            <span class="parameter-label">Status:</span>
            <span class="${statusClass}">${statusText}</span>
        </div>
        <div class="parameter-grid">
            <div class="parameter-item">
                <span class="parameter-label">R² Score:</span>
                <span class="parameter-value">${wellResult.r2_score ? wellResult.r2_score.toFixed(4) : 'N/A'}</span>
            </div>
            <div class="parameter-item">
                <span class="parameter-label">RMSE:</span>
                <span class="parameter-value">${wellResult.rmse ? wellResult.rmse.toFixed(2) : 'N/A'}</span>
            </div>
            <div class="parameter-item">
                <span class="parameter-label">Amplitude:</span>
                <span class="parameter-value">${wellResult.amplitude ? wellResult.amplitude.toFixed(2) : 'N/A'}</span>
            </div>
            <div class="parameter-item">
                <span class="parameter-label">Steepness:</span>
                <span class="parameter-value">${wellResult.steepness ? wellResult.steepness.toFixed(4) : 'N/A'}</span>
            </div>
            <div class="parameter-item">
                <span class="parameter-label">Midpoint:</span>
                <span class="parameter-value">${wellResult.midpoint ? wellResult.midpoint.toFixed(2) : 'N/A'}</span>
            </div>
            <div class="parameter-item">
                <span class="parameter-label">Baseline:</span>
                <span class="parameter-value">${wellResult.baseline ? wellResult.baseline.toFixed(2) : 'N/A'}</span>
            </div>
        </div>
        ${anomaliesHtml}
    `;
    
    // Update chart for selected well
    updateChart(wellId);
}

function showAllWellsOverlay() {
    // Update curve details for overlay view
    const detailsContent = document.getElementById('curveDetails');
    const totalWells = Object.keys(analysisResults.individual_results).length;
    const goodWells = analysisResults.good_curves.length;
    
    detailsContent.innerHTML = `
        <div class="parameter-item">
            <span class="parameter-label">View:</span>
            <span class="parameter-value">All Wells Overlay</span>
        </div>
        <div class="parameter-item">
            <span class="parameter-label">Total Wells:</span>
            <span class="parameter-value">${totalWells}</span>
        </div>
        <div class="parameter-item">
            <span class="parameter-label">Good S-Curves:</span>
            <span class="parameter-value">${goodWells}</span>
        </div>
        <div class="parameter-item">
            <span class="parameter-label">Success Rate:</span>
            <span class="parameter-value">${((goodWells/totalWells)*100).toFixed(1)}%</span>
        </div>
        <p style="margin-top: 15px; color: #7f8c8d; font-size: 0.9rem;">
            <strong>Legend:</strong> Green = Good S-curves, Red = Poor curves, Blue = Fitted curves
        </p>
    `;
    
    // Update chart with all wells
    updateAllWellsChart();
}

function updateChart(wellId) {
    const wellData = prepareAnalysisData(csvData)[wellId];
    const wellResult = analysisResults.individual_results[wellId];
    
    if (!wellData || !wellResult) return;
    
    const ctx = document.getElementById('amplificationChart').getContext('2d');
    
    // Destroy existing chart
    if (currentChart) {
        currentChart.destroy();
    }
    
    // Prepare fit data if available
    let fitData = [];
    if (wellResult.fitted_curve) {
        fitData = wellResult.fitted_curve.map((rfu, index) => ({
            x: wellData.cycles[index],
            y: rfu
        }));
    }
    
    const datasets = [
        {
            label: `${wellId} - Raw Data`,
            data: wellData.cycles.map((cycle, index) => ({
                x: cycle,
                y: wellData.rfu[index]
            })),
            backgroundColor: 'rgba(52, 152, 219, 0.8)',
            borderColor: 'rgba(41, 128, 185, 1)',
            borderWidth: 1,
            pointRadius: 3,
            pointHoverRadius: 5,
            showLine: false,
            pointStyle: 'circle'
        }
    ];
    
    if (fitData.length > 0) {
        datasets.push({
            label: `Sigmoid Fit (R²=${wellResult.r2_score ? wellResult.r2_score.toFixed(3) : 'N/A'})`,
            data: fitData,
            backgroundColor: 'rgba(231, 76, 60, 0.2)',
            borderColor: 'rgba(192, 57, 43, 1)',
            borderWidth: 4,
            pointRadius: 0,
            showLine: true,
            tension: 0.1,
            fill: false
        });
    }
    
    // Calculate better Y-axis range to highlight the S-curve
    const allRFUValues = wellData.rfu.concat(fitData.map(point => point.y));
    const minRFU = Math.min(...allRFUValues);
    const maxRFU = Math.max(...allRFUValues);
    const rfuRange = maxRFU - minRFU;
    const padding = rfuRange * 0.1; // 10% padding
    
    currentChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `qPCR Amplification Curve - ${wellId}`,
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Cycle Number'
                    },
                    grid: {
                        display: true,
                        alpha: 0.3
                    },
                    min: Math.min(...wellData.cycles) - 1,
                    max: Math.max(...wellData.cycles) + 1
                },
                y: {
                    title: {
                        display: true,
                        text: 'RFU (Relative Fluorescence Units)'
                    },
                    grid: {
                        display: true,
                        alpha: 0.3
                    },
                    min: Math.max(0, minRFU - padding),
                    max: maxRFU + padding
                }
            },
            interaction: {
                intersect: false,
                mode: 'point'
            }
        }
    });
}

function populateResultsTable(individualResults) {
    const tableBody = document.getElementById('resultsTableBody');
    tableBody.innerHTML = '';
    
    Object.entries(individualResults).forEach(([wellId, result]) => {
        const row = document.createElement('tr');
        
        const statusClass = result.is_good_scurve ? 'status-good' : 'status-poor';
        const statusText = result.is_good_scurve ? 'Good' : 'Poor';
        
        const anomaliesText = result.anomalies && result.anomalies.length > 0 
            ? result.anomalies.join(', ') 
            : 'None';
        
        row.innerHTML = `
            <td><strong>${wellId}</strong></td>
            <td><span class="${statusClass}">${statusText}</span></td>
            <td>${result.r2_score ? result.r2_score.toFixed(4) : 'N/A'}</td>
            <td>${result.rmse ? result.rmse.toFixed(2) : 'N/A'}</td>
            <td>${result.amplitude ? result.amplitude.toFixed(2) : 'N/A'}</td>
            <td>${result.steepness ? result.steepness.toFixed(4) : 'N/A'}</td>
            <td>${result.midpoint ? result.midpoint.toFixed(2) : 'N/A'}</td>
            <td>${result.baseline ? result.baseline.toFixed(2) : 'N/A'}</td>
            <td>${anomaliesText}</td>
        `;
        
        row.addEventListener('click', () => {
            document.getElementById('wellSelect').value = wellId;
            showWellDetails(wellId);
        });
        
        tableBody.appendChild(row);
    });
}

// Control button handlers
document.getElementById('showAllBtn').addEventListener('click', () => {
    showAllWells();
});

document.getElementById('goodCurvesBtn').addEventListener('click', () => {
    showGoodCurvesOnly();
});

document.getElementById('exportBtn').addEventListener('click', () => {
    exportResults();
});

function showAllWells() {
    // Implementation for showing all wells in chart
    if (!analysisResults.individual_results) return;
    
    const ctx = document.getElementById('amplificationChart').getContext('2d');
    
    if (currentChart) {
        currentChart.destroy();
    }
    
    const wellData = prepareAnalysisData(csvData);
    const datasets = [];
    
    const colors = [
        'rgba(52, 152, 219, 0.8)',
        'rgba(231, 76, 60, 0.8)',
        'rgba(46, 204, 113, 0.8)',
        'rgba(155, 89, 182, 0.8)',
        'rgba(241, 196, 15, 0.8)',
        'rgba(230, 126, 34, 0.8)'
    ];
    
    Object.keys(analysisResults.individual_results).forEach((wellId, index) => {
        const data = wellData[wellId];
        if (data) {
            datasets.push({
                label: wellId,
                data: data.cycles.map((cycle, idx) => ({
                    x: cycle,
                    y: data.rfu[idx]
                })),
                borderColor: colors[index % colors.length],
                backgroundColor: colors[index % colors.length].replace('0.8', '0.3'),
                borderWidth: 2,
                pointRadius: 2,
                showLine: true,
                tension: 0.1
            });
        }
    });
    
    currentChart = new Chart(ctx, {
        type: 'scatter',
        data: { datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'All Wells - qPCR Amplification Curves',
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: true,
                    position: 'right'
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Cycle Number' }
                },
                y: {
                    title: { display: true, text: 'RFU' }
                }
            }
        }
    });
}

function showGoodCurvesOnly() {
    if (!analysisResults.good_curves) return;
    
    const ctx = document.getElementById('amplificationChart').getContext('2d');
    
    if (currentChart) {
        currentChart.destroy();
    }
    
    const wellData = prepareAnalysisData(csvData);
    const datasets = [];
    
    const colors = [
        'rgba(46, 204, 113, 0.8)',
        'rgba(52, 152, 219, 0.8)',
        'rgba(155, 89, 182, 0.8)',
        'rgba(241, 196, 15, 0.8)'
    ];
    
    analysisResults.good_curves.forEach((wellId, index) => {
        const data = wellData[wellId];
        if (data) {
            datasets.push({
                label: wellId,
                data: data.cycles.map((cycle, idx) => ({
                    x: cycle,
                    y: data.rfu[idx]
                })),
                borderColor: colors[index % colors.length],
                backgroundColor: colors[index % colors.length].replace('0.8', '0.3'),
                borderWidth: 2,
                pointRadius: 2,
                showLine: true,
                tension: 0.1
            });
        }
    });
    
    currentChart = new Chart(ctx, {
        type: 'scatter',
        data: { datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Good S-Curves Only - qPCR Amplification Curves',
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: true,
                    position: 'right'
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Cycle Number' }
                },
                y: {
                    title: { display: true, text: 'RFU' }
                }
            }
        }
    });
}

function exportResults() {
    if (!analysisResults) return;
    
    // Prepare CSV data for export
    const csvContent = generateResultsCSV();
    
    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qpcr_analysis_results.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function generateResultsCSV() {
    const headers = [
        'Well', 'Status', 'R2_Score', 'RMSE', 'Amplitude', 'Steepness', 
        'Midpoint', 'Baseline', 'Anomalies'
    ];
    
    let csvContent = headers.join(',') + '\n';
    
    Object.entries(analysisResults.individual_results).forEach(([wellId, result]) => {
        const row = [
            wellId,
            result.is_good_scurve ? 'Good' : 'Poor',
            result.r2_score ? result.r2_score.toFixed(4) : 'N/A',
            result.rmse ? result.rmse.toFixed(2) : 'N/A',
            result.amplitude ? result.amplitude.toFixed(2) : 'N/A',
            result.steepness ? result.steepness.toFixed(4) : 'N/A',
            result.midpoint ? result.midpoint.toFixed(2) : 'N/A',
            result.baseline ? result.baseline.toFixed(2) : 'N/A',
            result.anomalies && result.anomalies.length > 0 ? result.anomalies.join(';') : 'None'
        ];
        
        csvContent += row.join(',') + '\n';
    });
    
    return csvContent;
}

// History functionality
async function loadAnalysisHistory() {
    try {
        const response = await fetch('/sessions');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        displayAnalysisHistory(data.sessions);
    } catch (error) {
        console.error('Error loading history:', error);
        document.getElementById('historyContent').innerHTML = 
            '<p class="empty-history">Error loading analysis history</p>';
    }
}

function displayAnalysisHistory(sessions) {
    const historyContent = document.getElementById('historyContent');
    
    if (!sessions || sessions.length === 0) {
        historyContent.innerHTML = '<p class="empty-history">No analysis sessions found</p>';
        return;
    }
    
    const tableHtml = `
        <table class="history-table">
            <thead>
                <tr>
                    <th>File Name</th>
                    <th>Date</th>
                    <th>Wells</th>
                    <th>Success Rate</th>
                    <th>Cycles</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${sessions.map(session => `
                    <tr onclick="loadSessionDetails(${session.id})" data-session-id="${session.id}">
                        <td><strong>${session.filename}</strong></td>
                        <td>${new Date(session.upload_timestamp).toLocaleString()}</td>
                        <td>
                            <div class="session-stats">
                                <span class="session-stat">${session.total_wells} total</span>
                                <span class="session-stat">${session.good_curves} good</span>
                            </div>
                        </td>
                        <td>${session.success_rate.toFixed(1)}%</td>
                        <td>${session.cycle_range || 'N/A'}</td>
                        <td>
                            <button class="delete-btn" onclick="deleteSession(${session.id}, event)">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    historyContent.innerHTML = tableHtml;
}

async function loadSessionDetails(sessionId) {
    try {
        const response = await fetch(`/sessions/${sessionId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Convert session data to analysisResults format
        analysisResults = {
            individual_results: {},
            good_curves: [],
            cycle_info: {
                min: data.session.cycle_range ? parseInt(data.session.cycle_range.split('-')[0]) : 0,
                max: data.session.cycle_range ? parseInt(data.session.cycle_range.split('-')[1]) : 0,
                count: data.session.cycle_count || 0
            },
            summary: {
                total_wells: data.session.total_wells,
                good_curves: data.session.good_curves,
                success_rate: data.session.success_rate
            }
        };
        
        // Convert well data
        data.wells.forEach(well => {
            analysisResults.individual_results[well.well_id] = {
                r2_score: well.r2_score,
                rmse: well.rmse,
                amplitude: well.amplitude,
                steepness: well.steepness,
                midpoint: well.midpoint,
                baseline: well.baseline,
                is_good_scurve: well.is_good_scurve,
                anomalies: well.anomalies || [],
                fitted_curve: well.fitted_curve || [],
                data_points: well.data_points,
                cycle_range: well.cycle_range
            };
            
            if (well.is_good_scurve) {
                analysisResults.good_curves.push(well.well_id);
            }
        });
        
        // Show analysis section and populate with session data
        displayAnalysisResults(analysisResults);
        
        // Scroll to analysis section
        document.getElementById('analysisSection').scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error('Error loading session details:', error);
        alert('Error loading session details: ' + error.message);
    }
}

async function deleteSession(sessionId, event) {
    event.stopPropagation(); // Prevent row click
    
    if (!confirm('Are you sure you want to delete this analysis session?')) {
        return;
    }
    
    try {
        const response = await fetch(`/sessions/${sessionId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Reload history
        loadAnalysisHistory();
        
    } catch (error) {
        console.error('Error deleting session:', error);
        alert('Error deleting session: ' + error.message);
    }
}

// History control handlers
document.getElementById('refreshHistoryBtn').addEventListener('click', loadAnalysisHistory);
document.getElementById('clearHistoryBtn').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to delete ALL analysis history? This cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch('/sessions');
        const data = await response.json();
        
        // Delete all sessions
        for (const session of data.sessions) {
            await fetch(`/sessions/${session.id}`, { method: 'DELETE' });
        }
        
        loadAnalysisHistory();
    } catch (error) {
        console.error('Error clearing history:', error);
        alert('Error clearing history: ' + error.message);
    }
});

// Load history on page load
document.addEventListener('DOMContentLoaded', loadAnalysisHistory);

// Table search and filter functionality
document.getElementById('searchWells').addEventListener('input', filterTable);
document.getElementById('filterStatus').addEventListener('change', filterTable);

function filterTable() {
    const searchTerm = document.getElementById('searchWells').value.toLowerCase();
    const statusFilter = document.getElementById('filterStatus').value;
    const tableRows = document.querySelectorAll('#resultsTableBody tr');
    
    tableRows.forEach(row => {
        const wellName = row.cells[0].textContent.toLowerCase();
        const status = row.cells[1].textContent.toLowerCase();
        
        const matchesSearch = wellName.includes(searchTerm);
        const matchesStatus = statusFilter === 'all' || 
                             (statusFilter === 'good' && status.includes('good')) ||
                             (statusFilter === 'poor' && status.includes('poor'));
        
        row.style.display = matchesSearch && matchesStatus ? '' : 'none';
    });
}
