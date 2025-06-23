import { Router } from "express";
import {
  manageWorkflow,
  getWorkflows,
} from "../controllers/workflow.controller";

const router = Router();

router.route("/manage").post(manageWorkflow);
router.route("/get-workflows").get(getWorkflows);

export default router;
