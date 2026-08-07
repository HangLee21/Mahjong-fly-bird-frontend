import { assetManager } from 'cc';

interface BundleLoader {
  loadDir(
    path: string,
    onProgress: (finished: number, total: number, item: unknown) => void,
    onComplete: (err: Error | null, assets: unknown[]) => void,
  ): void;
}

interface BundleManager {
  loadBundle(
    name: string,
    onProgress: (finished: number, total: number) => void,
    onComplete: (err: Error | null, bundle: BundleLoader | null) => void,
  ): void;
}

interface DirState {
  dir: string;
  finished: number;
  total: number;
}

function loadResourcesBundle(): Promise<BundleLoader> {
  return new Promise<BundleLoader>((resolve, reject) => {
    const manager = assetManager as unknown as BundleManager;
    manager.loadBundle(
      'resources',
      () => undefined,
      (err, bundle) => {
        if (err || !bundle) {
          reject(err || new Error('resources bundle is unavailable'));
          return;
        }
        resolve(bundle);
      },
    );
  });
}

function loadDir(bundle: BundleLoader, dir: string, onProgress: (finished: number, total: number) => void): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    bundle.loadDir(
      dir,
      (finished, total) => onProgress(finished, total),
      (err) => {
        if (err) reject(err);
        else resolve();
      },
    );
  });
}

/**
 * Stage 0: loads only the waiting-page assets (background, logo, spinner and
 * progress bar images). This is a tiny set so the loading page itself can be
 * shown as fast as possible.
 */
export function preloadLoadingAssets(onProgress: (finished: number, total: number) => void): Promise<void> {
  return loadResourcesBundle().then((bundle) => loadDir(bundle, 'textures/ui/loading', onProgress));
}

/**
 * Stage 1: preloads every remaining texture and audio clip in the remote
 * `resources` bundle. The progress callback reports the combined download
 * progress so the waiting page can render a real loading bar.
 */
export function preloadGameResources(onProgress: (finished: number, total: number) => void): Promise<void> {
  return loadResourcesBundle().then(
    (bundle) =>
      new Promise<void>((resolve, reject) => {
        const dirs: DirState[] = [
          { dir: 'textures', finished: 0, total: 0 },
          { dir: 'audio', finished: 0, total: 0 },
        ];
        let pending = dirs.length;
        let settled = false;

        const report = (): void => {
          const finished = dirs.reduce((sum, state) => sum + state.finished, 0);
          const total = dirs.reduce((sum, state) => sum + state.total, 0);
          onProgress(finished, total);
        };

        dirs.forEach((state) => {
          bundle.loadDir(
            state.dir,
            (finished, total) => {
              state.finished = finished;
              state.total = total;
              report();
            },
            (dirErr) => {
              pending -= 1;
              if (settled) return;
              if (dirErr) {
                settled = true;
                reject(dirErr);
                return;
              }
              state.finished = state.total;
              if (pending === 0) {
                settled = true;
                report();
                resolve();
              }
            },
          );
        });
      }),
  );
}
