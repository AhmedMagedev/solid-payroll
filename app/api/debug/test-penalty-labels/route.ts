import { NextResponse } from 'next/server';

function formatPenaltyLabel(penalty: { severity: string; penaltyType: string; lateMinutes?: number | null; description: string }): string {
  switch (penalty.severity) {
    case 'GRACE_PERIOD':
      return `${penalty.lateMinutes} minutes makeup time`;
    case 'MINOR':
      if (penalty.penaltyType === 'LATE_ARRIVAL') {
        return '30 min penalty';
      } else {
        return 'Early departure penalty';
      }
    case 'MODERATE':
      return '90 min penalty';
    case 'MAJOR':
      return 'Half day penalty';
    case 'FULL_DAY':
      return 'Unpaid day';
    default:
      return penalty.description;
  }
}

export async function GET() {
  const testPenalties = [
    {
      severity: 'GRACE_PERIOD',
      penaltyType: 'LATE_ARRIVAL',
      lateMinutes: 7,
      description: 'Arrived 7 minutes late (within 30-minute grace period). Makeup time required.',
    },
    {
      severity: 'MINOR',
      penaltyType: 'LATE_ARRIVAL',
      lateMinutes: 42,
      description: 'Arrived 42 minutes late (12 minutes beyond grace period). 1 hour salary deduction.',
    },
    {
      severity: 'MODERATE',
      penaltyType: 'LATE_ARRIVAL',
      lateMinutes: 84,
      description: 'Arrived 84 minutes late (54 minutes beyond grace period). 3 hours salary deduction.',
    },
    {
      severity: 'MINOR',
      penaltyType: 'EARLY_DEPARTURE',
      lateMinutes: null,
      description: 'Left 30 minutes early. 0.50 hours salary deduction.',
    },
    {
      severity: 'FULL_DAY',
      penaltyType: 'LATE_ARRIVAL',
      lateMinutes: 181,
      description: 'Arrived 181 minutes late (151 minutes beyond grace period). Full day considered unpaid.',
    },
  ];

  const results = testPenalties.map(penalty => ({
    original: penalty,
    newLabel: formatPenaltyLabel(penalty),
  }));

  return NextResponse.json({
    message: 'Testing penalty label formatting',
    results,
  });
} 