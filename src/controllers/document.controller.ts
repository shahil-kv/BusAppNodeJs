import { Response, Request } from 'express';
import prisma from '../lib/prisma';
import { documentQueue } from '../jobs/document.queue';
import fs from 'fs';
import path from 'path';
import type { File as MulterFile } from 'multer';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { createClient } from '@supabase/supabase-js';

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET;

// Initialize clients
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function uploadFileToSupabase(file: MulterFile): Promise<string> {
  const fileName = `documents/${Date.now()}_${path.basename(file.originalname)}`;
  const fileBuffer = fs.readFileSync(file.path);

  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(fileName, fileBuffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(fileName);

  return publicUrl;
}

async function deleteFileFromSupabase(fileUrl: string): Promise<void> {
  const bucketName = SUPABASE_BUCKET; // 'workflowdocuments' based on your screenshot
  const publicPrefix = `/storage/v1/object/public/${bucketName}/`;

  const url = new URL(fileUrl);
  const idx = url.pathname.indexOf(publicPrefix);

  if (idx === -1) {
    throw new Error('Invalid file URL format');
  }

  const encodedPath = url.pathname.slice(idx + publicPrefix.length);
  const decodedPath = decodeURIComponent(encodedPath); // Removes %20 etc.

  console.log('Deleting from Supabase path:', decodedPath);

  const { error } = await supabase.storage.from(bucketName).remove([decodedPath]);

  if (error) {
    throw new Error(`Supabase delete failed: ${error.message}`);
  }
}

const manageWorkFlowDocument = asyncHandler(async (req, res: Response) => {
  const { opsMode, documentId, workflowId } = req.body;
  const file = req.file as MulterFile | undefined;
  let toDelete;

  switch (opsMode) {
    case 'INSERT': {
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      if (!workflowId) {
        return res.status(400).json({ error: 'workflowId required' });
      }

      try {
        // Upload file to Supabase
        const fileUrl = await uploadFileToSupabase(file);

        // Create document record
        const document = await prisma.documents.create({
          data: {
            workflow_id: Number(workflowId),
            file_name: file.originalname,
            file_path: fileUrl,
            status: 'pending',
          },
        });

        // Add job to queue
        await documentQueue.add(
          'process-document',
          {
            documentId: document.id,
            filePath: fileUrl,
            fileName: file.originalname,
            userId: req.user?.id,
            workflowId: Number(workflowId),
          },
          {
            removeOnComplete: 100, // Keep last 100 completed jobs
            removeOnFail: 50, // Keep last 50 failed jobs
          },
        );

        // Clean up uploaded file
        fs.unlinkSync(file.path);

        return res.status(201).json(
          new ApiResponse(
            201,
            {
              documentId: document.id,
              fileName: file.originalname,
              status: 'pending',
              message: 'Document uploaded successfully and queued for processing',
            },
            'Document uploaded successfully',
          ),
        );
      } catch (error) {
        // Clean up uploaded file on error
        if (file && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }

        console.error('Error uploading document:', error);
        return res
          .status(500)
          .json(new ApiResponse(500, null, 'Failed to upload document'));
      }
    }

    case 'DELETE': {
      if (!documentId) {
        return res.status(400).json({ error: 'documentId required' });
      }

      toDelete = await prisma.documents.findUnique({
        where: { id: Number(documentId) },
      });

      if (!toDelete) {
        return res.status(404).json({ error: 'Document not found' });
      }
      // Delete file from Supabase Storage
      if (toDelete.file_path) {
        try {
          await deleteFileFromSupabase(toDelete.file_path);
        } catch (err) {
          // Log but don't block DB delete if Supabase delete fails
          console.error('Failed to delete file from Supabase:', err);
        }
      }

      await prisma.documents.delete({ where: { id: Number(documentId) } });
      return res
        .status(200)
        .json(new ApiResponse(200, null, `Document deleted successfully: ${documentId}`));
    }

    default:
      return res
        .status(400)
        .json(new ApiResponse(400, null, 'Invalid opsMode. Use INSERT or DELETE'));
  }
});

const getWorkFlowDocuments = asyncHandler(async (req: Request, res: Response) => {
  const { workflowId } = req.query;

  if (!workflowId) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, 'workflowId is required as a query parameter'));
  }

  const numericWorkflowId = Number(workflowId);
  if (isNaN(numericWorkflowId)) {
    return res.status(400).json(new ApiResponse(400, null, 'Invalid workflowId format'));
  }

  try {
    const documents = await prisma.documents.findMany({
      where: { workflow_id: numericWorkflowId },
      orderBy: { created_at: 'desc' },
    });

    return res
      .status(200)
      .json(new ApiResponse(200, documents, 'Documents retrieved successfully'));
  } catch (error) {
    console.error('Error fetching documents:', error);
    return res.status(500).json(new ApiResponse(500, null, 'Failed to fetch documents'));
  }
});

export { manageWorkFlowDocument, getWorkFlowDocuments };
