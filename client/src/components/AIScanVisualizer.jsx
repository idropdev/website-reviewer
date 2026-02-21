import React from 'react';

const ScoreBar = ({ label, score }) => {
    const color = score >= 70 ? '#00ff41' : score >= 40 ? '#ffcc00' : '#ff4444';
    return (
        <div className="score-bar-wrapper">
            <div className="score-bar-label">
                <span>{label}</span>
                <span style={{ color }}>{score}/100</span>
            </div>
            <div className="score-bar-track">
                <div
                    className="score-bar-fill"
                    style={{ width: `${score}%`, background: color, boxShadow: `0 0 8px ${color}` }}
                />
            </div>
        </div>
    );
};

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
    const { scores, summary, strengths, issues, recommendations } = analysis;

    const priorityColor = { high: '#ff4444', medium: '#ffcc00', low: '#00ff41' };

    return (
        <div className="scan-results">
            {/* Header */}
            <div className="results-header">
                <h2>SCAN COMPLETE</h2>
                <span className="timestamp">{scanData.url}</span>
            </div>

            {/* Score Cards */}
            <div className="metrics-grid">
                <div className="metric-card">
                    <h3>SEO SCORE</h3>
                    <div className="score" style={{ color: scores.seo >= 70 ? '#00ff41' : scores.seo >= 40 ? '#ffcc00' : '#ff4444' }}>
                        {scores.seo}<span>/100</span>
                    </div>
                </div>
                <div className="metric-card">
                    <h3>AEO SCORE</h3>
                    <div className="score" style={{ color: scores.aeo >= 70 ? '#00ff41' : scores.aeo >= 40 ? '#ffcc00' : '#ff4444' }}>
                        {scores.aeo}<span>/100</span>
                    </div>
                </div>
                <div className="metric-card">
                    <h3>GEO SCORE</h3>
                    <div className="score" style={{ color: scores.geo >= 70 ? '#00ff41' : scores.geo >= 40 ? '#ffcc00' : '#ff4444' }}>
                        {scores.geo}<span>/100</span>
                    </div>
                </div>
            </div>

            {/* Score Bars */}
            <div className="analysis-section">
                <h3>SCORE BREAKDOWN</h3>
                <div className="score-bars">
                    <ScoreBar label="Search Engine Optimization (SEO)" score={scores.seo} />
                    <ScoreBar label="Answer Engine Optimization (AEO)" score={scores.aeo} />
                    <ScoreBar label="Generative Engine Optimization (GEO)" score={scores.geo} />
                </div>
            </div>

            {/* Summary */}
            <div className="analysis-section">
                <h3>AI ANALYSIS SUMMARY</h3>
                <p className="ai-commentary">{summary}</p>
            </div>

            {/* Strengths & Issues */}
            <div className="metrics-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="analysis-section">
                    <h3 style={{ color: '#00ff41' }}>✓ STRENGTHS</h3>
                    <ul className="signal-list strengths">
                        {strengths.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                </div>
                <div className="analysis-section">
                    <h3 style={{ color: '#ff4444' }}>✗ ISSUES</h3>
                    <ul className="signal-list issues">
                        {issues.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                </div>
            </div>

            {/* Recommendations */}
            {recommendations.length > 0 && (
                <div className="analysis-section">
                    <h3>RECOMMENDATIONS</h3>
                    <div className="recommendations-list">
                        {recommendations.map((rec, i) => (
                            <div key={i} className="rec-card" style={{ borderLeftColor: priorityColor[rec.priority] }}>
                                <div className="rec-header">
                                    <span className="rec-priority" style={{ color: priorityColor[rec.priority] }}>
                                        [{rec.priority.toUpperCase()}]
                                    </span>
                                    <span className="rec-item">{rec.item}</span>
                                </div>
                                <p className="rec-why"><strong>Why:</strong> {rec.why}</p>
                                <p className="rec-how"><strong>How:</strong> {rec.how}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Raw Scrape Data */}
            <div className="analysis-section">
                <h3>SCRAPED DATA</h3>
                <div className="scrape-grid">
                    <div className="scrape-field">
                        <span className="scrape-label">TITLE</span>
                        <span className="scrape-value">{scrape.title || '(none)'}</span>
                    </div>
                    <div className="scrape-field">
                        <span className="scrape-label">META DESCRIPTION</span>
                        <span className="scrape-value">{scrape.metaDescription || '(none)'}</span>
                    </div>
                    <div className="scrape-field">
                        <span className="scrape-label">H1 TAGS</span>
                        <span className="scrape-value">{scrape.headings.h1.join(' | ') || '(none)'}</span>
                    </div>
                    <div className="scrape-field">
                        <span className="scrape-label">H2 TAGS</span>
                        <span className="scrape-value">{scrape.headings.h2.slice(0, 5).join(' | ') || '(none)'}</span>
                    </div>
                    <div className="scrape-field">
                        <span className="scrape-label">LINKS</span>
                        <span className="scrape-value">
                            Internal: {scrape.links.internal} | External: {scrape.links.external}
                        </span>
                    </div>
                    <div className="scrape-field">
                        <span className="scrape-label">TECHNICAL</span>
                        <span className="scrape-value">
                            Schema: {scrape.technical.hasSchema ? '✓' : '✗'} |
                            Canonical: {scrape.technical.hasCanonical ? '✓' : '✗'} |
                            Noindex: {scrape.technical.hasNoindex ? '⚠ YES' : '✓ NO'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Visible Text Preview */}
            <div className="raw-data-section">
                <h3>EXTRACTED TEXT CONTENT</h3>
                <div className="terminal-window">
                    <pre className="code-block">
                        {scrape.visibleText
                            ? scrape.visibleText.slice(0, 2000) + (scrape.visibleText.length > 2000 ? '\n\n... [truncated]' : '')
                            : '(no visible text extracted)'}
                    </pre>
                </div>
            </div>
        </div>
    );
};

export default AIScanVisualizer;
