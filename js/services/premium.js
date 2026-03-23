/**
 * Premium tier gating service
 */

import { getByKey, put } from '../db/database.js';
import store from '../state/store.js';

const VALID_TOKENS = ['PREMIUM2024'];

export const PremiumService = {
  async load() {
    const record = await getByKey('settings', 'premium_status');
    const isPremium = record?.value === true;
    store.set('isPremium', isPremium);
    return isPremium;
  },

  async isPremium() {
    return store.get('isPremium') ?? false;
  },

  async activate(token = 'manual') {
    if (token !== 'manual' && !VALID_TOKENS.includes(token)) {
      throw new Error('유효하지 않은 코드입니다.');
    }
    await put('settings', { key: 'premium_status', value: true });
    await put('settings', { key: 'premium_token', value: token });
    await put('settings', { key: 'premium_activatedAt', value: new Date().toISOString() });
    store.set('isPremium', true);
  },

  async deactivate() {
    await put('settings', { key: 'premium_status', value: false });
    store.set('isPremium', false);
  },

  async canAddGroup() {
    return { allowed: true };
  },

  async canAddStudent(groupId) {
    return { allowed: true };
  },

  async canExport() {
    return { allowed: true };
  },

  async canViewAdvancedStats() {
    return { allowed: true };
  },
};

export default PremiumService;
