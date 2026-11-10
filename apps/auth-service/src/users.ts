import type { Knex } from "knex";
import type { Role } from "@markethub/shared";

export interface UserRow {
  id: number;
  name: string;
  role: Role;
  passwordHash: string;
}

export class DuplicateUserError extends Error {}

/** All SQL of auth-service. Tests replace it with an in-memory fake. */
export interface UsersRepository {
  /** Case-insensitive lookup. */
  findByName(name: string): Promise<UserRow | undefined>;
  findById(id: number): Promise<UserRow | undefined>;
  /** @throws DuplicateUserError when the name is taken (case-insensitively). */
  create(user: Omit<UserRow, "id">): Promise<UserRow>;
}

const COLUMNS = ["id", "name", "role", "password_hash as passwordHash"];

export function createUsersRepository(db: Knex): UsersRepository {
  return {
    findByName: (name) => db("users").select<UserRow[]>(COLUMNS).whereRaw("lower(name) = lower(?)", [name]).first(),
    findById: (id) => db("users").select<UserRow[]>(COLUMNS).where({ id }).first(),
    async create({ name, role, passwordHash }) {
      try {
        const [row] = await db("users")
          .insert({ name, role, password_hash: passwordHash })
          .returning<UserRow[]>(COLUMNS);
        return row!;
      } catch (err) {
        if ((err as { code?: string }).code === "23505") throw new DuplicateUserError(name);
        throw err;
      }
    },
  };
}
