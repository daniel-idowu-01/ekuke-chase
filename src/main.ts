import './style.css';
import RAPIER from '@dimforge/rapier3d-compat';
import { GameManager } from './core/GameManager';


async function main() {
  console.log('Starting Mini Game...');

  try {
    await RAPIER.init();

    const gameManager = new GameManager();
    await gameManager.init();
  } catch (error) {
    console.error('Failed to initialize game:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
