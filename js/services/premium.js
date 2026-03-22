/**
 * Premium tier gating service
 * All features are open to all users.
 */

import { put } from '../db/database.js';
import store from '../state/store.js';

export const PremiumService = {
  async load() {
    store.set('isPremium', true);
    return true;
  },

  async isPremium() {
    return true;
  },

  async activate(token = 'manual') {
    await put('settings', { key: 'premium_status', value: true });
    await put('settings', { key: 'premium_token', value: token });
    await put('settings', { key: 'premium_activatedAt', value: new Date().toISOString() });
    store.set('isPremium', true);
  },

  async deactivate() {
    await put('settings', { key: 'premium_status', value: false });
    store.set('isPremium', true); // always keep premium active
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
