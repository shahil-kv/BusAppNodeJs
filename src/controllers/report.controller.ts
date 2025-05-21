import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { group } from "console";
const prisma = new PrismaClient();

const getHistory = asyncHandler(async (req: Request, res: Response) => {
  const { userId, selectedView } = req.query;

  if (!userId) {
    return res
      .status(400)
      .json(
        new ApiResponse(400, null, "userId is required as a query parameter")
      );
  }

  if (!selectedView) {
    return res
      .status(400)
      .json(
        new ApiResponse(
          400,
          null,
          "selected View is required as a query parameter "
        )
      );
  }

  const numericUserId = parseInt(userId as string, 10);

  if (isNaN(numericUserId)) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid userId format"));
  }

  try {
    let groups;
    if (selectedView == "All") {
      groups = await prisma.call_history.findMany({
        where: { user_id: numericUserId },
        orderBy: { created_at: "desc" },
      });
    } else {
      groups = await prisma.groups.findMany({
        where: { user_id: numericUserId, group_type: "USER_DEFINED" },
        orderBy: { created_at: "desc" },
      });
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          groups,
          `${selectedView} History retrieved successfully`
        )
      );
  } catch (error) {
    console.error("Error fetching groups:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Failed to fetch groups"));
  }
});

const getSessions = asyncHandler(async (req: Request, res: Response) => {
  const { userId, groupId } = req.query;

  if (!userId) {
    return res
      .status(400)
      .json(
        new ApiResponse(400, null, "userId is required as a query parameter")
      );
  }
  if (!group) {
    return res
      .status(400)
      .json(
        new ApiResponse(400, null, "Group Id is required as a query parameter")
      );
  }

  const numericUserId = parseInt(userId as string, 10);
  const numericGroupId = parseInt(groupId as string, 10);

  if (isNaN(numericUserId)) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid userId format"));
  }

  if (isNaN(numericGroupId)) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid GroupId format"));
  }

  const sessionList = await prisma.call_session.findMany({
    where: { user_id: numericUserId, group_id: numericGroupId },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, sessionList, "Groups retrieved successfully"));
});

const getContacts = asyncHandler(async (req: Request, res: Response) => {
  const { userId, sessionId } = req.query;

  if (!userId) {
    return res
      .status(400)
      .json(
        new ApiResponse(400, null, "userId is required as a query parameter")
      );
  }
  if (!sessionId) {
    return res
      .status(400)
      .json(
        new ApiResponse(
          400,
          null,
          "Session Id is required as a query parameter"
        )
      );
  }

  const numericUserId = parseInt(userId as string, 10);
  const numericSessionId = parseInt(sessionId as string, 10);

  if (isNaN(numericUserId)) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid userId format"));
  }

  if (isNaN(numericSessionId)) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid Session Id format"));
  }

  const contactListFromSession = await prisma.call_history.findMany({
    where: { user_id: numericUserId, session_id: numericSessionId },
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        contactListFromSession,
        "Contact List from session retrieved successfully"
      )
    );
});
export { getHistory, getSessions, getContacts };
