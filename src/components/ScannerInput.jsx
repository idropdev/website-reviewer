import { useState } from 'react';

const ScannerInput = ({ onScan }) => {
  const [url, setUrl] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (url) onScan(url);
  };

  return (
    <div className="scanner-container">
      <h1 className="title">AI Website Scanner</h1>
      <p className="subtitle">See how AI perceives your website</p>
      <form onSubmit={handleSubmit} className="scanner-form">
        <input
          type="url"
          placeholder="Enter website URL (e.g., https://example.com)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          className="scanner-input"
        />
        <button type="submit" className="scanner-button">
          INITIATE SCAN
        </button>
      </form>
    </div>
  );
};

export default ScannerInput;
