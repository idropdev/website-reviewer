import { useState } from 'react'
import './App.css'
import ScannerInput from './components/ScannerInput'
import AIScanVisualizer from './components/AIScanVisualizer'

function App() {
    const [scanData, setScanData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleScan = async (url) => {
        setLoading(true);
        setScanData(null);
        setError(null);

        try {
            const response = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                const msg = data?.error?.message || `Server error: ${response.status}`;
                setError(msg);
                return;
            }

            setScanData(data);
        } catch (err) {
            setError(`Network error: ${err.message}. Is the server running on port 8080?`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="app-container">
            <div className="background-grid"></div>
            <ScannerInput onScan={handleScan} isLoading={loading} />
            {error && (
                <div className="error-banner">
                    <span className="error-icon">⚠</span> {error}
                </div>
            )}
            <AIScanVisualizer scanData={scanData} isLoading={loading} />
        </div>
    )
}

export default App
