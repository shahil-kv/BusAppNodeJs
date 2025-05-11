import { Request, Response } from "express";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import prisma from "../lib/prisma";
import { OpsModeEnum } from "../constant";
import { parsePhoneNumberFromString } from "libphonenumber-js";

// Utility to normalize phone numbers
const normalizePhoneNumber = (phone: string): string => {
  const phoneNumber = parsePhoneNumberFromString(phone, "IN");
  if (phoneNumber && phoneNumber.isValid()) {
    return phoneNumber.formatInternational();
  }
  return phone;
};

const manageGroup = asyncHandler(async (req: Request, res: Response) => {
  const { userId, groupName, description, contacts, opsMode, groupId } =
    req.body;
  let result;
  let message;

  const numericUserId = parseInt(userId, 10);
  const numericGroupId = parseInt(groupId, 10);

  // Input validation for userId (required for all operations)
  if (isNaN(numericUserId)) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid user ID format"));
  }

  // Input validation for groupId (required for UPDATE and DELETE operations)
  if (isNaN(numericGroupId) && opsMode !== OpsModeEnum.INSERT) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid group ID format"));
  }

  // Validations specific to INSERT and UPDATE operations
  if (opsMode === OpsModeEnum.INSERT || opsMode === OpsModeEnum.UPDATE) {
    // Validate groupName
    if (!groupName || groupName.trim() === "") {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Group name is required"));
    }

    // Validate contacts
    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "At least one contact is required"));
    }
  }

  // Normalize contacts (only for INSERT and UPDATE)
  let normalizedContacts;
  if (opsMode === OpsModeEnum.INSERT || opsMode === OpsModeEnum.UPDATE) {
    normalizedContacts = contacts.map((contact) => {
      const phone =
        contact.phoneNumber ||
        contact.phone_number ||
        (contact.phoneNumbers?.[0]?.number ?? "");
      const normalizedPhone = normalizePhoneNumber(phone);
      const [firstName = "", ...lastNameParts] = (
        contact.name ||
        contact.displayName ||
        ""
      ).split(" ");
      const lastName = lastNameParts.join(" ");
      return {
        group_id: 0, // Will be set after group creation
        contact_id: contact.id || contact.contactId || null,
        name: contact.name || contact.displayName || "",
        first_name: firstName,
        last_name: lastName,
        phone_number: normalizedPhone,
        country_code: normalizedPhone.split(" ")[0] || "",
        raw_contact: contact,
        is_contact_from_device: contact.isContactFromDevice ?? true, // New field
      };
    });
  }

  switch (opsMode) {
    case OpsModeEnum.INSERT:
      try {
        result = await prisma.$transaction(async (tx) => {
          const newGroup = await tx.groups.create({
            data: {
              user_id: numericUserId,
              group_name: groupName,
              description,
              group_type: "USER_DEFINED",
            },
          });

          const contactsToInsert = normalizedContacts.map((contact) => ({
            ...contact,
            group_id: newGroup.id,
          }));

          // Batch insert contacts
          await tx.contacts.createMany({
            data: contactsToInsert,
          });

          return tx.groups.findUnique({
            where: { id: newGroup.id },
            include: { contacts: true },
          });
        });

        message = "Group created successfully.";
      } catch (error) {
        console.error("Transaction error:", error);
        if (error.code === "P2002") {
          return res
            .status(409)
            .json(
              new ApiResponse(
                409,
                null,
                "Group name already exists for this user"
              )
            );
        }
        return res
          .status(500)
          .json(new ApiResponse(500, null, "Failed to create group"));
      }
      break;

    case OpsModeEnum.UPDATE:
      try {
        const existingGroup = await prisma.groups.findUnique({
          where: { id: numericGroupId },
        });

        if (!existingGroup) {
          return res
            .status(404)
            .json(new ApiResponse(404, null, "Group not found"));
        }

        if (existingGroup.user_id !== numericUserId) {
          return res
            .status(403)
            .json(
              new ApiResponse(403, null, "Unauthorized to update this group")
            );
        }

        result = await prisma.$transaction(async (tx) => {
          await tx.groups.update({
            where: { id: numericGroupId },
            data: {
              group_name: groupName,
              description,
              group_type: "USER_DEFINED",
              updated_at: new Date(),
            },
          });

          await tx.contacts.deleteMany({
            where: { group_id: numericGroupId },
          });

          const contactsToInsert = normalizedContacts.map((contact) => ({
            ...contact,
            group_id: numericGroupId,
          }));

          await tx.contacts.createMany({
            data: contactsToInsert,
          });

          return tx.groups.findUnique({
            where: { id: numericGroupId },
            include: { contacts: true },
          });
        });

        message = "Group updated successfully.";
      } catch (error) {
        console.error("Transaction error:", error);
        if (error.code === "P2002") {
          return res
            .status(409)
            .json(
              new ApiResponse(
                409,
                null,
                "Group name already exists for this user"
              )
            );
        }
        return res
          .status(500)
          .json(new ApiResponse(500, null, "Failed to update group"));
      }
      break;

    case OpsModeEnum.DELETE:
      try {
        const groupToDelete = await prisma.groups.findUnique({
          where: { id: numericGroupId },
        });

        if (!groupToDelete) {
          return res
            .status(404)
            .json(new ApiResponse(404, null, "Group not found"));
        }

        if (groupToDelete.user_id !== numericUserId) {
          return res
            .status(403)
            .json(
              new ApiResponse(403, null, "Unauthorized to delete this group")
            );
        }

        result = await prisma.$transaction(async (tx) => {
          await tx.contacts.deleteMany({
            where: { group_id: numericGroupId },
          });

          return tx.groups.delete({
            where: { id: numericGroupId },
          });
        });

        message = "Group deleted successfully.";
      } catch (error) {
        console.error("Transaction error:", error);
        return res
          .status(500)
          .json(new ApiResponse(500, null, "Failed to delete group"));
      }
      break;

    default:
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid operation mode."));
  }

  return res.status(200).json(new ApiResponse(200, result, message));
});

const getGroup = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.query;

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
    const groups = await prisma.groups.findMany({
      where: { user_id: numericUserId },
      include: { contacts: true },
      orderBy: { created_at: "desc" },
    });

    return res
      .status(200)
      .json(new ApiResponse(200, groups, "Groups retrieved successfully"));
  } catch (error) {
    console.error("Error fetching groups:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Failed to fetch groups"));
  }
});

export { manageGroup, getGroup };
