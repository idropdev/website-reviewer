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

    const { scrape, analysis } = scanData;
    const scores = analysis?.scores ?? {};

    return (
        <div className="scan-results">
            <div className="results-header">
                <h2>SCAN COMPLETE</h2>
                <span className="timestamp">{new Date().toLocaleString()}</span>
            </div>

            <div className="metrics-grid">
                <div className="metric-card">
                    <h3>SEO SCORE</h3>
                    <div className="score">{scores.seo ?? '—'}<span>/100</span></div>
                </div>
                <div className="metric-card">
                    <h3>AEO SCORE</h3>
                    <div className="score">{scores.aeo ?? '—'}<span>/100</span></div>
                </div>
                <div className="metric-card">
                    <h3>GEO SCORE</h3>
                    <div className="score">{scores.geo ?? '—'}<span>/100</span></div>
                </div>
            </div>

            {analysis?.summary && (
                <div className="analysis-section">
                    <h3>AI ANALYSIS</h3>
                    <p className="ai-commentary">{analysis.summary}</p>
                </div>
            )}

            {analysis?.strengths?.length > 0 && (
                <div className="analysis-section">
                    <h3>STRENGTHS</h3>
                    <ul className="findings-list findings-strengths">
                        {analysis.strengths.map((s, i) => (
                            <li key={i}>{s}</li>
                        ))}
                    </ul>
                </div>
            )}

            {analysis?.issues?.length > 0 && (
                <div className="analysis-section">
                    <h3>ISSUES</h3>
                    <ul className="findings-list findings-issues">
                        {analysis.issues.map((s, i) => (
                            <li key={i}>{s}</li>
                        ))}
                    </ul>
                </div>
            )}

            {analysis?.recommendations?.length > 0 && (
                <div className="analysis-section">
                    <h3>RECOMMENDATIONS</h3>
                    <div className="recommendations-list">
                        {analysis.recommendations.map((r, i) => (
                            <div key={i} className={`recommendation-card priority-${r.priority}`}>
                                <div className="rec-header">
                                    <span className={`rec-priority priority-${r.priority}`}>{r.priority.toUpperCase()}</span>
                                    <span className="rec-title">{r.item}</span>
                                </div>
                                <p className="rec-why"><strong>Why:</strong> {r.why}</p>
                                <p className="rec-how"><strong>How:</strong> {r.how}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {scrape?.schema?.types?.length > 0 && (
                <div className="analysis-section">
                    <h3>DETECTED SCHEMA TYPES</h3>
                    <div className="tech-tags">
                        {scrape.schema.types.map((type, index) => (
                            <span key={index} className="tech-tag">{type}</span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIScanVisualizer;
