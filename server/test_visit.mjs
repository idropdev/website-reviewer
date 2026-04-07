const url = 'https://visitelpaso.com/events?gad_source=1';
const req = await fetch('http://localhost:8080/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
});
const data = await req.json();
console.log(JSON.stringify(data.scrape?.events, null, 2));
console.log('Error:', data.error);
