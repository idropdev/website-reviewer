import React from 'react';

const EventsPanel = ({ events }) => {
    if (!events || !events.detected) {
        return (
            <div className="analysis-section events-section">
                <h3>EVENTS DETECTION</h3>
                <div className="events-empty">
                    <span className="events-empty-icon">📅</span>
                    <p>No events detected on this page.</p>
                    <p className="events-empty-hint">
                        If this is an events page, consider adding Schema.org Event markup so search engines and AI can discover your events.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="analysis-section events-section">
            <h3>EVENTS DETECTION</h3>

            {/* Status badges */}
            <div className="events-status-grid">
                <div className="events-badge events-badge-count">
                    <span className="events-badge-value">{events.count}</span>
                    <span className="events-badge-label">Events Found</span>
                </div>
                <div className={`events-badge ${events.hasSchema ? 'events-badge-ok' : 'events-badge-warn'}`}>
                    <span className="events-badge-icon">{events.hasSchema ? '✓' : '✗'}</span>
                    <span className="events-badge-label">Schema.org</span>
                </div>
                <div className={`events-badge ${events.hasDateInfo ? 'events-badge-ok' : 'events-badge-warn'}`}>
                    <span className="events-badge-icon">{events.hasDateInfo ? '✓' : '✗'}</span>
                    <span className="events-badge-label">Date Info</span>
                </div>
                <div className={`events-badge ${events.hasTicketLinks ? 'events-badge-ok' : 'events-badge-warn'}`}>
                    <span className="events-badge-icon">{events.hasTicketLinks ? '✓' : '✗'}</span>
                    <span className="events-badge-label">Ticket Links</span>
                </div>
            </div>

            {/* Detection signals */}
            {events.signals && events.signals.length > 0 && (
                <div className="events-signals">
                    <span className="events-signals-label">Detection methods:</span>
                    {events.signals.map((sig, i) => (
                        <span key={i} className="events-signal-tag">{sig}</span>
                    ))}
                </div>
            )}

            {/* All events list */}
            <div className="events-list">
                {events.items.map((event, index) => (
                    <div key={index} className="event-card">
                        <div className="event-card-header">
                            <span className="event-card-index">#{index + 1}</span>
                            <span className="event-card-source">{event.source}</span>
                        </div>
                        <div className="event-card-name">
                            {event.url ? (
                                <a href={event.url} target="_blank" rel="noopener noreferrer">
                                    {event.name}
                                </a>
                            ) : (
                                event.name
                            )}
                        </div>
                        <div className="event-card-meta">
                            {event.date && (
                                <span className="event-card-date">📅 {event.date}</span>
                            )}
                            {event.venue && (
                                <span className="event-card-venue">📍 {event.venue}</span>
                            )}
                        </div>
                        {event.description && (
                            <p className="event-card-desc">{event.description}</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default EventsPanel;
