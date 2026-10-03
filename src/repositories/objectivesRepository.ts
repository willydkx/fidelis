import { Db } from '@/db/types';
import { Cadence, ObjectiveStatus, TrackingType } from '@/models/enums';
import { NewObjective, Objective } from '@/models/objective';
import { ISODate, today } from '@/utils/dateUtils';

interface ObjectiveRow {
  id: number;
  name: string;
  description: string | null;
  cadence: string;
  tracking_type: string;
  target_value: number | null;
  unit: string | null;
  status: string;
  color: string | null;
  sort_order: number;
  created_at: string;
  archived_at: string | null;
  days_of_week: string | null;
}

function serializeDays(days: number[] | null | undefined): string | null {
  return days && days.length ? [...days].sort((a, b) => a - b).join(',') : null;
}

function deserializeDays(value: string | null): number[] | null {
  return value ? value.split(',').map(Number) : null;
}

function rowToObjective(row: ObjectiveRow): Objective {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    cadence: row.cadence as Cadence,
    trackingType: row.tracking_type as TrackingType,
    targetValue: row.target_value,
    unit: row.unit,
    status: row.status as ObjectiveStatus,
    color: row.color,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
    daysOfWeek: deserializeDays(row.days_of_week),
  };
}

export class ObjectivesRepository {
  constructor(private readonly db: Db) {}

  async create(newObjective: NewObjective): Promise<Objective> {
    const result = await this.db.runAsync(
      `INSERT INTO objectives
         (name, description, cadence, tracking_type, target_value, unit, color, sort_order, days_of_week)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newObjective.name,
        newObjective.description ?? null,
        newObjective.cadence,
        newObjective.trackingType,
        newObjective.targetValue ?? null,
        newObjective.unit ?? null,
        newObjective.color ?? null,
        newObjective.sortOrder ?? 0,
        serializeDays(newObjective.daysOfWeek),
      ],
    );
    return (await this.get(result.lastInsertRowId))!;
  }

  async get(objectiveId: number): Promise<Objective | null> {
    const row = await this.db.getFirstAsync<ObjectiveRow>('SELECT * FROM objectives WHERE id = ?', [
      objectiveId,
    ]);
    return row ? rowToObjective(row) : null;
  }

  async list(status?: ObjectiveStatus): Promise<Objective[]> {
    const rows =
      status === undefined
        ? await this.db.getAllAsync<ObjectiveRow>('SELECT * FROM objectives ORDER BY sort_order, name', [])
        : await this.db.getAllAsync<ObjectiveRow>(
            'SELECT * FROM objectives WHERE status = ? ORDER BY sort_order, name',
            [status],
          );
    return rows.map(rowToObjective);
  }

  async update(objective: Objective): Promise<void> {
    await this.db.runAsync(
      `UPDATE objectives
       SET name = ?, description = ?, cadence = ?, tracking_type = ?,
           target_value = ?, unit = ?, status = ?, color = ?, sort_order = ?, days_of_week = ?
       WHERE id = ?`,
      [
        objective.name,
        objective.description,
        objective.cadence,
        objective.trackingType,
        objective.targetValue,
        objective.unit,
        objective.status,
        objective.color,
        objective.sortOrder,
        serializeDays(objective.daysOfWeek),
        objective.id,
      ],
    );
  }

  async archive(objectiveId: number, asOf: ISODate = today()): Promise<void> {
    await this.db.runAsync("UPDATE objectives SET status = 'archived', archived_at = ? WHERE id = ?", [
      asOf,
      objectiveId,
    ]);
  }

  /** Permanently removes the objective and all its logged entries. */
  async delete(objectiveId: number): Promise<void> {
    // Entries would also go via ON DELETE CASCADE; deleting them explicitly doesn't depend on
    // PRAGMA foreign_keys being on for this connection.
    await this.db.runAsync('DELETE FROM daily_entries WHERE objective_id = ?', [objectiveId]);
    await this.db.runAsync('DELETE FROM objectives WHERE id = ?', [objectiveId]);
  }

  async setStatus(objectiveId: number, status: ObjectiveStatus.ACTIVE | ObjectiveStatus.PAUSED): Promise<void> {
    await this.db.runAsync('UPDATE objectives SET status = ?, archived_at = NULL WHERE id = ?', [
      status,
      objectiveId,
    ]);
  }

  /** Persists a new display order: ids[0] gets sort_order 0, and so on. */
  async reorder(ids: number[]): Promise<void> {
    for (const [index, id] of ids.entries()) {
      await this.db.runAsync('UPDATE objectives SET sort_order = ? WHERE id = ?', [index, id]);
    }
  }
}
