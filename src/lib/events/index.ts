export { emitEvent, onEvent } from './event-bus';
export type { SystemEvent, SystemEventType, EventHandler } from './types';
export {
  emitLeadCreated,
  emitLeadStatusChanged,
  emitLeadAssigned,
  emitDealClosed,
  emitDealLost,
  emitTaskCreated,
  emitTaskCompleted,
  emitClientCreated,
  emitPaymentOverdue,
  emitManualTrigger,
} from './emit-helpers';
