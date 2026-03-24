import express from 'express';
import scanRouter from './server/routes/scan.js';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

const app = express();
app.use(express.json());
app.use('/api', scanRouter);

const server = app.listen(8081, async () => {
    console.log('Test server on 8081');
    try {
        const res = await fetch('http://localhost:8081/api/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'https://visitelpaso.com/events?gad_source=1' })
        });
        const data = await res.json();
        console.log('Status:', res.status);
        console.log('Response keys:', Object.keys(data));
        if (data.error) console.log('Error:', data.error);
    } catch (err) {
        console.error('Fetch error:', err);
    }
    server.close();
    process.exit(0);
});
