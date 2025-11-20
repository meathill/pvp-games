export interface SharedContextOptions {
  project: string;
}

export interface SharedContext {
  project: string;
  metadata: {
    initialized: boolean;
    createdAt: Date;
  };
}

export function createSharedContext(options: SharedContextOptions): SharedContext {
  return {
    project: options.project,
    metadata: {
      initialized: true,
      createdAt: new Date()
    }
  };
}
