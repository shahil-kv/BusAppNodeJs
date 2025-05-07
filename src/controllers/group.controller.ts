import { Request, Response } from 'express';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import prisma from '../lib/prisma';
import { OpsModeEnum } from '../constant';

const manageGroup = asyncHandler(async (req: Request, res: Response) => {
  const { userId, groupName, description, contacts, opsMode, groupId } = req.body;
  let result;
  let message;

  // Convert userId to number
  const numericUserId = parseInt(userId, 10);
  const numberGroupId = parseInt(groupId, 10)

  if (isNaN(numericUserId)) {
    return res.status(400).json(new ApiResponse(400, null, 'Invalid user ID format'));
  }

  if (isNaN(numberGroupId)) {
    return res.status(400).json(new ApiResponse(400, null, 'Invalid Group ID format'));
  }

  // Using transactions for operations that require multiple database calls
  switch (opsMode) {
    case OpsModeEnum.INSERT:
      try {
        result = await prisma.$transaction(async (tx) => {
          const newGroup = await tx.groups.create({
            data: {
              user_id: numericUserId,
              group_name: groupName,
              description,
            },
          });

          // Create contacts separately for better error control
          await tx.contacts.createMany({
            data: contacts.map((contact: { name: string; phoneNumber: string }) => ({
              group_id: newGroup.id,
              name: contact.name,
              phone_number: contact.phoneNumber,
            })),
          });

          // Return complete group with contacts
          return tx.groups.findUnique({
            where: { id: newGroup.id },
            include: { contacts: true },
          });
        });

        message = 'Group created successfully.';
      } catch (error) {
        console.error('Transaction error:', error);
        return res.status(500).json(new ApiResponse(500, null, 'Failed to create group'));
      }
      break;

    case OpsModeEnum.UPDATE: {
      try {
        // First check if group exists
        const existingGroup = await prisma.groups.findUnique({
          where: { id: numberGroupId },
        });

        if (!existingGroup) {
          return res.status(404).json(new ApiResponse(404, null, 'Group not found'));
        }

        result = await prisma.$transaction(async (tx) => {
          // Update group details
          await tx.groups.update({
            where: { id: numberGroupId },
            data: {
              group_name: groupName,
              description,
            },
          });

          // Delete existing contacts
          await tx.contacts.deleteMany({
            where: { group_id: numberGroupId },
          });

          // Add new contacts
          await tx.contacts.createMany({
            data: contacts.map((contact: { name: string; phoneNumber: string }) => ({
              group_id: numberGroupId,
              name: contact.name,
              phone_number: contact.phoneNumber,
            })),
          });

          // Return updated group with contacts
          return tx.groups.findUnique({
            where: { id: numberGroupId },
            include: { contacts: true },
          });
        });

        message = 'Group updated successfully.';
      } catch (error) {
        console.error('Transaction error:', error);
        return res.status(500).json(new ApiResponse(500, null, 'Failed to update group'));
      }
      break;
    }

    case OpsModeEnum.DELETE: {
      try {
        // Verify group exists before attempting deletion
        const groupToDelete = await prisma.groups.findUnique({
          where: { id: numberGroupId },
        });

        if (!groupToDelete) {
          return res.status(404).json(new ApiResponse(404, null, 'Group not found'));
        }

        result = await prisma.$transaction(async (tx) => {
          // Delete contacts first
          await tx.contacts.deleteMany({
            where: { group_id: numberGroupId },
          });

          // Delete the group
          return tx.groups.delete({
            where: { id: numberGroupId },
          });
        });

        message = 'Group deleted successfully.';
      } catch (error) {
        console.error('Transaction error:', error);
        return res.status(500).json(new ApiResponse(500, null, 'Failed to delete group'));
      }
      break;
    }

    default:
      return res.status(400).json(new ApiResponse(400, null, 'Invalid operation mode.'));
  }

  return res.status(200).json(new ApiResponse(200, result, message));
});

export { manageGroup };