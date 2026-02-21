import { useState } from 'react'
import './App.css'
import ScannerInput from './components/ScannerInput'
import AIScanVisualizer from './components/AIScanVisualizer'

function App() {
  const [scanData, setScanData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleScan = (url) => {
    setLoading(true);
    setScanData(null);

    // Simulate scan delay
    setTimeout(() => {
      setScanData({
        url: url,
        timestamp: new Date().toISOString(),
        technologies: ['React', 'Node.js', 'Vite', 'Tailwind CSS'],
        analysis: "The site demonstrates strong semantic structure. Content hierarchy is clear, making it easily parseable by LLMs. Meta tags are present but could be optimized for richer context.",
        raw_content: `[SYSTEM SCAN] EXTRACTING VISIBLE TEXT CONTENT...
[STATUS] SUCCESS

--- START OF CONTENT ---

Home
About Us
Services
Contact
Login

WELCOME TO EXAMPLE CORP
Building the future of digital experiences.

OUR MISSION
We strive to create intuitive, powerful, and accessible web solutions for businesses of all sizes.

Why Choose Us?
1. Performance First
2. User-Centric Design
3. Scalable Architecture

[BUTTON] Get Started
[BUTTON] Learn More

Copyright © 2026 Example Corp. All rights reserved.
Privacy Policy | Terms of Service

--- END OF CONTENT ---
[METADATA] Word Count: 45
[METADATA] Language: en-US`,
        raw: {
          title: "Example Site",
          description: "A sample website for scanning.",
          h1_count: 1,
          img_alt_missing: 2
        }
      });
      setLoading(false);
    }, 2500);
  };

  return (
    <div className="app-container">
      <div className="background-grid"></div>
      <ScannerInput onScan={handleScan} />
      <AIScanVisualizer scanData={scanData} isLoading={loading} />
    </div>
  )
}

export default App
