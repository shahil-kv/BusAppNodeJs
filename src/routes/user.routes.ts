import { Router } from "express";
import { getCurrentUser } from "../controllers/user.controller";

const router = Router();

router.route("/current-user").get(getCurrentUser);

export default router;
