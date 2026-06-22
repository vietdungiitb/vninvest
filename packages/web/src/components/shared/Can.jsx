import { useAbility } from '../../context/AbilityContext.js';

export default function Can({ I: action, a: subject, children, fallback = null }) {
  const ability = useAbility();
  return ability.can(action, subject) ? children : fallback;
}
