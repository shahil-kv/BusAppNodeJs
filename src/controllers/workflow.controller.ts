import { Request, Response } from "express";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import prisma from "../lib/prisma";
import { OpsModeEnum } from "../constant";

// Create, update, delete workflow
const manageWorkflow = asyncHandler(async (req: Request, res: Response) => {
  const { workflowId, name, description, steps, opsMode } = req.body;
  let result, message;

  switch (opsMode) {
    case OpsModeEnum.INSERT:
      if (!name || !steps) {
        return res
          .status(400)
          .json(new ApiResponse(400, null, "Name and steps required"));
      }
      result = await prisma.workflows.create({
        data: { name, description, steps },
      });
      message = "Workflow created successfully.";
      break;

    case OpsModeEnum.UPDATE:
      if (!workflowId || !name || !steps) {
        return res
          .status(400)
          .json(
            new ApiResponse(400, null, "workflowId, name, and steps required")
          );
      }
      result = await prisma.workflows.update({
        where: { id: Number(workflowId) },
        data: { name, description, steps, updated_at: new Date() },
      });
      message = "Workflow updated successfully.";
      break;

    case OpsModeEnum.DELETE:
      if (!workflowId) {
        return res
          .status(400)
          .json(new ApiResponse(400, null, "workflowId required"));
      }
      result = await prisma.workflows.delete({
        where: { id: Number(workflowId) },
      });
      message = "Workflow deleted successfully.";
      break;

    default:
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid operation mode."));
  }

  return res.status(200).json(new ApiResponse(200, result, message));
});

// Get all workflows
const getWorkflows = asyncHandler(async (req: Request, res: Response) => {
  const workflows = await prisma.workflows.findMany({
    orderBy: { created_at: "desc" },
  });
  return res
    .status(200)
    .json(new ApiResponse(200, workflows, "Workflows retrieved successfully"));
});

export { manageWorkflow, getWorkflows };
