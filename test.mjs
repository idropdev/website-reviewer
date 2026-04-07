import { validateUrl } from './server/utils/validators.js';
import { scrape } from './server/services/scraper.js';
import { score } from './server/services/scoring.js';
import { aiScore } from './server/services/aiScoring.js';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

async function main() {
    try {
        const url = 'https://visitelpaso.com/events?gad_source=1';
        console.log('Validating:', url);
        const val = await validateUrl(url);
        console.log('Validation:', val);

        if (!val.ok) {
            console.log('Validation failed');
            return;
        }

        console.log('Scraping:', val.url);
        const res = await scrape(val.url);
        console.log('Scrape done, title:', res.title, 'visibleText length:', res.visibleText?.length);

        console.log('Scoring (simulation)...');
        const simScore = score(res);
        console.log('Simulation score:', simScore.scores);

        if (process.env.GEMINI_API_KEY) {
            console.log('AI Scoring...');
            const ai = await aiScore(res);
            console.log('AI score ok?', !!ai);
        } else {
            console.log('No Gemini AI key found.');
        }

    } catch (err) {
        console.error('Error during process:', err);
    }
    process.exit(0);
}
main();
