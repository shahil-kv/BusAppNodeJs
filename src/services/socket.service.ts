import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { ApiError } from '../utils/ApiError';
import jwt from 'jsonwebtoken'; // Add JWT for authentication

interface BusLocationData {
    busId: number;
    latitude: number;
    longitude: number;
    kilometersAdded: number;
    isMoving: boolean;
    speed: number;
}

interface LastKnownLocation {
    latitude: number;
    longitude: number;
    speed: number;
    timestamp: number;
}

interface BusRouteInfo {
    nextStop: string;
    estimatedArrivalTime: string;
    distanceToNextStop: number;
}

export class SocketService {
    private io: Server;
    private prisma: PrismaClient;
    private lastKnownLocations: Map<number, LastKnownLocation>;
    private busRoutes: Map<number, BusRouteInfo>;
    private readonly MIN_UPDATE_INTERVAL = 5000; // 5 seconds
    private readonly DISTANCE_THRESHOLD = 0.005; // ~500m
    private readonly SPEED_CHANGE_THRESHOLD = 10; // km/h
    private readonly SUDDEN_CHANGE_THRESHOLD = 20; // km/h
    private readonly ROUTE_DEVIATION_THRESHOLD = 200; // meters

    constructor(io: Server) {
        this.io = io;
        this.prisma = new PrismaClient();
        this.lastKnownLocations = new Map();
        this.busRoutes = new Map();
        this.initializeSocketHandlers();
    }

