import { Queue } from 'bullmq';
import { environment } from '../environments/environment';

export const documentQueue = new Queue('document-processing', {
    connection: {
        host: environment.REDIS_HOST,
        port: Number(environment.REDIS_PORT),
        password: environment.REDIS_PASSWORD || undefined,
    },
}); 