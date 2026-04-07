import React from 'react';

// ─── Always-visible detection status notice ───────────────────────────────────
// Shows one of four states depending on how events were detected:
//   1. schema      → green: has proper Schema.org markup (best case)
//   2. dom_only    → yellow: DOM detected events, no schema markup
//   3. partial     → orange: some/all events came from text, not DOM
//   4. text_only   → orange+: dates found in text but no names extracted
const DetectionStatus = ({ events }) => {
    // Best case: site uses Schema.org Event markup
    if (events.hasSchema) {
        return (
            <div className="events-render-notice events-notice-ok">
                <span className="events-notice-icon">✓</span>
                <div className="events-notice-body">
                    <strong>Events use Schema.org structured data — great!</strong>
                    <p>
                        This page marks up events with Schema.org Event markup. Search engines
                        and AI assistants can reliably discover, read, and display these events
                        without relying on screen-scraping.
                    </p>
                </div>
            </div>
        );
    }

    // Text dates found but couldn't extract names → worst extraction case (shown in "no events" path too)
    const note = events.extractionNote;

    if (note === 'text_has_dates_no_structure') {
        return (
            <div className="events-render-notice events-notice-warn">
                <span className="events-notice-icon">⚠</span>
                <div className="events-notice-body">
                    <strong>Events found in page text — couldn't extract structure</strong>
                    <p>
                        {events.textEventsFound} date pattern{events.textEventsFound !== 1 ? 's' : ''} were
                        found in the page content, but events couldn't be read from the HTML. This usually means:
                    </p>
                    <ul>
                        <li>Events load via JavaScript — the page may not have fully rendered when scanned</li>
                        <li>Events use custom HTML that our parser doesn't recognise</li>
                    </ul>
                    <p className="events-notice-tip">
                        💡 <strong>This is a website-side issue.</strong> Adding{' '}
                        <strong>Schema.org Event markup</strong> makes events reliably readable by
                        scanners, search engines, and AI — regardless of how they're rendered.
                    </p>
                </div>
            </div>
        );
    }

    // Text extraction supplemented or replaced DOM results
    if (note === 'partial_render') {
        return (
            <div className="events-render-notice events-notice-warn">
                <span className="events-notice-icon">⚠</span>
                <div className="events-notice-body">
                    <strong>Some events were read from page text, not from HTML structure</strong>
                    <p>
                        The page's HTML didn't contain enough structured event data, so some events
                        were parsed from the visible text. Those are marked{' '}
                        <span className="notice-tag-text">"from page text"</span> and may be
                        less precise. Without structured markup, search engines and AI may miss
                        or misread these events.
                    </p>
                    <p className="events-notice-tip">
                        💡 <strong>This is a website-side issue.</strong> Adding{' '}
                        <strong>Schema.org Event markup</strong> would make all events reliably
                        discoverable — by this tool, search engines, and AI assistants.
                    </p>
                </div>
            </div>
        );
    }

    // DOM detected events cleanly, but no schema markup
    return (
        <div className="events-render-notice events-notice-neutral">
            <span className="events-notice-icon">ℹ</span>
            <div className="events-notice-body">
                <strong>Events detected from HTML structure — no structured markup found</strong>
                <p>
                    Events were found by scanning the page's HTML elements, but the site doesn't
                    use <strong>Schema.org Event markup</strong>. This means search engines and AI
                    assistants may struggle to reliably identify these events — they are relying
                    on the same visual scraping this tool uses, which can break when the site changes.
                </p>
                <p className="events-notice-tip">
                    💡 Adding <strong>Schema.org Event markup</strong> (JSON-LD) is the industry
                    standard for event discoverability and takes less than an hour to implement.
                </p>
            </div>
        </div>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────
const EventsPanel = ({ events }) => {
    if (!events) return null;

    // No events detected at all
    if (!events.detected) {
        return (
            <div className="analysis-section events-section">
                <h3>EVENTS DETECTION</h3>
                {/* Still show a status notice — explain why nothing was found */}
                <DetectionStatus events={events} />
                {/* Only show the empty state if the notice above isn't already covering it */}
                {events.extractionNote !== 'text_has_dates_no_structure' && (
                    <div className="events-empty">
                        <span className="events-empty-icon">📅</span>
                        <p>No events detected on this page.</p>
                        <p className="events-empty-hint">
                            If this is an events page, consider adding Schema.org Event markup so
                            search engines and AI can always discover your events.
                        </p>
                    </div>
                )}
            </div>
        );
    }

    // Events detected — always show status notice first
    return (
        <div className="analysis-section events-section">
            <h3>EVENTS DETECTION</h3>

            {/* Always-visible status notice */}
            <DetectionStatus events={events} />

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
