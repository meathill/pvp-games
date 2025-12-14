import { getCloudflareContext } from '@opennextjs/cloudflare';
import DuelSnakeOnline from '../../_components/duel-snake-online';

export default async function DuelSnakeOnlinePage() {
  const { env } = await getCloudflareContext({ async: true });
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <DuelSnakeOnline defaultServerUrl={env.NEXT_PUBLIC_SIGNALING_URL!} />
    </main>
  );
}
