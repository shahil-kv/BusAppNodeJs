import { ApiError } from "../../utils/ApiError";
import { asyncHandler } from "../../utils/asyncHandler";
import { PrismaClient } from "@prisma/client";
import { ApiResponse } from "../../utils/ApiResponse";

const prisma = new PrismaClient();

const manageBus = asyncHandler(async (req, res) => {
  const {
    opsMode,
    busOwnerId,
    registrationNumber,
    model, // Optional
    capacity, // Optional
    routes, // Array of route objects or null/undefined
    busIdToModify,
  } = req.body;

  // Basic validation (add more robust validation as needed)
  if (!opsMode || !["INSERT", "UPDATE", "DELETE"].includes(opsMode)) {
    throw new ApiError(400, "Invalid opsMode specified.");
  }
  if (opsMode === "INSERT" && (!busOwnerId || !registrationNumber)) {
    throw new ApiError(
      400,
      "busOwnerId and registrationNumber are required for INSERT."
    );
  }
  if ((opsMode === "UPDATE" || opsMode === "DELETE") && !busIdToModify) {
    throw new ApiError(400, "busIdToModify is required for UPDATE or DELETE.");
  }

  const routesJsonString =
    Array.isArray(routes) && routes.length > 0 ? JSON.stringify(routes) : null;

  const result = await prisma.$queryRaw<
    { p_bus_id: number | null; p_ret_type: number; p_ret_msg: string }[]
  >`
      CALL manage_bus_data(
          ${opsMode}::text,                    -- p_ops_mode
          ${busOwnerId || null}::integer,      -- p_bus_owner_id
          ${registrationNumber || null}::varchar, -- p_registration_number
          ${model || null}::varchar,           -- p_model
          ${capacity || null}::integer,        -- p_capacity
          ${routesJsonString}::jsonb,          -- p_routes (pass as JSONB string or NULL)
          ${busIdToModify}::integer,           -- p_bus_id (INOUT)
          NULL::integer,                       -- p_ret_type (OUT placeholder)
          NULL::text                           -- p_ret_msg (OUT placeholder)
      );
    `;

  // Check if the procedure call returned expected structure
  if (!result || result.length === 0) {
    console.error("Procedure call did not return expected results:", result);
    throw new ApiError(
      500,
      "Failed to execute bus management procedure or procedure returned no result."
    );
  }

  const { p_ret_type, p_ret_msg, p_bus_id } = result[0];

  if (p_ret_type === 0) {
    const statusCode =
      p_ret_msg.includes("already exists") || p_ret_msg.includes("conflict")
        ? 409
        : p_ret_msg.includes("not found")
        ? 404
        : 400;
    throw new ApiError(statusCode, p_ret_msg);
  }

  // Success
  const responseData = {
    message: p_ret_msg,
    busId: p_bus_id,
  };

  const successStatusCode = opsMode === "INSERT" ? 201 : 200;

  return res
    .status(successStatusCode)
    .json(
      new ApiResponse(
        successStatusCode,
        responseData,
        "Bus operation successful."
      )
    );
});

export { manageBus };
