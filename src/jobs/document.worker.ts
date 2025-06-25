import { Worker, Job } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import pdfParse from 'pdf-parse';
import axios from 'axios';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { environment } from '../environments/environment';
import logger from '../logger/winston.logger';

// Environment variables validation
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME;

// Validate required environment variables
const requiredEnvVars = {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    PINECONE_API_KEY,
    OPENAI_API_KEY,
    SUPABASE_BUCKET,
};

const missingVars = Object.entries(requiredEnvVars)
    .filter(([value]) => !value)
    .map(([key]) => key);

if (missingVars.length > 0) {
    logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
}

// Initialize clients with proper error handling
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

const pinecone = new Pinecone({
    apiKey: PINECONE_API_KEY,
});

// Helper: Download file from Supabase with retry logic
async function downloadFile(url: string, maxRetries = 3): Promise<Buffer> {
    logger.info(`Downloading file from: ${url}`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 30000, // 30 second timeout
                maxContentLength: 50 * 1024 * 1024, // 50MB max file size
            });
            return Buffer.from(response.data);
        } catch (error) {
            logger.warn(`Download attempt ${attempt} failed:`, error);
            if (attempt === maxRetries) {
                throw new Error(`Failed to download file after ${maxRetries} attempts: ${error}`);
            }
            // Exponential backoff
            await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
    throw new Error('Unexpected error in downloadFile function');
}

// Helper: Chunk text with overlap for better context preservation
function chunkText(text: string, chunkSize = 1000, overlap = 100): string[] {
    if (!text || text.trim().length === 0) {
        return [];
    }

    const chunks = [];
    let start = 0;

    while (start < text.length) {
        let end = start + chunkSize;

        // If we're not at the end, try to break at a sentence or word boundary
        if (end < text.length) {
            const sentenceEnd = text.lastIndexOf('.', end);
            const wordEnd = text.lastIndexOf(' ', end);

            if (sentenceEnd > start + chunkSize * 0.5) {
                end = sentenceEnd + 1;
            } else if (wordEnd > start + chunkSize * 0.5) {
                end = wordEnd;
            }
        }

        chunks.push(text.slice(start, end).trim());
        start = Math.max(start + chunkSize - overlap, end);
    }

    return chunks.filter((chunk) => chunk.length > 0);
}

// Helper: Generate embeddings with batching
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    const batchSize = 100; // OpenAI allows up to 2048 inputs per request
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);

        try {
            const response = await openai.embeddings.create({
                model: 'text-embedding-3-small', // Updated model name
                input: batch,
                encoding_format: 'float',
            });

            const batchEmbeddings = response.data.map((item) => item.embedding);
            embeddings.push(...batchEmbeddings);

            logger.info(
                `Generated embeddings for batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
                    texts.length / batchSize,
                )}`,
            );

            // Rate limiting: small delay between batches
            if (i + batchSize < texts.length) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        } catch (error) {
            logger.error(
                `Error generating embeddings for batch starting at index ${i}:`,
                error,
            );
            throw error;
        }
    }

    return embeddings;
}

// Helper: Upsert to Pinecone with batching
async function upsertToPinecone(
    index,
    documentId: string,
    fileName: string,
    chunks: string[],
    embeddings: number[][],
    workflowId: number | string,
): Promise<void> {
    const batchSize = 100; // Pinecone batch size limit

    for (let i = 0; i < chunks.length; i += batchSize) {
        const batchChunks = chunks.slice(i, i + batchSize);
        const batchEmbeddings = embeddings.slice(i, i + batchSize);

        const vectors = batchChunks.map((chunk, idx) => ({
            id: `${documentId}-${i + idx}`,
            values: batchEmbeddings[idx],
            metadata: {
                documentId,
                workflowId,
                fileName,
                chunkIndex: i + idx,
                text: chunk.substring(0, 1000), // Store first 1000 chars as metadata
                createdAt: new Date().toISOString(),
            },
        }));

        try {
            await index.upsert(vectors);
            logger.info(
                `Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
                    chunks.length / batchSize,
                )} to Pinecone`,
            );
        } catch (error) {
            logger.error(`Error upserting batch to Pinecone:`, error);
            throw error;
        }
    }
}

