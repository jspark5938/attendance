/**
 * Groups store CRUD operations
 */

import { getAll, getByKey, put, del, count } from './database.js';
import { uuid } from '../utils/date.js';

export const GroupsDB = {
  /** Get all groups, sorted by createdAt */
  async getAll() {
    const groups = await getAll('groups');
    return groups.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  /** Get a single group by id */
  async get(id) {
    return getByKey('groups', id);
  },

  /** Create a new group */
  async create({ name, description = '', color }) {
    const now = new Date().toISOString();
    const group = {
      id: uuid(),
      name: name.trim(),
      description: description.trim(),
      color,
      createdAt: now,
      updatedAt: now,
    };
    await put('groups', group);
    return group;
  },

  /** Update an existing group */
  async update(id, fields) {
    const group = await this.get(id);
    if (!group) throw new Error('그룹을 찾을 수 없습니다.');
    const updated = {
      ...group,
      ...fields,
      id,
      updatedAt: new Date().toISOString(),
    };
    if (updated.name) updated.name = updated.name.trim();
    await put('groups', updated);
    return updated;
  },

  /** Delete a group (caller should also delete students and attendance) */
  async delete(id) {
    return del('groups', id);
  },

  /** Count total groups */
  async count() {
    return count('groups');
  },
};
