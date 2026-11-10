import { DuplicateUserError, type UserRow, type UsersRepository } from "../src/users";

/** In-memory UsersRepository with the same case-insensitive uniqueness as the DB index. */
export function memoryUsers(): UsersRepository & { rows: UserRow[] } {
  const rows: UserRow[] = [];
  return {
    rows,
    findByName: async (name) => rows.find((u) => u.name.toLowerCase() === name.toLowerCase()),
    findById: async (id) => rows.find((u) => u.id === id),
    async create(user) {
      if (rows.some((u) => u.name.toLowerCase() === user.name.toLowerCase())) throw new DuplicateUserError(user.name);
      const row = { id: rows.length + 1, ...user };
      rows.push(row);
      return row;
    },
  };
}

/** Value of the mh_token cookie from a Set-Cookie header, or undefined. */
export function tokenFrom(setCookie: string[] | string | undefined): string | undefined {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const match = cookies.map((c) => /^mh_token=([^;]*)/.exec(c)).find(Boolean);
  return match?.[1] || undefined;
}
