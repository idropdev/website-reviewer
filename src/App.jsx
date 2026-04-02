import { useState } from 'react'
import './App.css'
import ScannerInput from './components/ScannerInput'
import AIScanVisualizer from './components/AIScanVisualizer'
import EventsPanel from './components/EventsPanel'

function App() {
  const [scanData, setScanData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleScan = async (url) => {
    setLoading(true);
    setScanData(null);
    setError(null);

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error?.message || data.error || 'Scan failed');
        setLoading(false);
        return;
      }

      setScanData(data);
    } catch (err) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="background-grid"></div>
      <ScannerInput onScan={handleScan} />
      {error && (
        <div className="scan-error">
          <span>⚠ SCAN ERROR:</span> {error}
        </div>
      )}
      <AIScanVisualizer scanData={scanData} isLoading={loading} />
      {scanData && <EventsPanel events={scanData.scrape?.events} />}
    </div>
  )
}

export default App
