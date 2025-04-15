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

// Define/Update the interface for the structure returned by the function
interface OwnerOperationalData {
  // Renamed interface for better description
  BusList: Array<{
    bus_id: number;
    registration_number: string;
    model: string;
    capacity: number;
    bus_created_at: string;
    bus_updated_at: string;
    routes: Array<{
      route_id: number;
      sequence_order: number;
      // ... other route fields
      start_time: string;
      end_time: string;
      route_created_at: string;
      route_updated_at: string;
    }>;
  }>;
  // **** THIS PART IS UPDATED ****
  reports: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reportList: Array<any>; // Define specific Report type later if needed
    summaryMetrics: {
      totalBusesOperated: number;
      activeRoutesReported: number;
      totalDistanceCoveredToday: number;
      totalRevenueReportedToday: number;
      metricsLastUpdated: string;
    };
  };
  // **** END OF UPDATE ****
}

type FunctionResult = { get_owner_dashboard_data: OwnerOperationalData | null };

// --- Controller Logic (mostly unchanged) ---
const GetBusOwnersDashboard = asyncHandler(async (req, res) => {
  // Renamed controller
  const { ownerId } = req.body;
  console.log(req.body);

  if (isNaN(ownerId)) {
    throw new ApiError(400, "Invalid owner ID provided.");
  }

  // Call the *updated* PostgreSQL function
  const result = await prisma.$queryRaw<FunctionResult[]>`
      SELECT * FROM public.get_owner_dashboard_data(${ownerId}::integer);
    `;

  // Basic check (unchanged)
  if (
    !result ||
    result.length === 0 ||
    !("get_owner_dashboard_data" in result[0])
  ) {
    console.error(
      "Function call 'get_owner_dashboard_data' did not return the expected structure.",
      result
    );
    throw new ApiError(
      500,
      "Failed to retrieve operational data due to an unexpected database response."
    );
  }

  // Extract the structured payload (unchanged)
  const operationalData = result[0].get_owner_dashboard_data;

  // Handle owner not found (unchanged)
  if (operationalData === null) {
    throw new ApiError(
      404,
      `Operational data not found for owner ID ${ownerId}. Owner might not exist.`
    );
  }

  // Pass the entire structured object to ApiResponse (unchanged)
  return res.status(200).json(
    new ApiResponse(
      200,
      operationalData, // Pass the structured object directly
      `Successfully retrieved operational data for owner ID ${ownerId}.`
    )
  );
});

export { manageBus, GetBusOwnersDashboard };
