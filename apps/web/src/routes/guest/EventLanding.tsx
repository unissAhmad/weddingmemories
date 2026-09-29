import { useEventContext } from './EventLayout';
import { WelcomePage } from './WelcomePage';

export function EventLanding() {
  return <WelcomePage event={useEventContext()} />;
}
