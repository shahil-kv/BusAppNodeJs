import { Queue } from 'bullmq';
import { environment } from '../environments/environment';

export const documentQueue = new Queue('document-processing'); 