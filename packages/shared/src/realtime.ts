export type PeerRole = 'host' | 'guest';

export interface RealtimeEnvelope<TPayload> {
  from: PeerRole;
  payload: TPayload;
  createdAt: number;
}

export interface RealtimeEndpoint<TPayload> {
  readonly role: PeerRole;
  send(payload: TPayload): void;
  subscribe(listener: (envelope: RealtimeEnvelope<TPayload>) => void): () => void;
}

export interface LinkedRealtimeEndpoints<TPayload> {
  host: RealtimeEndpoint<TPayload>;
  guest: RealtimeEndpoint<TPayload>;
}

type Listener<TPayload> = (envelope: RealtimeEnvelope<TPayload>) => void;

class InMemoryRealtimeEndpoint<TPayload> implements RealtimeEndpoint<TPayload> {
  public readonly role: PeerRole;
  private readonly listeners = new Set<Listener<TPayload>>();
  private remote: InMemoryRealtimeEndpoint<TPayload> | null = null;

  constructor(role: PeerRole) {
    this.role = role;
  }

  connect(remote: InMemoryRealtimeEndpoint<TPayload>): void {
    this.remote = remote;
  }

  send(payload: TPayload): void {
    if (!this.remote) return;
    const envelope: RealtimeEnvelope<TPayload> = {
      from: this.role,
      payload,
      createdAt: Date.now(),
    };
    this.remote.receive(envelope);
  }

  subscribe(listener: Listener<TPayload>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private receive(envelope: RealtimeEnvelope<TPayload>): void {
    this.listeners.forEach((listener) => listener(envelope));
  }
}

export function createLinkedRealtimeEndpoints<TPayload>(): LinkedRealtimeEndpoints<TPayload> {
  const host = new InMemoryRealtimeEndpoint<TPayload>('host');
  const guest = new InMemoryRealtimeEndpoint<TPayload>('guest');

  host.connect(guest);
  guest.connect(host);

  return { host, guest };
}
