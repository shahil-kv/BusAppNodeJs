import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const prisma = new PrismaClient();

const handleCall = asyncHandler(async (req: Request, res: Response) => {
    const { userId, contacts, groupId, groupType } = req.body;

    const numericUserId = parseInt(userId, 10);
    const numbericGroupId = parseInt(groupId, 10)

    if (isNaN(numericUserId)) {
        return res.status(400).json(new ApiResponse(400, null, 'Invalid user ID format'));
    }

    if (isNaN(numbericGroupId)) {
        return res.status(400).json(new ApiResponse(400, null, 'Invalid Group ID format'));
    }

    let targetGroupId: number;

    if (groupId === 0 && groupType === "MANUAL") {
        // manual group or calling
        const manualGroup = await prisma.groups.create({
            data: {
                user_id: numericUserId,
                group_name: `Manual Call - ${new Date().toISOString()}`,
                group_type: 'MANUAL',
                description: 'Manual call group',
                contacts: {
                    create: contacts.map((contact: { name: string; phoneNumber: string }) => ({
                        name: contact.name,
                        phone_number: contact.phoneNumber,
                    })),
                },
            },
        });

        targetGroupId = manualGroup.id;

    } else {
        //    Predefined group call
        const existingGroup = await prisma.groups.findUnique({
            where: { id: groupId },
        });

        if (!existingGroup) {
            return res.status(404).json(new ApiResponse(404, null, 'Group not found'));
        }

        targetGroupId = groupId;
    }

    // Log the call in call history
    const callEntry = await prisma.call_history.create({
        data: {
            user_id: numericUserId,
            group_id: targetGroupId,
        },
    });

    return res.status(200).json(new ApiResponse(200, callEntry, 'Call logged successfully.'));
});

export { handleCall };
