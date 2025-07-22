/**
 * Test Reporting Dashboard
 * 
 * This module provides comprehensive test reporting capabilities including
 * HTML dashboards, performance trend analysis, and regression detection.
 */

import { TestReport, TestExecution, PerformanceTrend, RegressionDetection } from './test-execution-framework';
import * as fs from 'fs';
import * as path from 'path';

export interface DashboardConfig {
  title: string;
  outputDir: string;
  includeCharts: boolean;
  includeDetails: boolean;
  theme: 'light' | 'dark';
  refreshInterval?: number;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  threshold?: number;
  status: 'good' | 'warning' | 'critical';
  trend?: 'up' | 'down' | 'stable';
}

/**
 * Test Reporting Dashboard Generator
 */
export class TestReportingDashboard {
  private config: DashboardConfig;
  private performanceHistory: Map<string, number[]> = new Map();

  constructor(config: DashboardConfig) {
    this.config = config;
    this.ensureOutputDirectory();
  }

  /**
   * Generate comprehensive HTML dashboard
   */
  async generateHTMLDashboard(report: TestReport): Promise<string> {
    const dashboardPath = path.join(this.config.outputDir, 'test-dashboard.html');
    
    const html = this.generateHTMLContent(report);
    fs.writeFileSync(dashboardPath, html);
    
    // Generate supporting files
    await this.generateSupportingFiles(report);
    
    console.log(`📊 Test dashboard generated: ${dashboardPath}`);
    return dashboardPath;
  }

  /**
   * Generate JSON report
   */
  async generateJSONReport(report: TestReport): Promise<string> {
    const reportPath = path.join(this.config.outputDir, 'test-report.json');
    
    const jsonReport = {
      ...report,
      generated: new Date().toISOString(),
      version: '1.0.0'
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(jsonReport, null, 2));
    
    console.log(`📄 JSON report generated: ${reportPath}`);
    return reportPath;
  }

  /**
   * Generate performance trend analysis
   */
  async generatePerformanceTrendReport(report: TestReport): Promise<string> {
    const trendPath = path.join(this.config.outputDir, 'performance-trends.html');
    
    const html = this.generatePerformanceTrendHTML(report);
    fs.writeFileSync(trendPath, html);
    
    console.log(`📈 Performance trend report generated: ${trendPath}`);
    return trendPath;
  }

  /**
   * Generate regression detection report
   */
  async generateRegressionReport(report: TestReport): Promise<string> {
    const regressionPath = path.join(this.config.outputDir, 'regression-analysis.html');
    
    const html = this.generateRegressionHTML(report);
    fs.writeFileSync(regressionPath, html);
    
    console.log(`🔍 Regression analysis report generated: ${regressionPath}`);
    return regressionPath;
  }

  /**
   * Generate CI/CD integration report
   */
  async generateCIReport(report: TestReport): Promise<string> {
    const ciPath = path.join(this.config.outputDir, 'ci-report.xml');
    
    const xml = this.generateJUnitXML(report);
    fs.writeFileSync(ciPath, xml);
    
    console.log(`🔧 CI/CD report generated: ${ciPath}`);
    return ciPath;
  }

  /**
   * Generate main HTML content
   */
  private generateHTMLContent(report: TestReport): string {
    const theme = this.config.theme === 'dark' ? 'dark-theme' : 'light-theme';
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.config.title}</title>
    <link rel="stylesheet" href="dashboard-styles.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="dashboard-scripts.js"></script>
</head>
<body class="${theme}">
    <div class="dashboard-container">
        <header class="dashboard-header">
            <h1>${this.config.title}</h1>
            <div class="timestamp">Generated: ${new Date(report.timestamp).toLocaleString()}</div>
        </header>

        <div class="summary-cards">
            ${this.generateSummaryCards(report)}
        </div>

        <div class="main-content">
            <div class="left-panel">
                ${this.generateExecutionSummary(report)}
                ${this.generatePerformanceMetrics(report)}
            </div>
            
            <div class="right-panel">
                ${this.generateTestSuiteDetails(report)}
                ${this.generateRecommendations(report)}
            </div>
        </div>

        ${this.config.includeCharts ? this.generateChartsSection(report) : ''}
        ${this.config.includeDetails ? this.generateDetailedResults(report) : ''}
    </div>

    <script>
        // Initialize dashboard
        initializeDashboard(${JSON.stringify(report)});
        ${this.config.refreshInterval ? `setInterval(refreshDashboard, ${this.config.refreshInterval});` : ''}
    </script>
</body>
</html>`;
  }

  /**
   * Generate summary cards
   */
  private generateSummaryCards(report: TestReport): string {
    const { summary } = report;
    const successRate = (summary.overallSuccessRate * 100).toFixed(1);
    const duration = this.formatDuration(summary.totalDuration);

    return `
        <div class="summary-card success-rate">
            <div class="card-icon">✅</div>
            <div class="card-content">
                <div class="card-value">${successRate}%</div>
                <div class="card-label">Success Rate</div>
            </div>
        </div>
        
