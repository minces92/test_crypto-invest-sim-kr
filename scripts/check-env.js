const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envLocalPath = path.join(process.cwd(), '.env.local');
console.log('Checking .env.local at:', envLocalPath);

if (fs.existsSync(envLocalPath)) {
    console.log('.env.local exists.');
    const envConfig = dotenv.parse(fs.readFileSync(envLocalPath));

    console.log('Keys found in .env.local:', Object.keys(envConfig));

    if (envConfig.NEWS_API_KEY) {
        console.log('NEWS_API_KEY is present in .env.local');
        console.log('Key length:', envConfig.NEWS_API_KEY.length);
    } else {
        console.log('NEWS_API_KEY is MISSING in .env.local');
    }
} else {
    console.log('.env.local does NOT exist.');
}

const envPath = path.join(process.cwd(), '.env');
console.log('Checking .env at:', envPath);

if (fs.existsSync(envPath)) {
    console.log('.env exists.');
    const envConfig = dotenv.parse(fs.readFileSync(envPath));

    if (envConfig.NEWS_API_KEY) {
        console.log('NEWS_API_KEY is present in .env');
    } else {
        console.log('NEWS_API_KEY is MISSING in .env');
    }
} else {
    console.log('.env does NOT exist.');
}
