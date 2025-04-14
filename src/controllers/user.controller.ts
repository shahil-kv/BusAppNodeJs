import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { PrismaClient, Prisma } from "@prisma/client";
import { ApiResponse } from "../utils/ApiResponse";
import bcrypt from "bcrypt";
const prisma = new PrismaClient();

const GetBusOwners = asyncHandler(async (res) => {
  const users = await prisma.bus_owners.findMany();
  res.json(users);
});

const BusOwnerRegistration = asyncHandler(async (req, res) => {
  const { opsMode, phoneNumber, fullName, password, companyName } = req.body;

  const saltRounds = 10; // Recommended cost factor for bcrypt (adjust as needed)
  const hashedPassword = await bcrypt.hash(password, saltRounds); // Hash the plain password

  try {
    // Call stored procedure using raw query
    const [procedureResult] = await prisma.$queryRaw<
      { p_ret_type: number; p_ret_msg: string; p_ret_id: number | null }[]
    >`
  CALL create_bus_owner(
      ${opsMode}::text,
      ${fullName}::varchar,
      ${phoneNumber}::varchar,
      ${hashedPassword}::text,
      ${companyName || null}::varchar,
      NULL::integer,
      NULL::text,
      NULL::integer
  );
    `;

    if (!procedureResult) {
      throw new ApiError(500, "Failed to execute stored procedure");
    }

    const { p_ret_type, p_ret_msg, p_ret_id } = procedureResult;

    // Handle procedure errors
    if (p_ret_type === 0) {
      const statusCode = p_ret_msg.includes("already exists") ? 409 : 400;
      throw new ApiError(statusCode, p_ret_msg);
    }

    // Validate we have an ID
    if (!p_ret_id) {
      throw new ApiError(500, "Owner created but ID not returned");
    }

    // Fetch the created owner with selected fields
    const owner = await prisma.bus_owners.findUniqueOrThrow({
      where: { bus_owner_id: p_ret_id },
      select: {
        bus_owner_id: true,
        full_name: true,
        phone_number: true,
        company_name: true,
        is_email_verified: true,
        created_at: true,
        updated_at: true,
      },
    });

    return res.status(201).json(new ApiResponse(201, { owner }, p_ret_msg));
  } catch (error) {
    // Handle specific Prisma errors
    if (error?.code === "P2002") {
      const field = error.meta?.target?.join(", ") || "field";
      throw new ApiError(409, `A bus owner with this ${field} already exists`);
    }

    if (error instanceof ApiError) {
      throw error;
    }

    console.error("Registration error:", error);
    throw new ApiError(500, "Error registering bus owner");
  }
});

const loginBusOwner = asyncHandler(async (req, res) => {
  const { phoneNumber, password } = req.body;
  try {
    const ownerInfo = await prisma.bus_owners.findUnique({
      where: {
        phone_number: phoneNumber,
      },
      select: {
        bus_owner_id: true,
        password_hash: true,
        full_name: true,
        phone_number: true,
        company_name: true,
        is_email_verified: true,
        created_at: true,
        updated_at: true,
      },
    });
    if (!ownerInfo || !ownerInfo.password_hash) {
      throw new ApiError(401, "Invalid credentials."); // User not found or no password set
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      ownerInfo.password_hash
    );

    if (!isPasswordCorrect) {
      throw new ApiError(401, "Invalid credentials.");
    }

    // Prepare the data to return (exclude password hash)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...loggedInOwnerData } = ownerInfo; // Use spread syntax to exclude hash

    return res
      .status(200)
      .json(
        new ApiResponse(200, { owner: loggedInOwnerData }, "Login successful.")
      );
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("Prisma Login Error:", error.code, error.message);
    }
    throw new ApiError(500, "An error occurred during login.");
  }
});

export { GetBusOwners, BusOwnerRegistration, loginBusOwner };