        <div class="summary-card total-tests">
            <div class="card-icon">🧪</div>
            <div class="card-content">
                <div class="card-value">${summary.totalTests}</div>
                <div class="card-label">Total Tests</div>
            </div>
        </div>
        
        <div class="summary-card duration">
            <div class="card-icon">⏱️</div>
            <div class="card-content">
                <div class="card-value">${duration}</div>
                <div class="card-label">Duration</div>
            </div>
        </div>
        
        <div class="summary-card test-suites">
            <div class="card-icon">📦</div>
            <div class="card-content">
                <div class="card-value">${summary.completedSuites}/${summary.totalSuites}</div>
                <div class="card-label">Test Suites</div>
            </div>
        </div>`;
  }

  /**
   * Generate execution summary
   */
  private generateExecutionSummary(report: TestReport): string {
    return `
        <div class="panel execution-summary">
            <h2>Execution Summary</h2>
            <div class="execution-stats">
                <div class="stat-row">
                    <span class="stat-label">Passed Tests:</span>
                    <span class="stat-value passed">${report.summary.passedTests}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Failed Tests:</span>
                    <span class="stat-value failed">${report.summary.failedTests}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Test Suites:</span>
                    <span class="stat-value">${report.summary.totalSuites}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Total Duration:</span>
                    <span class="stat-value">${this.formatDuration(report.summary.totalDuration)}</span>
                </div>
            </div>
        </div>`;
  }

  /**
   * Generate performance metrics
   */
  private generatePerformanceMetrics(report: TestReport): string {
    const metrics = this.extractPerformanceMetrics(report);
    
    return `
        <div class="panel performance-metrics">
            <h2>Performance Metrics</h2>
            <div class="metrics-grid">
                ${metrics.map(metric => `
                    <div class="metric-item ${metric.status}">
                        <div class="metric-name">${metric.name}</div>
                        <div class="metric-value">${metric.value} ${metric.unit}</div>
                        ${metric.trend ? `<div class="metric-trend ${metric.trend}">
                            ${metric.trend === 'up' ? '↗️' : metric.trend === 'down' ? '↘️' : '➡️'}
                        </div>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>`;
  }

  /**
   * Generate test suite details
   */
  private generateTestSuiteDetails(report: TestReport): string {
    return `
        <div class="panel test-suites">
            <h2>Test Suite Results</h2>
            <div class="suite-list">
                ${report.executions.map(execution => `
                    <div class="suite-item ${execution.status}">
                        <div class="suite-header">
                            <span class="suite-name">${execution.suiteId}</span>
                            <span class="suite-status ${execution.status}">${execution.status}</span>
                        </div>
                        <div class="suite-stats">
                            <span>Tests: ${execution.metrics.totalTests}</span>
                            <span>Success: ${(execution.metrics.successRate * 100).toFixed(1)}%</span>
                            <span>Duration: ${this.formatDuration(execution.metrics.totalDuration)}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>`;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(report: TestReport): string {
    return `
        <div class="panel recommendations">
            <h2>Recommendations</h2>
            <div class="recommendation-list">
                ${report.recommendations.map(rec => `
                    <div class="recommendation-item">
                        <div class="recommendation-icon">💡</div>
                        <div class="recommendation-text">${rec}</div>
                    </div>
                `).join('')}
                ${report.recommendations.length === 0 ? 
                    '<div class="no-recommendations">✅ No recommendations - all tests are performing well!</div>' : ''}
            </div>
        </div>`;
  }

  /**
   * Generate charts section
   */
  private generateChartsSection(report: TestReport): string {
    return `
        <div class="charts-section">
            <h2>Performance Charts</h2>
            <div class="charts-grid">
                <div class="chart-container">
                    <canvas id="successRateChart"></canvas>
                </div>
                <div class="chart-container">
                    <canvas id="performanceTrendChart"></canvas>
                </div>
                <div class="chart-container">
                    <canvas id="testDurationChart"></canvas>
                </div>
                <div class="chart-container">
                    <canvas id="regressionChart"></canvas>
                </div>
            </div>
        </div>`;
  }

  /**
   * Generate detailed results
   */
  private generateDetailedResults(report: TestReport): string {
    return `
        <div class="detailed-results">
            <h2>Detailed Test Results</h2>
            ${report.executions.map(execution => `
                <div class="execution-details">
                    <h3>${execution.suiteId}</h3>
                    <div class="test-results">
                        ${execution.results.map(result => `
                            <div class="test-result ${result.status}">
                                <div class="test-name">${result.testName}</div>
                                <div class="test-status">${result.status}</div>
                                <div class="test-duration">${result.duration}ms</div>
                                ${result.error ? `<div class="test-error">${result.error}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>`;
  }

  /**
   * Generate performance trend HTML
   */
  private generatePerformanceTrendHTML(report: TestReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Performance Trends</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link rel="stylesheet" href="dashboard-styles.css">
</head>
<body>
    <div class="trend-dashboard">
        <h1>Performance Trend Analysis</h1>
        <div class="trend-charts">
            ${report.performance.trends.map(trend => `
                <div class="trend-chart">
                    <h3>${trend.metric}</h3>
                    <canvas id="trend-${trend.metric.replace(/\s+/g, '-')}"></canvas>
                    <div class="trend-info">
                        <span class="trend-direction ${trend.trend}">${trend.trend}</span>
                        <span class="trend-change">${trend.changePercent.toFixed(1)}%</span>
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
    <script>
        // Initialize trend charts
        initializeTrendCharts(${JSON.stringify(report.performance.trends)});
    </script>
</body>
</html>`;
  }

  /**
   * Generate regression HTML
   */
  private generateRegressionHTML(report: TestReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Regression Analysis</title>
    <link rel="stylesheet" href="dashboard-styles.css">
</head>
<body>
    <div class="regression-dashboard">
        <h1>Regression Analysis</h1>
        <div class="regression-list">
            ${report.performance.regressions.map(regression => `
                <div class="regression-item ${regression.severity}">
                    <div class="regression-header">
                        <span class="regression-metric">${regression.metric}</span>
                        <span class="regression-severity ${regression.severity}">${regression.severity}</span>
                    </div>
                    <div class="regression-details">
                        <div>Baseline: ${regression.baseline}</div>
                        <div>Current: ${regression.current}</div>
                        <div>Change: ${regression.changePercent.toFixed(1)}%</div>
                        <div>Threshold: ${regression.threshold}</div>
                    </div>
                </div>
            `).join('')}
            ${report.performance.regressions.length === 0 ? 
                '<div class="no-regressions">✅ No performance regressions detected!</div>' : ''}
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate JUnit XML for CI/CD integration
   */
  private generateJUnitXML(report: TestReport): string {
    const totalTests = report.summary.totalTests;
    const failures = report.summary.failedTests;
    const duration = report.summary.totalDuration / 1000; // Convert to seconds

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Phase4IntegrationTests" tests="${totalTests}" failures="${failures}" time="${duration}">`;

    report.executions.forEach(execution => {
      xml += `
  <testsuite name="${execution.suiteId}" tests="${execution.metrics.totalTests}" failures="${execution.metrics.failedTests}" time="${execution.metrics.totalDuration / 1000}">`;
      
      execution.results.forEach(result => {
        xml += `
    <testcase name="${result.testName}" classname="${result.testFile}" time="${result.duration / 1000}">`;
        
        if (result.status === 'failed') {
          xml += `
      <failure message="${result.error || 'Test failed'}">${result.error || 'Test failed'}</failure>`;
        }
        
        xml += `
    </testcase>`;
      });
      
      xml += `
  </testsuite>`;
    });

    xml += `
</testsuites>`;

    return xml;
  }

  /**
   * Generate supporting files
   */
  private async generateSupportingFiles(report: TestReport): Promise<void> {
    // Generate CSS
    const cssPath = path.join(this.config.outputDir, 'dashboard-styles.css');
    fs.writeFileSync(cssPath, this.generateCSS());

    // Generate JavaScript
    const jsPath = path.join(this.config.outputDir, 'dashboard-scripts.js');
    fs.writeFileSync(jsPath, this.generateJavaScript());
  }

  /**
   * Generate CSS styles
   */
  private generateCSS(): string {
    return `
/* Dashboard Styles */
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    margin: 0;
    padding: 0;
    background-color: #f5f5f5;
}

.dashboard-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

.dashboard-header {
    background: white;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.dashboard-header h1 {
    margin: 0;
    color: #333;
}

.timestamp {
    color: #666;
    font-size: 14px;
    margin-top: 5px;
}

.summary-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin-bottom: 20px;
}

.summary-card {
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    display: flex;
    align-items: center;
}

.card-icon {
    font-size: 24px;
    margin-right: 15px;
}

.card-value {
    font-size: 24px;
    font-weight: bold;
    color: #333;
}

.card-label {
    color: #666;
    font-size: 14px;
}

.main-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 20px;
}

.panel {
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    margin-bottom: 20px;
}

.panel h2 {
    margin-top: 0;
    color: #333;
}

.stat-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
}

.stat-value.passed {
    color: #28a745;
}

.stat-value.failed {
    color: #dc3545;
}

.metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
}

.metric-item {
    padding: 15px;
    border-radius: 6px;
    border-left: 4px solid #007bff;
}

.metric-item.good {
    border-left-color: #28a745;
    background-color: #f8fff9;
}

.metric-item.warning {
    border-left-color: #ffc107;
    background-color: #fffdf5;
}

.metric-item.critical {
    border-left-color: #dc3545;
    background-color: #fff5f5;
}

.suite-item {
    padding: 15px;
    border-radius: 6px;
    margin-bottom: 10px;
    border-left: 4px solid #007bff;
}

.suite-item.completed {
    border-left-color: #28a745;
    background-color: #f8fff9;
}

.suite-item.failed {
    border-left-color: #dc3545;
    background-color: #fff5f5;
}

.suite-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
}

.suite-name {
    font-weight: bold;
}

.suite-status {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    text-transform: uppercase;
}

.suite-status.completed {
    background-color: #28a745;
    color: white;
}

.suite-status.failed {
    background-color: #dc3545;
    color: white;
}

.charts-section {
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    margin-bottom: 20px;
}

.charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 20px;
}

.chart-container {
    height: 300px;
}

/* Dark theme */
.dark-theme {
    background-color: #1a1a1a;
    color: #e0e0e0;
}

.dark-theme .dashboard-header,
.dark-theme .summary-card,
.dark-theme .panel,
.dark-theme .charts-section {
    background-color: #2d2d2d;
    color: #e0e0e0;
}

.dark-theme .dashboard-header h1,
.dark-theme .panel h2 {
    color: #e0e0e0;
}
`;
  }

  /**
   * Generate JavaScript
   */
  private generateJavaScript(): string {
    return `
// Dashboard JavaScript
function initializeDashboard(reportData) {
    console.log('Initializing dashboard with data:', reportData);
    
    if (typeof Chart !== 'undefined') {
        initializeCharts(reportData);
    }
}

function initializeCharts(reportData) {
    // Success Rate Chart
    const successRateCtx = document.getElementById('successRateChart');
    if (successRateCtx) {
        new Chart(successRateCtx, {
            type: 'doughnut',
            data: {
                labels: ['Passed', 'Failed'],
                datasets: [{
                    data: [reportData.summary.passedTests, reportData.summary.failedTests],
                    backgroundColor: ['#28a745', '#dc3545']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Test Success Rate'
                    }
                }
            }
        });
    }
    
    // Performance Trend Chart
    const performanceTrendCtx = document.getElementById('performanceTrendChart');
    if (performanceTrendCtx && reportData.performance.trends.length > 0) {
        const trend = reportData.performance.trends[0];
        new Chart(performanceTrendCtx, {
            type: 'line',
            data: {
                labels: trend.values.map(v => new Date(v.timestamp).toLocaleDateString()),
                datasets: [{
                    label: trend.metric,
                    data: trend.values.map(v => v.value),
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Performance Trends'
                    }
                }
            }
        });
    }
}

function refreshDashboard() {
    // Refresh dashboard data
    console.log('Refreshing dashboard...');
    // This would fetch new data and update the dashboard
}

function initializeTrendCharts(trends) {
    trends.forEach(trend => {
        const canvasId = 'trend-' + trend.metric.replace(/\\s+/g, '-');
        const ctx = document.getElementById(canvasId);
        if (ctx) {
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: trend.values.map(v => new Date(v.timestamp).toLocaleDateString()),
                    datasets: [{
                        label: trend.metric,
                        data: trend.values.map(v => v.value),
                        borderColor: trend.trend === 'improving' ? '#28a745' : 
                                   trend.trend === 'degrading' ? '#dc3545' : '#007bff',
                        backgroundColor: 'rgba(0, 123, 255, 0.1)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }
    });
}
`;
  }

  /**
   * Extract performance metrics from report
   */
  private extractPerformanceMetrics(report: TestReport): PerformanceMetric[] {
    const metrics: PerformanceMetric[] = [];
    
    // Add overall success rate
    metrics.push({
      name: 'Success Rate',
      value: parseFloat((report.summary.overallSuccessRate * 100).toFixed(1)),
      unit: '%',
      threshold: 95,
      status: report.summary.overallSuccessRate >= 0.95 ? 'good' : 
              report.summary.overallSuccessRate >= 0.8 ? 'warning' : 'critical'
    });
    
    // Add average test duration
    const avgDuration = report.executions.reduce((sum, e) => sum + e.metrics.avgDuration, 0) / report.executions.length;
    metrics.push({
      name: 'Avg Test Duration',
      value: parseFloat(avgDuration.toFixed(0)),
      unit: 'ms',
      threshold: 5000,
      status: avgDuration <= 5000 ? 'good' : avgDuration <= 10000 ? 'warning' : 'critical'
    });

    return metrics;
  }

  /**
   * Format duration in human readable format
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  /**
   * Ensure output directory exists
   */
  private ensureOutputDirectory(): void {
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
  }
}
