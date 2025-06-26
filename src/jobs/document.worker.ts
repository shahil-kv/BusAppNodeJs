import { Worker, Job } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import pdfParse from 'pdf-parse';
import axios from 'axios';
import { InferenceClient } from '@huggingface/inference';
import { Pinecone } from '@pinecone-database/pinecone';
import { environment } from '../environments/environment';
import logger from '../logger/winston.logger';

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME;

// Initialize clients
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const hf = new InferenceClient(HUGGINGFACE_API_KEY);
const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });

// Store vectors in Pinecone in batches to avoid memory issues
const BATCH_SIZE = 10; // Reduced batch size for better memory management
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit
const MAX_CHUNKS = 1000; // Maximum chunks per document

// Memory management utilities
function logMemoryUsage(stage: string) {
  const memUsage = process.memoryUsage();
  logger.info(`Memory usage at ${stage}:`, {
    rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
    external: `${Math.round(memUsage.external / 1024 / 1024)} MB`,
  });
}

function forceGarbageCollection() {
  if (global.gc) {
    global.gc();
    logger.info('Forced garbage collection');
  }
}

// Download file from Supabase with size check and progress logging
async function downloadFile(url: string, job: Job): Promise<Buffer> {
  logger.info(`Starting download from: ${url}`);

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 60000, // Increased timeout for large files
      maxContentLength: MAX_FILE_SIZE,
      validateStatus: (status) => status < 500,
      onDownloadProgress: (progressEvent) => {
        const downloaded = progressEvent.loaded;
        const total = progressEvent.total;

        if (total) {
          const percent = Math.round((downloaded / total) * 100);
          const downloadedKB = Math.round(downloaded / 1024);
          const totalKB = Math.round(total / 1024);

          logger.info(
            `Download progress: ${percent}% (${downloadedKB}KB / ${totalKB}KB)`,
          );

          if (downloaded > MAX_FILE_SIZE) {
            throw new Error(
              `File too large: ${Math.round(
                downloaded / 1024 / 1024,
              )}MB exceeds ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB limit`,
            );
          }
        } else {
          const downloadedKB = Math.round(downloaded / 1024);
          logger.info(`Downloaded: ${downloadedKB}KB (total size unknown)`);

          if (downloaded > MAX_FILE_SIZE) {
            throw new Error(
              `File too large: ${Math.round(
                downloaded / 1024 / 1024,
              )}MB exceeds ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB limit`,
            );
          }
        }
      },
    });

    // Check for HTTP error status
    if (response.status !== 200) {
      logger.error(
        `Download failed with status ${response.status}: ${response.statusText}`,
      );
      logger.error(`Response headers:`, response.headers);
      throw new Error(
        `Download failed: HTTP ${response.status} - ${response.statusText}`,
      );
    }

    const buffer = Buffer.from(response.data);
    const fileSizeKB = Math.round(buffer.length / 1024);

    logger.info(`Download completed: ${fileSizeKB}KB`);

    // Validate PDF header
    const header = buffer.toString('ascii', 0, 8);
    if (!header.startsWith('%PDF')) {
      logger.error(`Invalid PDF file. Header: ${header}`);
      throw new Error('File is not a valid PDF');
    }

    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(
        `File too large: ${Math.round(
          buffer.length / 1024 / 1024,
        )}MB exceeds ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB limit`,
      );
    }

    return buffer;
  } catch (error) {
    logger.error(`Download error details:`, {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      headers: error.response?.headers,
      url: url,
    });

    if (error.response?.status === 400) {
      throw new Error(
        `File not found or access denied (400). Check if the file exists and is publicly accessible.`,
      );
    } else if (error.response?.status === 401) {
      throw new Error(`Authentication failed (401). Check Supabase credentials.`);
    } else if (error.response?.status === 403) {
      throw new Error(`Access forbidden (403). Check file permissions.`);
    } else if (error.response?.status === 404) {
      throw new Error(`File not found (404). The file may have been deleted or moved.`);
    } else if (error.code === 'ECONNABORTED') {
      throw new Error(`Download timeout. The file may be too large or network is slow.`);
    } else {
      throw new Error(`Download failed: ${error.message}`);
    }
  }
}

function chunkText(text: string, chunkSize = 512, overlap = 50): string[] {
  if (!text || text.trim().length === 0) {
    logger.info('No text to chunk');
    return [];
  }

  if (overlap >= chunkSize) {
    logger.warn('Overlap >= chunkSize, setting overlap to 0');
    overlap = 0;
  }

  const chunks: string[] = [];
  let start = 0;
  const len = text.length;

  while (start < len) {
    const end = Math.min(start + chunkSize, len);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 20) {
      chunks.push(chunk);
    }
    // Always advance by at least 1
    const nextStart = start + chunkSize - overlap;
    if (nextStart <= start) {
      logger.warn('Chunking loop detected, breaking to prevent infinite loop');
      break;
    }
    start = nextStart;
    if (chunks.length > 1000) {
      logger.error('Too many chunks generated, stopping to prevent crash');
      break;
    }
  }

  logger.info(`Created ${chunks.length} chunks from document`);
  return chunks;
}

// Generate embeddings using Hugging Face
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (const text of texts) {
    try {
      const response = await hf.featureExtraction({
        model: 'sentence-transformers/all-MiniLM-L6-v2',
        inputs: text,
      });

      const embedding = Array.isArray(response[0]) ? response[0] : response;
      embeddings.push(embedding as number[]);

      // Rate limiting for free tier
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      logger.error('Error generating embedding:', error);
      throw error;
    }
  }

  return embeddings;
}

