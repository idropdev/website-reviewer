import { useState } from 'react';

const ScannerInput = ({ onScan, isLoading }) => {
    const [url, setUrl] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        
        let finalUrl = url.trim();
        if (finalUrl && !/^https?:\/\//i.test(finalUrl)) {
            finalUrl = 'https://' + finalUrl;
        }

        if (finalUrl && !isLoading) {
            setUrl(finalUrl); // update input box visually 
            onScan(finalUrl);
        }
    };

    return (
        <div className="scanner-container">
            <h1 className="title">AI Website Scanner</h1>
            <p className="subtitle">See how AI perceives your website — SEO · AEO · GEO</p>
            <form onSubmit={handleSubmit} className="scanner-form">
                <input
                    type="text"
                    placeholder="Enter website URL (e.g., visitelpaso.com)"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                    disabled={isLoading}
                    className="scanner-input"
                />
                <button type="submit" disabled={isLoading} className="scanner-button">
                    {isLoading ? 'SCANNING...' : 'INITIATE SCAN'}
                </button>
            </form>
        </div>
    );
};

export default ScannerInput;
