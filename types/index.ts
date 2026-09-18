export type Role = "ADMIN" | "MANAGER" | "VIEWER";
export type Status = "TODO" | "IN_PROGRESS" | "WAITING" | "COMPLETED" | "CANCELLED";
export type Priority = "NORMAL" | "IMPORTANT" | "URGENT";
export type User = { id:string; name:string; email:string; role:Role; color:string };
export type ChecklistItem = { id:string; text:string; done:boolean };
export type Audit = { id:string; at:string; actor:string; action:string; detail?:string };
export type Deadline = { id:string; title:string; description:string; dueDate:string; dueTime?:string; priority:Priority; status:Status; category:string; assigneeId:string; notifyIds:string[]; recurrence:string; reminders:number[]; notes:string; waitingFor:string; requireRead:boolean; checklist:ChecklistItem[]; links:string[]; createdAt:string; updatedAt:string; takenAt?:string; completedAt?:string; deletedAt?:string; audits:Audit[] };
export type Database = { users:User[]; deadlines:Deadline[]; categories:string[]; notificationLog:{id:string;message:string;at:string}[] };
