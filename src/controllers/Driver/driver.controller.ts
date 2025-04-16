import { ApiError } from "../../utils/ApiError";
import { asyncHandler } from "../../utils/asyncHandler";
import { PrismaClient } from "@prisma/client";
import { ApiResponse } from "../../utils/ApiResponse";
import bcrypt from "bcrypt";
import { Request, Response } from "express";

const prisma = new PrismaClient();

const RegisterDriver = asyncHandler(async (req, res) => {
    const { opsMode, phoneNumber, fullName, password, licenseNumber, licenseExpiryDate } = req.body;

    // Get salt rounds from env var, default to 10
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10);
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Call stored procedure using raw query
    const [procedureResult] = await prisma.$queryRaw<
        { p_ret_type: number; p_ret_msg: string; p_ret_id: number | null }[]
    >`
    CALL create_driver(
        ${opsMode}::text,
        ${fullName}::varchar,
        ${phoneNumber}::varchar,
        ${hashedPassword}::text,
        ${licenseNumber}::varchar,
        ${licenseExpiryDate}::date,
        NULL::integer,
        NULL::text,
        NULL::integer
    );
    `;

    if (!procedureResult) {
        throw new ApiError(500, "Failed to execute stored procedure");
    }

    const { p_ret_type, p_ret_msg, p_ret_id } = procedureResult;

    if (p_ret_type === 0) {
        const statusCode = p_ret_msg.includes("already exists") ? 409 : 400;
        throw new ApiError(statusCode, p_ret_msg);
    }

    if (!p_ret_id) {
        throw new ApiError(500, "Driver created but ID not returned");
    }

    // Fetch the created driver with selected fields
    const driver = await prisma.drivers.findUniqueOrThrow({
        where: { driver_id: p_ret_id },
        select: {
            driver_id: true,
            full_name: true,
            phone_number: true,
            license_number: true,
            license_expiry_date: true,
            is_active: true,
            created_at: true,
            updated_at: true,
        },
    });

    return res.status(201).json(
        new ApiResponse(201, {
            driver,
        }, p_ret_msg)
    );
});

const loginDriver = asyncHandler(async (req: Request, res: Response) => {
    const { phoneNumber, password } = req.body;

    // Find driver by phone number
    const driver = await prisma.drivers.findFirst({
        where: { phone_number: phoneNumber }
    });

    if (!driver) {
        throw new ApiError(404, "Driver not found");
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, driver.password_hash);
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid credentials");
    }

    // Return driver info and tokens
    const { password_hash, ...driverWithoutPassword } = driver;
    void password_hash; // Explicitly mark as unused
    return res.status(200).json(
        new ApiResponse(200, {
            driver: driverWithoutPassword,
        }, "Login successful")
    );
});

export { RegisterDriver, loginDriver };