
// @ts-nocheck
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars from .env file in root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const redis = new Redis({
    url: process.env.REDIS_URL!,
    token: process.env.REDIS_TOKEN!,
});

async function main() {
    console.log('Starting Redis cleanup...');

    try {
        const patterns = ['room:*', 'queue:*', 'queue_ref:*', 'socket:*'];
        let deletedCount = 0;

        for (const pattern of patterns) {
            let cursor: number | string = 0;
            do {
                const [nextCursor, keys] = await redis.scan(cursor as number, { match: pattern, count: 100 });
                cursor = nextCursor;

                if (keys.length > 0) {
                    const deleted = await redis.del(...keys);
                    deletedCount += deleted;
                    console.log(`Deleted ${deleted} keys matching ${pattern}`);
                }
            } while (cursor !== 0 && cursor !== "0");
        }

        console.log(`Cleanup complete. Total keys deleted: ${deletedCount}`);
    } catch (error) {
        console.error('Cleanup failed:', error);
    }
}

main();
