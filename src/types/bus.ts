interface OwnerOperationalData {
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
      from_location: string;
      to_location: string;
      location_name: string;
      start_time: string;
      end_time: string;
      route_created_at: string;
      route_updated_at: string;
    }>;
  }>;
}

export { OwnerOperationalData };
