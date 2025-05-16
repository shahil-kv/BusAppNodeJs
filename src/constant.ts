export const UserRolesEnum = {
  ADMIN: "ADMIN",
  USER: "USER",
};
export enum OpsModeEnum {
  INSERT = "INSERT",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
}

// Enum for call statuses
const CallStatusEnum = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  ACCEPTED: "accepted",
  MISSED: "missed",
  DECLINED: "declined",
  FAILED: "failed",
};

// Enum for session statuses
const SessionStatusEnum = {
  IN_PROGRESS: "in_progress",
  STOPPED: "stopped",
  COMPLETED: "completed",
};

export { CallStatusEnum, SessionStatusEnum };
