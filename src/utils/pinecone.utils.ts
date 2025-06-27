import { Pinecone } from '@pinecone-database/pinecone';
import redisClient from '../lib/redisClient';
import { hash } from '../utils/call.helper';
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME;
const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
import { InferenceClient } from '@huggingface/inference';
const hf = new InferenceClient(process.env.HUGGINGFACE_API_KEY);

export async function deleteDocumentVectorsFromPinecone(
    documentId: string | number,
): Promise<void> {
    const index = pinecone.index(PINECONE_INDEX_NAME);
    try {
        // Delete all vectors where metadata.documentId matches
        await index.deleteMany({ documentId });
        // Optionally, you can log or return a result
        console.log(`Deleted vectors for documentId: ${documentId}`);
    } catch (error) {
        // Log and rethrow for higher-level error handling
        console.error('Failed to delete vectors from Pinecone:', error);
        throw error;
    }
}

export async function queryPineconeWithCache(query: string, topK = 5): Promise<any> {
    const queryHash = hash(query);
    const redisKey = `pinecone:query:${queryHash}`;

    const cached = await redisClient.get(redisKey);
    if (cached) return JSON.parse(cached.toString());

    // 2. Query Pinecone (assume vectorizeQuery is a function that returns the embedding)
    const index = pinecone.index(PINECONE_INDEX_NAME);
    const vector = await vectorizeQuery(query); // You must have this function somewhere
    const result = await index.query({
        vector,
        topK,
        includeMetadata: true,
    });

    // 3. Cache in Redis
    await redisClient.set(redisKey, JSON.stringify(result), { EX: 3600 });

    return result;
}


export async function vectorizeQuery(query: string): Promise<number[]> {
    const response = await hf.featureExtraction({
        model: 'sentence-transformers/all-MiniLM-L6-v2',
        inputs: query,
        provider: 'hf-inference',
    });
    if (Array.isArray(response)) {
        if (Array.isArray(response[0])) {
            return response[0] as number[];
        } else if (typeof response[0] === 'number') {
            return response as number[];
        }
    }
    throw new Error('Unexpected embedding response shape');
}
