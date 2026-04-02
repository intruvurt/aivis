import { pool } from '../../services/postgresql.js';

export interface BuildSpecBlueprint {
  id: string;
  blueprint: string;
  created_at: Date;
}

async function createBuildSpecBlueprint(blueprint: string): Promise<BuildSpecBlueprint> {
  const result = await pool.query(
    `INSERT INTO build_spec_blueprints (blueprint) VALUES ($1) RETURNING *`,
    [blueprint]
  );
  return result.rows[0];
}

async function getBuildSpecBlueprintById(id: string): Promise<BuildSpecBlueprint | null> {
  const result = await pool.query(
    `SELECT * FROM build_spec_blueprints WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export const BuildSpecBlueprintModel = {
  create: createBuildSpecBlueprint,
  getById: getBuildSpecBlueprintById,
};
