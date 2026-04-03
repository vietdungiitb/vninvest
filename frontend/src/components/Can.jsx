/**
 * components/Can.jsx
 * Wrapper component kiểm tra CASL ability.
 * Ẩn content nếu user không có quyền.
 *
 * Dùng:
 *   <Can I="read" a="WhaleAdvisory">
 *     <WhaleDetailContent />
 *   </Can>
 *
 *   <Can I="read" a="WhaleAdvisoryDetail" fallback={<UpgradePrompt />}>
 *     <DeepAnalysis />
 *   </Can>
 */
import { useAbility } from '../context/AbilityContext';

export default function Can({ I: action, a: subject, children, fallback = null }) {
  const ability = useAbility();
  return ability.can(action, subject) ? children : fallback;
}
