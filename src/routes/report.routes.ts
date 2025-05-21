import { Router } from "express";
import {
  getContacts,
  getHistory,
  getSessions,
} from "../controllers/report.controller";

const router = Router();

router.route("/history").get(getHistory);
router.route("/sessions").get(getSessions);
router.route("/contacts").get(getContacts);
export default router;