// Worker logic
const worker = new Worker(
    'document-processing',
    async (job: Job) => {
        const startTime = Date.now();
        logger.info(`Processing job: ${job.id} - Document: ${job.data.fileName}`);

        const { documentId, filePath, fileName, userId } = job.data;

        try {
            // Update job progress
            await job.updateProgress(10);

            // 1. Download file
            const fileBuffer = await downloadFile(filePath);
            logger.info(`File downloaded successfully. Size: ${fileBuffer.length} bytes`);
            await job.updateProgress(25);

            // 2. Extract text from PDF
            const pdfData = await pdfParse(fileBuffer, {
                max: 0, // No page limit
            });

            const text = pdfData.text?.trim();
            if (!text || text.length === 0) {
                throw new Error('No text content found in PDF');
            }

            logger.info(
                `Text extracted from PDF. Length: ${text.length} characters, Pages: ${pdfData.numpages}`,
            );
            await job.updateProgress(50);

            // 3. Chunk text
            const chunks = chunkText(text, 800, 100); // Smaller chunks with overlap
            if (chunks.length === 0) {
                throw new Error('No valid text chunks created');
            }

            logger.info(`Text chunked into ${chunks.length} segments`);
            await job.updateProgress(60);

            // 4. Generate embeddings
            const embeddings = await generateEmbeddings(chunks);
            logger.info(`Generated ${embeddings.length} embeddings`);
            await job.updateProgress(80);

            // 5. Store in Pinecone
            const pineconeIndex = pinecone.Index(PINECONE_INDEX_NAME);
            await upsertToPinecone(pineconeIndex, documentId, fileName, chunks, embeddings, job.data.workflowId);

            logger.info('All chunks processed and stored in Pinecone');
            await job.updateProgress(90);

            // 6. Update document status in database (optional)
            if (userId) {
                try {
                    const { error } = await supabase
                        .from('documents') // Adjust table name as needed
                        .update({
                            status: 'processed',
                            chunks_count: chunks.length,
                            processed_at: new Date().toISOString(),
                            processing_time_ms: Date.now() - startTime,
                        })
                        .eq('id', documentId)
                        .eq('user_id', userId);

                    if (error) {
                        logger.warn(`Failed to update document status in database: ${error.message}`);
                    }
                } catch (dbError) {
                    logger.warn(`Database update error: ${dbError}`);
                }
            }

            await job.updateProgress(100);

            const processingTime = Date.now() - startTime;
            logger.info(`Job ${job.id} completed successfully in ${processingTime}ms`);

            return {
                status: 'success',
                chunks: chunks.length,
                processingTimeMs: processingTime,
                documentId,
                fileName,
            };
        } catch (error) {
            logger.error(`Error processing document job ${job.id}:`, error);

            // Update document status to failed (optional)
            if (job.data.userId) {
                try {
                    await supabase
                        .from('documents')
                        .update({
                            status: 'failed',
                            error_message: error instanceof Error ? error.message : String(error),
                            failed_at: new Date().toISOString(),
                        })
                        .eq('id', documentId)
                        .eq('user_id', job.data.userId);
                } catch (dbError) {
                    logger.warn(`Failed to update document failure status: ${dbError}`);
                }
            }

            throw error;
        }
    },
    {
        connection: {
            host: environment.REDIS_HOST || 'localhost',
            port: Number(environment.REDIS_PORT) || 6379,
            password: environment.REDIS_PASSWORD || undefined,
            retryDelayOnFailover: 100,
            maxRetriesPerRequest: 3,
        },
        concurrency: 2, // Process 2 jobs concurrently
        limiter: {
            max: 10, // Max 10 jobs per duration
            duration: 60000, // 1 minute
        },
    },
);

// Enhanced event handling
worker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id || 'unknown'} failed:`, err);
});

worker.on('progress', (job, progress) => {
    logger.info(`Job ${job.id} progress: ${progress}%`);
});

worker.on('stalled', (jobId) => {
    logger.warn(`Job ${jobId} stalled`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Shutting down worker gracefully...');
    await worker.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Shutting down worker gracefully...');
    await worker.close();
    process.exit(0);
});

export default worker;
