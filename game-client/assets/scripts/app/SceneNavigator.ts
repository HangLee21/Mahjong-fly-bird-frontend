import { director } from 'cc';

export function loadScene(name: string): void {
  try {
    director.loadScene(name, () => {
      console.log(`[SceneNavigator] loaded scene: ${name}`);
    });
  } catch (error) {
    console.error(`[SceneNavigator] failed to load scene: ${name}`, error);
  }
}
