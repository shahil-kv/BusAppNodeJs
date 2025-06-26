import { Pinecone } from '@pinecone-database/pinecone';
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME;
const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });

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
