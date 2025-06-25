import { Router } from 'express';
import upload from '../configs/multer';
import {
  manageWorkFlowDocument,
  getWorkFlowDocuments,
} from '../controllers/document.controller';

const router = Router();

router.route('/manage-documents').post(upload.single('file'), manageWorkFlowDocument);
router.route('/get-documents').get(getWorkFlowDocuments);

export default router;
