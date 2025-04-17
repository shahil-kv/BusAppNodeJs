import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const updateBusLocation = asyncHandler(async (req: Request, res: Response) => {
    const { busId, latitude, longitude, kilometersAdded, isMoving, speed } = req.body;

    const result = await prisma.$queryRaw<{ p_ret_type: number; p_ret_msg: string }[]>`
        CALL update_bus_location(
            NULL::INTEGER, NULL::TEXT,
            ${busId}::INTEGER,
            ${latitude}::NUMERIC,
            ${longitude}::NUMERIC,
            ${kilometersAdded}::NUMERIC,
            ${isMoving}::BOOLEAN,
            ${speed}::FLOAT,
            FALSE::BOOLEAN,
            FALSE::BOOLEAN
        );
    `;

    const { p_ret_type, p_ret_msg } = result[0];

    return res.status(200).json(
        new ApiResponse(200, {
            ret_type: p_ret_type,
            message: p_ret_msg
        }, 'Bus location update processed.')
    );
});

export { updateBusLocation }; 