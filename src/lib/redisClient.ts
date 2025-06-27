import { createClient } from 'redis';
import { environment } from '../environments/environment';


const redisClient = createClient({
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT)
    }
});


redisClient.on('error', (err) => {
    console.error('Redis Client Error', err);
});

(async () => {
    try {
        await redisClient.connect();
        console.log('Connected to Redis');
    } catch (err) {
        console.error('Could not connect to Redis:', err);
    }
})();

export default redisClient; 