// Quick end-to-end test for /api/scan
import http from 'http';

function post(body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const req = http.request({
            hostname: 'localhost',
            port: 8080,
            path: '/api/scan',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
        }, (res) => {
            let raw = '';
            res.on('data', (c) => (raw += c));
            res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function run() {
    console.log('\n=== Test 1: https://example.com (should succeed) ===');
    const r1 = await post({ url: 'https://example.com' });
    console.log('Status:', r1.status);
    console.log('URL:', r1.body.url);
    console.log('Title:', r1.body.scrape?.title);
    console.log('H1s:', r1.body.scrape?.headings?.h1);
    console.log('Scores:', r1.body.analysis?.scores);
    console.log('Strengths:', r1.body.analysis?.strengths?.length, 'items');
    console.log('Issues:', r1.body.analysis?.issues?.length, 'items');
    console.log('Recommendations:', r1.body.analysis?.recommendations?.length, 'items');
    console.log('Summary snippet:', r1.body.analysis?.summary?.slice(0, 100));

    console.log('\n=== Test 2: http://localhost (SSRF — should be blocked) ===');
    const r2 = await post({ url: 'http://localhost' });
    console.log('Status:', r2.status);
    console.log('Error:', r2.body.error);

    console.log('\n=== Test 3: http://192.168.1.1 (private IP — should be blocked) ===');
    const r3 = await post({ url: 'http://192.168.1.1' });
    console.log('Status:', r3.status);
    console.log('Error:', r3.body.error);

    console.log('\n=== Test 4: not-a-url (invalid — should be rejected) ===');
    const r4 = await post({ url: 'not-a-url' });
    console.log('Status:', r4.status);
    console.log('Error:', r4.body.error);

    console.log('\nAll tests complete.');
}

run().catch(console.error);
