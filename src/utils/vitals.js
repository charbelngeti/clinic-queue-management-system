// DR-04: vital signs outside physiologically possible ranges are REJECTED (data-entry errors);
// values outside normal ranges are FLAGGED for the clinician.
export const VITAL_LIMITS = {
  temperature: { min: 30, max: 45, label: 'Temperature (°C)' },
  systolic: { min: 50, max: 260, label: 'Systolic BP (mmHg)' },
  diastolic: { min: 30, max: 160, label: 'Diastolic BP (mmHg)' },
  pulse: { min: 20, max: 250, label: 'Pulse (bpm)' },
  respRate: { min: 5, max: 60, label: 'Respiratory rate (/min)' },
  spo2: { min: 50, max: 100, label: 'SpO₂ (%)' },
  weight: { min: 0.5, max: 350, label: 'Weight (kg)' },
  height: { min: 30, max: 250, label: 'Height (cm)' },
};

export function vitalsRules() {
  return Object.fromEntries(Object.entries(VITAL_LIMITS).map(([k, r]) => [k, { type: 'number', ...r }]));
}

export function computeBmi(weight, height) {
  if (!weight || !height) return undefined;
  const m = height / 100;
  return Math.round((weight / (m * m)) * 10) / 10;
}

/** Returns flag codes for abnormal values (FR-NUR-05). */
export function vitalFlags(v) {
  const flags = [];
  if (v.temperature >= 38) flags.push('FEVER');
  else if (v.temperature > 37.5) flags.push('RAISED_TEMP');
  if (v.temperature && v.temperature < 35) flags.push('HYPOTHERMIA');
  if (v.systolic >= 180 || v.diastolic >= 120) flags.push('HYPERTENSIVE_CRISIS');
  else if (v.systolic >= 140 || v.diastolic >= 90) flags.push('HIGH_BP');
  if (v.systolic && v.systolic < 90) flags.push('LOW_BP');
  if (v.pulse > 100) flags.push('TACHYCARDIA');
  if (v.pulse && v.pulse < 50) flags.push('BRADYCARDIA');
  if (v.respRate > 24) flags.push('HIGH_RESP_RATE');
  if (v.spo2 && v.spo2 < 92) flags.push('LOW_SPO2');
  else if (v.spo2 && v.spo2 < 95) flags.push('BORDERLINE_SPO2');
  return flags;
}
