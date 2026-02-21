import React from 'react';

const AIScanVisualizer = ({ scanData, isLoading }) => {
    if (isLoading) {
        return (
            <div className="loading-container">
                <div className="loading-text">
                    <span>SCANNING PROTOCOLS INITIATED...</span>
                    <span>ANALYZING DOM STRUCTURE...</span>
                    <span>EXTRACTING METADATA...</span>
                </div>
                <div className="scan-line"></div>
            </div>
        );
    }

    if (!scanData) return null;

    return (
        <div className="scan-results">
            <div className="results-header">
                <h2>SCAN COMPLETE</h2>
                <span className="timestamp">{new Date(scanData.timestamp).toLocaleString()}</span>
            </div>

            <div className="metrics-grid">
                <div className="metric-card">
                    <h3>AI READABILITY</h3>
                    <div className="score">92<span>/100</span></div>
                </div>
                <div className="metric-card">
                    <h3>STRUCTURE</h3>
                    <div className="score">88<span>/100</span></div>
                </div>
                <div className="metric-card">
                    <h3>SEO SIGNAL</h3>
                    <div className="score">High</div>
                </div>
            </div>

            <div className="analysis-section">
                <h3>DETECTED TECHNOLOGIES</h3>
                <div className="tech-tags">
                    {scanData.technologies.map((tech, index) => (
                        <span key={index} className="tech-tag">{tech}</span>
                    ))}
                </div>
            </div>

            <div className="analysis-section">
                <h3>AI ANALYSIS</h3>
                <p className="ai-commentary">{scanData.analysis}</p>
            </div>

            <div className="raw-data-section">
                <h3>EXTRACTED TEXT CONTENT</h3>
                <div className="terminal-window">
                    <pre className="code-block">{scanData.raw_content}</pre>
                </div>
            </div>
        </div>
    );
};

export default AIScanVisualizer;
