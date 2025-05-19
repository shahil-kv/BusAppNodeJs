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
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  ACCEPTED: "ACCEPTED",
  MISSED: "MISSED",
  DECLINED: "DECLINED",
  FAILED: "FAILED",
};

// Enum for session statuses
const SessionStatusEnum = {
  IN_PROGRESS: "IN_PROGRESS",
  STOPPED: "STOPPED",
  COMPLETED: "COMPLETED",
};

export { CallStatusEnum, SessionStatusEnum };
