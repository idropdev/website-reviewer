import React from 'react';

// ─── Diagnostic notice when events are in text but not found in DOM ───────────
const ExtractionNotice = ({ note, textEventsFound, eventsCount }) => {
    if (note === 'text_has_dates_no_structure') {
        return (
            <div className="events-render-notice events-notice-warn">
                <span className="events-notice-icon">⚠</span>
                <div className="events-notice-body">
                    <strong>Events found in page text — couldn't extract structure</strong>
                    <p>
                        {textEventsFound} date pattern{textEventsFound !== 1 ? 's' : ''} found in the page content,
                        but events couldn't be read from the HTML structure. This usually means:
                    </p>
                    <ul>
                        <li>Events are loaded via JavaScript — the page wasn't fully rendered when scanned</li>
                        <li>Events use custom or non-standard HTML markup our parser doesn't recognise</li>
                    </ul>
                    <p className="events-notice-tip">
                        💡 <strong>This is a website-side issue.</strong> Adding{' '}
                        <strong>Schema.org Event markup</strong> would make events reliably discoverable by
                        scanners, search engines, and AI — regardless of how they're rendered.
                    </p>
                </div>
            </div>
        );
    }

    if (note === 'partial_render') {
        return (
            <div className="events-render-notice events-notice-warn">
                <span className="events-notice-icon">⚠</span>
                <div className="events-notice-body">
                    <strong>Events extracted from page text (not from HTML structure)</strong>
                    <p>
                        The page appears to load events via JavaScript. Events below were parsed from
                        the page's visible text content and may be incomplete. Adding{' '}
                        <strong>Schema.org Event markup</strong> would make events reliably
                        machine-readable.
                    </p>
                </div>
            </div>
        );
    }

    if (note === 'may_have_more_events') {
        return (
            <div className="events-render-notice events-notice-info">
                <span className="events-notice-icon">ℹ</span>
                <div className="events-notice-body">
                    <strong>More events may exist on this page</strong>
                    <p>
                        {textEventsFound} date patterns were found in the page text, but only{' '}
                        {eventsCount} event{eventsCount !== 1 ? 's' : ''} were extracted from the HTML
                        structure. Some events may not have been captured due to JavaScript rendering.
                    </p>
                </div>
            </div>
        );
    }

    return null;
};

// ─── Main component ───────────────────────────────────────────────────────────
const EventsPanel = ({ events }) => {
    if (!events) return null;

    // No events detected
    if (!events.detected) {
        // Special case: text has date patterns but DOM extraction found nothing
        if (events.extractionNote === 'text_has_dates_no_structure') {
            return (
                <div className="analysis-section events-section">
                    <h3>EVENTS DETECTION</h3>
                    <ExtractionNotice
                        note="text_has_dates_no_structure"
                        textEventsFound={events.textEventsFound}
                    />
                </div>
            );
        }

        // Generic no-events state
        return (
            <div className="analysis-section events-section">
                <h3>EVENTS DETECTION</h3>
                <div className="events-empty">
                    <span className="events-empty-icon">📅</span>
                    <p>No events detected on this page.</p>
                    <p className="events-empty-hint">
                        If this is an events page, consider adding Schema.org Event markup so
                        search engines and AI can always discover your events.
                    </p>
                </div>
            </div>
        );
    }

    // Events detected — may have a diagnostic note
    return (
        <div className="analysis-section events-section">
            <h3>EVENTS DETECTION</h3>

            {/* Diagnostic notice (partial_render or may_have_more_events) */}
            {events.extractionNote && (
                <ExtractionNotice
                    note={events.extractionNote}
                    textEventsFound={events.textEventsFound}
                    eventsCount={events.count}
                />
            )}

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
                    <div key={index} className={`event-card ${event.source === 'text' ? 'event-card-text-source' : ''}`}>
                        <div className="event-card-header">
                            <span className="event-card-index">#{index + 1}</span>
                            <span className={`event-card-source ${event.source === 'text' ? 'source-text' : 'source-dom'}`}>
                                {event.source === 'text' ? 'from page text' : event.source}
                            </span>
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
