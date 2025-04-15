import { ApiError } from "../../utils/ApiError";
import { asyncHandler } from "../../utils/asyncHandler";
import { PrismaClient } from "@prisma/client";
import { ApiResponse } from "../../utils/ApiResponse";
import bcrypt from "bcrypt";
const prisma = new PrismaClient();

const GetBusOwners = asyncHandler(async (req, res) => {
  // Basic Pagination
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10; // Default limit 10
  const skip = (page - 1) * limit;

  const users = await prisma.bus_owners.findMany({
    take: limit,
    skip: skip,
    // Add orderBy if needed, e.g., orderBy: { created_at: 'desc' }
  });

  const totalOwners = await prisma.bus_owners.count(); // Get total count for pagination info
  const totalPages = Math.ceil(totalOwners / limit);

  // Wrap response
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        owners: users,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalOwners: totalOwners,
          limit: limit,
        },
      },
      "Bus owners retrieved successfully"
    )
  );
});

const BusOwnerRegistration = asyncHandler(async (req, res) => {
  const { opsMode, phoneNumber, fullName, password, companyName } = req.body;

  // Get salt rounds from env var, default to 10
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10);
  const hashedPassword = await bcrypt.hash(password, saltRounds); // Hash the plain password

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
  // catch block removed, errors handled by asyncHandler and errorHandler middleware
});

const loginBusOwner = asyncHandler(async (req, res) => {
  const { phoneNumber, password } = req.body;
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
});

export { GetBusOwners, BusOwnerRegistration, loginBusOwner };
