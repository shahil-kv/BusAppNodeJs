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
const getCompleteOverview = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId } = req.query;

    // Validate userId
    if (!userId) {
      return res
        .status(400)
        .json(
          new ApiResponse(400, null, "userId is required as a query parameter")
        );
    }

    const numericUserId = parseInt(userId as string, 10);
    if (isNaN(numericUserId)) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid userId format"));
    }

    try {
      // Define date ranges for last month (April 2025 if today is May 2025)
      const lastMonthStart = new Date();
      lastMonthStart.setMonth(lastMonthStart.getMonth() - 1); // Set to April 2025
      lastMonthStart.setDate(1);
      lastMonthStart.setHours(0, 0, 0, 0);

      const lastMonthEnd = new Date(lastMonthStart);
      lastMonthEnd.setMonth(lastMonthEnd.getMonth() + 1); // Start of May 2025
      lastMonthEnd.setDate(1);
      lastMonthEnd.setHours(0, 0, 0, 0);

      // Total calls last month (April 2025)
      const lastMonthCalls = await prisma.call_history.count({
        where: {
          user_id: numericUserId,
          created_at: {
            gte: lastMonthStart,
            lt: lastMonthEnd,
          },
        },
      });

      // Total calls overall
      const totalCalls = await prisma.call_history.count({
        where: {
          user_id: numericUserId,
        },
      });

      // Calculate percentage change in calls
      const callsChangePercent =
        lastMonthCalls > 0
          ? ((totalCalls - lastMonthCalls) / lastMonthCalls) * 100
          : 0;

      // Total unique recipients
      const uniqueRecipients = await prisma.call_history.findMany({
        where: {
          user_id: numericUserId,
        },
        distinct: ["contact_phone"],
        select: {
          contact_phone: true,
        },
      });
      const totalRecipients = uniqueRecipients.length;

      // Last month's unique recipients
      const lastMonthUniqueRecipients = await prisma.call_history.findMany({
        where: {
          user_id: numericUserId,
          created_at: {
            gte: lastMonthStart,
            lt: lastMonthEnd,
          },
        },
        distinct: ["contact_phone"],
        select: {
          contact_phone: true,
        },
      });
      const lastMonthRecipients = lastMonthUniqueRecipients.length;

      // Calculate percentage change in recipients
      const recipientsChangePercent =
        lastMonthRecipients > 0
          ? ((totalRecipients - lastMonthRecipients) / lastMonthRecipients) *
          100
          : 0;


      // Weekly activity (last 7 days)
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - 6); // Last 7 days including today
      weekStart.setHours(0, 0, 0, 0);

      const weeklyActivityRaw = await prisma.call_history.groupBy({
        by: ["created_at"],
        where: {
          user_id: numericUserId,
          created_at: { gte: weekStart },
        },
        _count: {
          id: true,
        },
      });

      const weeklyActivity = Array(7).fill(0);
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      weeklyActivityRaw.forEach((entry) => {
        const dayIndex = (new Date(entry.created_at).getDay() + 6) % 7; // Adjust for Mon start
        weeklyActivity[dayIndex] = entry._count.id;
      });


      // Call status percentages
      const callStatusRaw = await prisma.call_history.groupBy({
        by: ["status"],
        where: {
          user_id: numericUserId,
          created_at: { gte: lastMonthStart },
        },
        _count: {
          id: true,
        },
      });

      const totalStatusCalls = callStatusRaw.reduce(
        (sum, entry) => sum + entry._count.id,
        0
      );
      let callStatus = { answered: 0, failed: 0, missed: 0 };
      callStatusRaw.forEach((entry) => {
        const status = entry.status.toUpperCase(); // Normalize to uppercase
        if (status === "ANSWERED" || status === "ACCEPTED") {
          callStatus.answered = (entry._count.id / totalStatusCalls) * 100;
        } else if (status === "FAILED") {
          callStatus.failed = (entry._count.id / totalStatusCalls) * 100;
        } else if (status === "MISSED") {
          callStatus.missed = (entry._count.id / totalStatusCalls) * 100;
        }
      });

      callStatus = {
        answered: Math.round(callStatus.answered),
        failed: Math.round(callStatus.failed),
        missed: Math.round(callStatus.missed),
      };

      // Construct the response
      const analyticsData = {
        overview: {
          totalCalls,
          callsChangePercent: Math.round(callsChangePercent),
          totalRecipients,
          recipientsChangePercent: Math.round(recipientsChangePercent),
        },
        weeklyActivity: weeklyActivity.map((count, index) => ({
          label: days[index],
          value: count,
        })),
        callStatus,
      };

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            analyticsData,
            "Overview data retrieved successfully"
          )
        );
    } catch (error) {
      return res
        .status(500)
        .json(new ApiResponse(500, null, `Internal server error ${error}`));
    }
  }
);
export { getHistory, getSessions, getContacts, getCompleteOverview };
