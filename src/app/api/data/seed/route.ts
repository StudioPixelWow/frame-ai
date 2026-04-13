/**
 * POST /api/data/seed - Force re-seed the database
 *
 * This endpoint clears all data and re-seeds with demo data.
 * Useful for resetting the application to a clean state during development.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  clients,
  projects,
  tasks,
  payments,
  leads,
  employees,
  campaigns,
  users,
  approvals,
  activities,
} from '@/lib/db';
import { resetSeed, ensureSeeded } from '@/lib/db/seed';

export async function POST(_req: NextRequest) {
  try {
    // Reset the seeding flag
    resetSeed();

    // Clear all collections by deleting all items
    const clearCollection = (store: any) => {
      const allItems = store.getAll();
      allItems.forEach((item: any) => {
        store.delete(item.id);
      });
    };

    clearCollection(clients);
    clearCollection(projects);
    clearCollection(tasks);
    clearCollection(payments);
    clearCollection(leads);
    clearCollection(employees);
    clearCollection(campaigns);
    clearCollection(users);
    clearCollection(approvals);
    clearCollection(activities);

    // Re-seed with fresh data
    ensureSeeded();

    return NextResponse.json(
      {
        success: true,
        message: 'Database reset and re-seeded with demo data',
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to reset seed' },
      { status: 500 }
    );
  }
}
