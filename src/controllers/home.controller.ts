import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const prisma = new PrismaClient();
const GetDashboard = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.body;
    const numericUserId = parseInt(userId, 10);

    if (isNaN(numericUserId)) {
        return res.status(400).json(new ApiResponse(400, null, 'Invalid user ID format'));
    }

    // 1. Fetch user info
    const user = await prisma.users.findUnique({
        where: { id: numericUserId },
        select: {
            full_name: true,
            role: true,
            is_premium: true,
            phone_number: true
            // Assuming there's a way you're tracking how many contacts user has added
            // _count: {
            //   select: { contacts: true },
            // },
        },
    });

    if (!user) {
        return res.status(404).json(new ApiResponse(404, null, 'User not found'));
    }

    // 2. Fetch groups owned by the user
    const groups = await prisma.groups.findMany({
        where: { user_id: numericUserId },
        select: {
            id: true,
            group_name: true,
            description: true,
            group_type: true,
        },
    });

    const recentCalls = await prisma.call_history.findMany({
        where: { user_id: numericUserId }, // Only this user's calls
        orderBy: { called_at: 'desc' },    // Most recent first
        take: 5,                           // Limit to 5 latest
        select: {
            id: true,
            called_at: true,
            group_id: true
        }
    });

    // Get group names for the calls
    const groupIds = recentCalls.map(call => call.group_id);
    const groupNames = await prisma.groups.findMany({
        where: {
            id: { in: groupIds }
        },
        select: {
            id: true,
            group_name: true
        }
    });

    // Combine the data
    const formattedCalls = recentCalls.map(call => ({
        ...call,
        group_name: groupNames.find(g => g.id === call.group_id)?.group_name
    }));

    return res.status(200).json(
        new ApiResponse(200, {
            user: {
                user
            },
            groups,
            recentCalls: formattedCalls,
        }, 'Dashboard fetched successfully.')
    );
});

export { GetDashboard };