// Process PDF in smaller sections to reduce memory usage
async function processPDFInSections(fileBuffer: Buffer): Promise<string[]> {
  logger.info('Starting PDF text extraction...');

  // Check if buffer is valid
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('File buffer is empty or invalid');
  }

  if (fileBuffer.length < 100) {
    throw new Error(
      `File too small: ${fileBuffer.length} bytes. Expected a valid PDF file.`,
    );
  }

  logger.info(`Processing PDF with ${fileBuffer.length} bytes`);

  try {
    const pdfData = await pdfParse(fileBuffer);
    const text = pdfData.text?.trim();

    if (!text || text.length === 0) {
      throw new Error('No text found in PDF');
    }

    const textSizeKB = Math.round(text.length / 1024);
    logger.info(`PDF text extracted: ${textSizeKB}KB of text`);

    // Create chunks
    logger.info('Creating text chunks...');
    const chunks = chunkText(text);

    logger.info(`Created ${chunks.length} chunks from document`);

    if (chunks.length > MAX_CHUNKS) {
      throw new Error(`Too many chunks: ${chunks.length} exceeds limit of ${MAX_CHUNKS}`);
    }

    return chunks;
  } catch (error) {
    logger.error('Error processing PDF:', error);
    throw new Error(`PDF processing failed: ${error.message}`);
  }
}

async function processAndStoreChunks(
  documentId: string,
  fileName: string,
  chunks: string[],
  workflowId: string,
): Promise<void> {
  const index = pinecone.Index(PINECONE_INDEX_NAME);
  const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);

  logger.info(
    `Processing ${chunks.length} chunks in ${totalBatches} batches of ${BATCH_SIZE}`,
  );

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const batchChunks = chunks.slice(i, i + BATCH_SIZE);

    logger.info(
      `Processing batch ${batchNumber}/${totalBatches} (${batchChunks.length} chunks)`,
    );

    // Log memory before processing batch
    logMemoryUsage(`before batch ${batchNumber}`);

    logger.info(`Generating embeddings for batch ${batchNumber}...`);
    const embeddings = await generateEmbeddings(batchChunks);
    logger.info(`Generated ${embeddings.length} embeddings for batch ${batchNumber}`);

    const vectors = batchChunks.map((chunk, j) => ({
      id: `${documentId}-${i + j}`,
      values: embeddings[j],
      metadata: {
        documentId,
        workflowId,
        fileName,
        text: chunk.substring(0, 1000),
        chunkIndex: i + j,
      },
    }));

    logger.info(
      `Uploading ${vectors.length} vectors to Pinecone for batch ${batchNumber}...`,
    );
    await index.upsert(vectors);
    logger.info(`Successfully uploaded batch ${batchNumber} to Pinecone`);

    // Clear references to free memory
    batchChunks.splice(0);
    embeddings.splice(0);
    vectors.splice(0);

    // Force garbage collection after each batch
    forceGarbageCollection();

    // Log memory after processing batch
    logMemoryUsage(`after batch ${batchNumber}`);

    // Small delay to allow GC to work
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  logger.info(`Completed processing all ${chunks.length} chunks`);
}

// Main worker
const worker = new Worker(
  'document-processing',
  async (job: Job) => {
    const { documentId, filePath, fileName, userId, workflowId } = job.data;

    try {
      logger.info(`Starting job ${job.id} for document: ${fileName}`);
      logMemoryUsage('job start');

      // Download PDF
      logger.info('Starting file download...');
      const fileBuffer = await downloadFile(filePath, job);
      logMemoryUsage('after download');

      // Process PDF in sections
      logger.info('Starting PDF processing...');
      const chunks = await processPDFInSections(fileBuffer);
      logger.info(`Created ${chunks.length} chunks from document`);

      // Clear file buffer to free memory immediately
      fileBuffer.fill(0);
      forceGarbageCollection();
      logMemoryUsage('after text extraction');

      // Store in Pinecone in batches
      logger.info('Starting Pinecone upload...');
      await processAndStoreChunks(documentId, fileName, chunks, workflowId);

      // Clear chunks to free memory
      chunks.splice(0);
      forceGarbageCollection();
      logMemoryUsage('after processing');

      // Update database
      if (userId) {
        logger.info('Updating database...');
        await supabase
          .from('documents')
          .update({
            status: 'processed',
            chunks_count: chunks.length,
            processed_at: new Date().toISOString(),
          })
          .eq('id', documentId)
          .eq('user_id', userId);
      }

      logMemoryUsage('job complete');

      logger.info(`Job ${job.id} completed successfully for document: ${fileName}`);

      return {
        status: 'success',
        chunks: chunks.length,
        documentId,
        fileName,
      };
    } catch (error) {
      logger.error(`Job ${job.id} failed:`, error);
      logMemoryUsage('job failed');

      if (job.data.userId) {
        await supabase
          .from('documents')
          .update({
            status: 'failed',
            error_message: error.message,
            failed_at: new Date().toISOString(),
          })
          .eq('id', documentId)
          .eq('user_id', job.data.userId);
      }

      throw error;
    }
  },
  {
    connection: {
      host: environment.REDIS_HOST || 'localhost',
      port: Number(environment.REDIS_PORT) || 6379,
      password: environment.REDIS_PASSWORD || undefined,
    },
    concurrency: 1, // Process 1 job at a time for free tier
  },
);

worker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed successfully`);
  forceGarbageCollection();
});

worker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed:`, err);
  forceGarbageCollection();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  await worker.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  await worker.close();
  process.exit(0);
});



export default worker;
