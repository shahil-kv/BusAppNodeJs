import { asyncHandler } from "../utils/asyncHandler";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const getCurrentUser = asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

export { getCurrentUser };
