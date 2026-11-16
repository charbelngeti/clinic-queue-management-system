// State machines (FR-APT-06, FR-QUE-07, FR-LAB-02, NFR-INT-02). Every status change in the system is
// checked against these maps, and the database update is made conditional on the current status, so two
// users acting at the same moment cannot both succeed.
import { invalidTransition } from './errors.js';

export const APPOINTMENT_TRANSITIONS = {
  scheduled: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['completed', 'cancelled'], // cancelled = patient left before being seen
  completed: [],
  cancelled: [],
  no_show: [],
};

export const QUEUE_TRANSITIONS = {
  waiting: ['called', 'cancelled'],
  called: ['in_service', 'skipped', 'waiting', 'completed', 'cancelled'], // waiting = moved to next stage
  in_service: ['waiting', 'completed', 'cancelled'],
  skipped: ['waiting', 'cancelled'],
  completed: [],
  cancelled: [],
};

// Which department a patient may be sent to from each department.
export const STAGE_TRANSITIONS = {
  triage: ['consultation'],
  consultation: ['consultation', 'lab', 'pharmacy', 'done'], // consultation → consultation = referral
  lab: ['consultation'],
  pharmacy: ['done'],
  done: [],
};

export const LAB_TRANSITIONS = {
  requested: ['sample_collected', 'cancelled'],
  sample_collected: ['in_progress', 'completed'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
};

export function assertTransition(map, entity, from, to) {
  if (!map[from] || !map[from].includes(to)) throw invalidTransition(entity, from, to);
}

/** Statuses from which `to` can be reached — used to build conditional update filters. */
export const fromStatesFor = (map, to) => Object.keys(map).filter((s) => map[s].includes(to));
