/**
 * context/AbilityContext.js
 * CASL ability context — được cập nhật sau khi login lấy abilities từ /api/auth/me.
 * Dùng useAbility() hook trong component để kiểm tra quyền.
 */
import { createContext, useContext } from 'react';
import { createMongoAbility } from '@casl/ability';

// Khởi tạo với ability rỗng (chưa login)
export const AbilityContext = createContext(createMongoAbility([]));

export const useAbility = () => useContext(AbilityContext);

/**
 * Tạo ability object từ mảng abilities trả về bởi /api/auth/me.
 * [{action: 'manage', subject: 'Portfolio'}, ...]
 */
export function createAbilityFromRules(rules) {
  return createMongoAbility(rules || []);
}
