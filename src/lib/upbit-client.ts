import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config';

export interface UpbitAccount {
    currency: string;
    balance: string;
    locked: string;
    avg_buy_price: string;
    avg_buy_price_modified: boolean;
    unit_currency: string;
}

export async function getUpbitAccounts(): Promise<UpbitAccount[]> {
    const accessKey = process.env.UPBIT_ACCESS_KEY;
    const secretKey = process.env.UPBIT_SECRET_KEY;

    if (!accessKey || !secretKey) {
        throw new Error('UPBIT_ACCESS_KEY or UPBIT_SECRET_KEY is missing in environment variables');
    }

    const payload = {
        access_key: accessKey,
        nonce: uuidv4(),
    };

    const token = jwt.sign(payload, secretKey);

    const response = await fetch('https://api.upbit.com/v1/accounts', {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upbit API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
}