    private initializeSocketHandlers() {
        this.io.on('connection', (socket: Socket) => {
            console.log(`Client connected: ${socket.id}`);

            // Middleware for authentication
            socket.use((packet, next) => {
                const token = socket.handshake.auth.token;
                if (!token) return next(new Error('Authentication required'));
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
                    socket.data.user = decoded; // Attach decoded user data
                    next();
                } catch (err) {
                    return next(new ApiError(401, 'Invalid token'));
                }
            });

            // Driver-specific events
            socket.on('driver:join', async (data: { busId: number, driverId: number }) => {
                try {
                    const isValidDriver = await this.validateDriver(data.busId, data.driverId);
                    if (!isValidDriver) throw new ApiError(401, 'Invalid driver credentials');
                    socket.join(`driver-${data.busId}`);
                    console.log(`Driver ${data.driverId} joined bus room: ${data.busId}`);
                } catch (error) {
                    socket.emit('error', error instanceof ApiError ? error : { statusCode: 500, message: 'Failed to join as driver' });
                }
            });

            // Passenger-specific events
            socket.on('passenger:join', async (data: { busId: number }) => {
                try {
                    const isValidBus = await this.validateBus(data.busId);
                    if (!isValidBus) throw new ApiError(404, 'Invalid bus ID');
                    socket.join(`passenger-${data.busId}`);
                    console.log(`Passenger joined bus room: ${data.busId}`);

                    const lastLocation = this.lastKnownLocations.get(data.busId);
                    if (lastLocation) {
                        const routeInfo = await this.getRouteInfo(data.busId);
                        socket.emit('busUpdate', {
                            busId: data.busId,
                            location: { latitude: lastLocation.latitude, longitude: lastLocation.longitude },
                            speed: lastLocation.speed,
                            isMoving: true,
                            ...routeInfo
                        });
                    }
                } catch (error) {
                    socket.emit('error', error instanceof ApiError ? error : { statusCode: 500, message: 'Failed to join as passenger' });
                }
            });

            socket.on('driver:startTracking', async (data: BusLocationData) => {
                try {
                    await this.handleBusLocationUpdate(data);
                } catch (error) {
                    console.error('Error handling bus location update:', error);
                    socket.emit('error', { message: 'Failed to update bus location' });
                }
            });

            socket.on('disconnect', () => {
                console.log(`Client disconnected: ${socket.id}`);
                // Cleanup (optional)
                this.lastKnownLocations.forEach((_, key) => {
                    if (!this.io.sockets.adapter.rooms.get(`driver-${key}`)?.size && !this.io.sockets.adapter.rooms.get(`passenger-${key}`)?.size) {
                        this.lastKnownLocations.delete(key);
                        this.busRoutes.delete(key);
                    }
                });
            });
        });
    }

    private async validateDriver(busId: number, driverId: number): Promise<boolean> {
        const driver = await this.prisma.drivers.findFirst({
            where: {
                driver_id: driverId,
                current_bus_id: busId,
                is_active: true
            }
        });
        return !!driver;
    }

    private async validateBus(busId: number): Promise<boolean> {
        const bus = await this.prisma.buses.findUnique({
            where: { bus_id: busId }
        });
        return !!bus;
    }

    private async handleBusLocationUpdate(data: BusLocationData) {
        const { busId, latitude, longitude, kilometersAdded, isMoving, speed } = data;
        const lastLocation = this.lastKnownLocations.get(busId);
        const now = Date.now();

        // Check if we should update based on time and distance thresholds
        if (lastLocation) {
            const timeSinceLastUpdate = now - lastLocation.timestamp;
            const distanceMoved = this.calculateHaversineDistance(
                lastLocation.latitude,
                lastLocation.longitude,
                latitude,
                longitude
            );

            if (timeSinceLastUpdate < this.MIN_UPDATE_INTERVAL && distanceMoved < this.DISTANCE_THRESHOLD) {
                return;
            }
        }

        // Check for route deviation and sudden speed changes
        const routeDeviation = await this.checkRouteDeviation(busId, latitude, longitude);
        const speedChange = lastLocation ? Math.abs(speed - lastLocation.speed) > this.SPEED_CHANGE_THRESHOLD : false;
        const suddenChange = lastLocation ? Math.abs(speed - lastLocation.speed) > this.SUDDEN_CHANGE_THRESHOLD : false;

        // Update database
        const result = await this.prisma.$queryRaw<{ p_ret_type: number; p_ret_msg: string }[]>`
            CALL update_bus_location(
                NULL::INTEGER, NULL::TEXT,
                ${busId}::INTEGER,
                ${latitude}::NUMERIC,
                ${longitude}::NUMERIC,
                ${kilometersAdded}::NUMERIC,
                ${isMoving}::BOOLEAN,
                ${speed}::FLOAT,
                ${routeDeviation}::BOOLEAN,
                ${suddenChange}::BOOLEAN
            );
        `;

        const { p_ret_type, p_ret_msg } = result[0];

        if (p_ret_type === 1) {
            // Update last known location
            this.lastKnownLocations.set(busId, {
                latitude,
                longitude,
                speed,
                timestamp: now
            });

            // Get route information
            const routeInfo = await this.getRouteInfo(busId);
            this.busRoutes.set(busId, routeInfo);

            // Emit update to driver room
            this.io.to(`driver-${busId}`).emit('busUpdate', {
                busId,
                location: { latitude, longitude },
                speed,
                isMoving,
                routeDeviation,
                suddenChange,
                message: p_ret_msg
            });

            // Emit update to passenger room with additional route info
            this.io.to(`passenger-${busId}`).emit('busUpdate', {
                busId,
                location: { latitude, longitude },
                speed,
                isMoving,
                routeDeviation,
                suddenChange,
                ...routeInfo
            });
        }
    }

    private async getRouteInfo(busId: number): Promise<BusRouteInfo> {
        const route = await this.prisma.bus_routes.findFirst({
            where: {
                bus_id: busId,
                start_time: { lte: new Date() }
            },
            orderBy: { start_time: 'desc' }
        });

        if (!route) return { nextStop: 'Unknown', estimatedArrivalTime: 'N/A', distanceToNextStop: 0 };

        const lastLocation = this.lastKnownLocations.get(busId);
        if (!lastLocation) return { nextStop: route.to_location, estimatedArrivalTime: route.end_time.toLocaleTimeString(), distanceToNextStop: 0 };

        // Mock ETA and distance (replace with real calculation)
        const distance = this.calculateHaversineDistance(lastLocation.latitude, lastLocation.longitude, 0, 0); // Replace with destination coords
        const eta = new Date();
        eta.setMinutes(eta.getMinutes() + (distance / 40) * 60); // Approx 40 km/h

        return {
            nextStop: route.to_location,
            estimatedArrivalTime: eta.toLocaleTimeString(),
            distanceToNextStop: distance
        };
    }

    private calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in meters
    }

    private async checkRouteDeviation(busId: number, latitude: number, longitude: number): Promise<boolean> {
        const route = await this.prisma.bus_routes.findFirst({
            where: {
                bus_id: busId,
                start_time: { lte: new Date() }
            },
            orderBy: { start_time: 'desc' }
        });

        if (!route) return false;

        // Mock route path (replace with actual coordinates)
        const routePoints = [
            { lat: 10.0, lon: 76.3 }, // from_location approx
            { lat: 11.2, lon: 75.8 }  // to_location approx
        ];
        const currentPoint = { lat: latitude, lon: longitude };
        const deviation = this.calculateMaxDeviation(routePoints, currentPoint);
        return deviation > this.ROUTE_DEVIATION_THRESHOLD;
    }

    private calculateMaxDeviation(points: { lat: number; lon: number }[], current: { lat: number; lon: number }): number {
        let maxDeviation = 0;
        for (let i = 0; i < points.length - 1; i++) {
            const deviation = this.perpendicularDistance(points[i], points[i + 1], current);
            maxDeviation = Math.max(maxDeviation, deviation);
        }
        return maxDeviation;
    }

    private perpendicularDistance(p1: { lat: number; lon: number }, p2: { lat: number; lon: number }, p: { lat: number; lon: number }): number {
        const a = this.calculateHaversineDistance(p1.lat, p1.lon, p2.lat, p2.lon);
        const b = this.calculateHaversineDistance(p1.lat, p1.lon, p.lat, p.lon);
        const c = this.calculateHaversineDistance(p2.lat, p2.lon, p.lat, p.lon);
        const s = (a + b + c) / 2;
        const area = Math.sqrt(s * (s - a) * (s - b) * (s - c)); // Heron's formula
        return area * 2 / a; // Height of triangle (approx distance)
    }

    private checkSuddenSpeedChange(busId: number, currentSpeed: number): boolean {
        const lastLocation = this.lastKnownLocations.get(busId);
        if (!lastLocation) return false;
        const timeDiff = (Date.now() - lastLocation.timestamp) / 1000; // seconds
        const speedDiff = Math.abs(currentSpeed - lastLocation.speed);
        return timeDiff > 0 && (speedDiff / timeDiff) * 3.6 > this.SUDDEN_CHANGE_THRESHOLD; // m/s to km/h per second
    }
}