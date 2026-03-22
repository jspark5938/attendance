/**
 * Students store CRUD operations
 */

import { getAllByIndex, getByKey, put, del, countByIndex, deleteByIndex } from './database.js';
import { uuid } from '../utils/date.js';

export const StudentsDB = {
  /** Get all students for a group, sorted by number then name */
  async getByGroup(groupId) {
    const students = await getAllByIndex('students', 'by_group', groupId);
    return students.sort((a, b) => {
      if (a.number !== b.number) return a.number - b.number;
      return a.name.localeCompare(b.name, 'ko');
    });
  },

  /** Get a single student */
  async get(id) {
    return getByKey('students', id);
  },

  /** Add a new student to a group */
  async create({ groupId, name, number, age, gender, phone, attendanceDays, classTime, registeredAt, memo = '' }) {
    const now = new Date().toISOString();
    const student = {
      id: uuid(),
      groupId,
      name: name.trim(),
      number: Number(number) || 0,
      age: age ? Number(age) : null,
      gender: gender || '',
      phone: (phone || '').trim(),
      attendanceDays: attendanceDays || [],
      classTime: (typeof classTime === 'object' && classTime !== null) ? classTime : {},
      registeredAt: registeredAt || now.slice(0, 10),
      memo: (memo || '').trim(),
      createdAt: now,
    };
    await put('students', student);
    return student;
  },

  /** Update student fields */
  async update(id, fields) {
    const student = await this.get(id);
    if (!student) throw new Error('학생을 찾을 수 없습니다.');
    const updated = { ...student, ...fields, id };
    if (updated.name) updated.name = updated.name.trim();
    if (fields.number !== undefined) updated.number = Number(fields.number) || 0;
    if (fields.age !== undefined) updated.age = fields.age ? Number(fields.age) : null;
    await put('students', updated);
    return updated;
  },

  /** Delete a student */
  async delete(id) {
    return del('students', id);
  },

  /** Delete all students in a group */
  async deleteByGroup(groupId) {
    return deleteByIndex('students', 'by_group', groupId);
  },

  /** Count students in a group */
  async countByGroup(groupId) {
    return countByIndex('students', 'by_group', groupId);
  },

  /**
   * Returns the next available student number for a group
   * (max number + 1, or 1 if no students)
   */
  async nextNumber(groupId) {
    const students = await this.getByGroup(groupId);
    if (!students.length) return 1;
    return Math.max(...students.map(s => s.number)) + 1;
  },
};
