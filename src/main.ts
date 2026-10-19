import { mountWorkstation } from './app/workstation';
import './style.css';

const dispose = mountWorkstation(document.querySelector<HTMLDivElement>('#app')!);
window.addEventListener('pagehide', event => {
  if (!event.persisted) dispose();
});
