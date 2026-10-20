import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { robotPose, restingQ } from '../robot/planner';
import { defaultPenSettings, drawingBoard, type PenJob } from '../process/pen';
import type { PlaybackSnapshot } from '../simulation/playback';
import { processes, type ProcessConfig } from '../process/craft';

const zAxis = new THREE.Vector3(0, 0, 1);
const yAxis = new THREE.Vector3(0, 1, 0);

export class Workspace {
  private readonly scene = new THREE.Scene();
  private readonly robot = new THREE.Group();
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 1, 2000);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  private readonly controls: OrbitControls;
  private readonly links: THREE.Mesh[] = [];
  private readonly joints: THREE.Mesh[] = [];
  private readonly pen = new THREE.Group();
  private readonly toolBody: THREE.Mesh;
  private readonly toolTip: THREE.Mesh;
  private readonly paper = new THREE.Group();
  private readonly guide = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: '#6e9ab0', dashSize: 1.4, gapSize: 1, transparent: true, opacity: 0.55 }));
  private readonly inkMaterial = new THREE.MeshStandardMaterial({ color: '#24465f', roughness: 1 });
  private readonly inkGeometry = new THREE.CylinderGeometry(1, 1, 1, 12);
  private ink = new THREE.InstancedMesh(this.inkGeometry, this.inkMaterial, 1);
  private penLengthMm = defaultPenSettings.penLengthMm;
  private surfaceZmm = defaultPenSettings.surfaceZmm;
  private config: ProcessConfig = processes.pen;
  private frameAxes = new THREE.AxesHelper(14);
  private readonly matrix = new THREE.Matrix4();
  private readonly observer: ResizeObserver;
  private readonly contextLost: (event: Event) => void;
  private viewMode: 'default' | 'top' | 'custom' = 'default';

  constructor(private readonly container: HTMLElement, onContextLost: () => void) {
    this.scene.background = new THREE.Color('#e9eee9');
    this.scene.fog = new THREE.Fog('#e9eee9', 650, 1400);
    this.camera.up.copy(zAxis);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label', '机械臂创作三维工作空间，拖动旋转视角，滚轮缩放');
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 150;
    this.controls.maxDistance = 850;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.addEventListener('start', () => { this.viewMode = 'custom'; });
    this.resetView();

    this.scene.add(new THREE.HemisphereLight('#ffffff', '#778c7f', 2.4));
    const light = new THREE.DirectionalLight('#fff6e6', 3);
    light.position.set(150, -180, 400);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    Object.assign(light.shadow.camera, { left: -250, right: 250, top: 250, bottom: -250, near: 1, far: 900 });
    light.shadow.bias = -0.001;
    this.scene.add(light);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ color: '#e5ebe5', roughness: 1 }));
    floor.receiveShadow = true;
    floor.position.z = -6;
    this.scene.add(floor);
    const grid = new THREE.GridHelper(700, 35, '#c4cfc8', '#d5ded7');
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -5.9;
    this.scene.add(grid);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(17, 21, 7, 48), new THREE.MeshStandardMaterial({ color: '#263e48', metalness: 0.4, roughness: 0.5 }));
    base.rotation.x = Math.PI / 2;
    base.position.z = -1.5;
    base.castShadow = true;
    this.robot.add(base);
    const linkMaterial = new THREE.MeshStandardMaterial({ color: '#d4dce1', metalness: 0.55, roughness: 0.35 });
    const jointMaterial = new THREE.MeshStandardMaterial({ color: '#d57a46', metalness: 0.25, roughness: 0.5 });
    for (let i = 0; i < 8; i++) {
      const link = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.3, 1, 16), linkMaterial);
      link.castShadow = true;
      this.links.push(link);
      this.robot.add(link);
    }
    for (let i = 0; i < 9; i++) {
      const joint = new THREE.Mesh(new THREE.SphereGeometry(i === 0 ? 6 : 4.4, 20, 16), i === 0 ? base.material : jointMaterial);
      joint.castShadow = true;
      this.joints.push(joint);
      this.robot.add(joint);
    }
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#294e63', metalness: 0.35, roughness: 0.4 });
    this.toolBody = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 1, 16), bodyMaterial);
    this.toolBody.rotation.x = Math.PI / 2;
    this.toolTip = new THREE.Mesh(new THREE.ConeGeometry(1.9, 5, 16), new THREE.MeshStandardMaterial({ color: '#c4a883', roughness: 0.8 }));
    this.toolTip.rotation.x = Math.PI / 2;
    this.pen.add(this.toolBody, this.toolTip);
    this.robot.add(this.pen);
    this.scene.add(this.robot, this.frameAxes, this.guide, this.paper);
    this.frameAxes.visible = false;

    const board = new THREE.Mesh(new THREE.BoxGeometry(drawingBoard.widthMm, drawingBoard.depthMm, drawingBoard.thicknessMm), new THREE.MeshStandardMaterial({ color: '#bca98c', roughness: 0.9 }));
    board.position.set(drawingBoard.centerXmm, drawingBoard.centerYmm, -drawingBoard.sheetGapMm - drawingBoard.thicknessMm / 2);
    board.receiveShadow = true;
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(drawingBoard.widthMm - 6, drawingBoard.depthMm - 6), new THREE.MeshStandardMaterial({ color: '#fffdf6', roughness: 1, side: THREE.DoubleSide }));
    sheet.position.set(drawingBoard.centerXmm, drawingBoard.centerYmm, 0);
    sheet.receiveShadow = true;
    this.paper.add(board, sheet);
    const paperGrid: number[] = [];
    for (let x = 40; x <= 180; x += 10) paperGrid.push(x, -50, 0.015, x, 50, 0.015);
    for (let y = -50; y <= 50; y += 10) paperGrid.push(40, y, 0.015, 180, y, 0.015);
    this.paper.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(paperGrid, 3)), new THREE.LineBasicMaterial({ color: '#e5e9e3', transparent: true, opacity: 0.7 })));
    this.ink.count = 0;
    this.ink.frustumCulled = false;
    this.scene.add(this.ink);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
    this.contextLost = event => { event.preventDefault(); onContextLost(); };
    this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost);
  }

  setJob(job: PenJob): void {
    this.config = job.config ?? processes.pen;
    this.penLengthMm = job.settings.penLengthMm;
    this.surfaceZmm = job.settings.surfaceZmm;
    this.buildWorkpiece();
    const cream = this.config.id === 'cream';
    this.toolBody.geometry.dispose();
    this.toolBody.geometry = new THREE.CylinderGeometry(cream ? 1.8 : 1.9, cream ? 5 : 1.9, 1, 24);
    (this.toolBody.material as THREE.MeshStandardMaterial).color.set(cream ? '#f3e2d3' : '#294e63');
    this.toolTip.geometry.dispose();
    this.toolTip.geometry = cream ? new THREE.CylinderGeometry(1.2, 1.8, 5, 24) : new THREE.ConeGeometry(1.9, 5, 16);
    (this.toolTip.material as THREE.MeshStandardMaterial).color.set(cream ? '#b8c4c9' : '#c4a883');
    this.toolBody.scale.y = this.penLengthMm - 5;
    this.toolBody.position.z = (this.penLengthMm - 5) / 2;
    this.toolTip.position.z = this.penLengthMm - 2.5;
    const positions: number[] = [];
    job.targets.forEach((target, i) => {
      if (target.ink !== null && i > 0) positions.push(...job.targets[i - 1].position, ...target.position);
    });
    this.guide.geometry.dispose();
    this.guide.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.guide.computeLineDistances();
    this.guide.position.z = 0.18;
    this.scene.remove(this.ink);
    this.ink.dispose();
    this.ink = new THREE.InstancedMesh(this.inkGeometry, this.inkMaterial, job.targets.length + 1);
    this.ink.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.ink.frustumCulled = false;
    this.ink.count = 0;
    this.scene.add(this.ink);
    this.inkMaterial.color.set(this.config.color);
    this.showPose(restingQ);
    if (this.viewMode === 'top') this.topView();
  }

  private buildWorkpiece(): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.paper.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      }
    });
    this.paper.clear();
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    const w = this.config.workpiece;
    const material = new THREE.MeshStandardMaterial({ color: this.config.id === 'cream' ? '#fff1d9' : '#bca98c', roughness: 0.9 });
    if (w.shape === 'circle') {
      const cake = new THREE.Mesh(new THREE.CylinderGeometry(w.widthMm / 2, w.widthMm / 2, w.topMm - w.bottomMm, 96), material);
      cake.rotation.x = Math.PI / 2;
      cake.position.set(w.centerXmm, w.centerYmm, (w.topMm + w.bottomMm) / 2);
      cake.receiveShadow = true; cake.castShadow = true;
      this.paper.add(cake);
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(w.widthMm / 2 + 5, w.widthMm / 2 + 5, 0.8, 96), new THREE.MeshStandardMaterial({ color: '#d5ded8', metalness: 0.3, roughness: 0.6 }));
      plate.rotation.x = Math.PI / 2; plate.position.set(w.centerXmm, w.centerYmm, w.bottomMm - 0.4);
      this.paper.add(plate);
    } else {
      const board = new THREE.Mesh(new THREE.BoxGeometry(w.widthMm, w.depthMm, drawingBoard.thicknessMm), material);
      board.position.set(w.centerXmm, w.centerYmm, w.bottomMm + drawingBoard.thicknessMm / 2); board.receiveShadow = true;
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w.widthMm - 6, w.depthMm - 6), new THREE.MeshStandardMaterial({ color: '#fffdf6', roughness: 1, side: THREE.DoubleSide }));
      sheet.position.set(w.centerXmm, w.centerYmm, w.topMm); sheet.receiveShadow = true;
      this.paper.add(board, sheet);
    }
  }

  private showPose(q: number[]): void {
    const pose = robotPose(q, this.penLengthMm);
    pose.points.forEach((point, i) => this.joints[i].position.set(...point));
    this.links.forEach((link, i) => {
      const start = new THREE.Vector3(...pose.points[i]);
      const end = new THREE.Vector3(...pose.points[i + 1]);
      const direction = end.clone().sub(start);
      link.visible = direction.length() > 0.1;
      link.position.copy(start).lerp(end, 0.5);
      link.scale.y = direction.length();
      if (link.visible) link.quaternion.setFromUnitVectors(yAxis, direction.normalize());
    });
    this.pen.position.set(...pose.flange);
    this.pen.quaternion.set(...pose.orientation);
    this.frameAxes.position.set(...pose.tip);
    this.frameAxes.quaternion.set(...pose.orientation);
  }

  show(snapshot: PlaybackSnapshot): void {
    this.showPose(snapshot.q);
    snapshot.ink.forEach((segment, i) => {
      // 笔迹投影到纸面并微小抬高；奶油条带保留实际 TCP 高度。
      const cream = this.config.id === 'cream';
      const start = new THREE.Vector3(segment.start[0], segment.start[1], cream ? segment.start[2] : this.surfaceZmm + 0.22);
      const end = new THREE.Vector3(segment.end[0], segment.end[1], cream ? segment.end[2] : this.surfaceZmm + 0.22);
      const direction = end.clone().sub(start);
      this.matrix.compose(start.clone().lerp(end, 0.5), new THREE.Quaternion().setFromUnitVectors(yAxis, direction.lengthSq() > 1e-12 ? direction.clone().normalize() : yAxis), new THREE.Vector3(this.config.radiusMm, Math.max(direction.length(), 0.001), this.config.radiusMm));
      this.ink.setMatrixAt(i, this.matrix);
    });
    this.ink.count = snapshot.ink.length;
    this.ink.instanceMatrix.needsUpdate = true;
  }

  setRobotVisible(visible: boolean): void { this.robot.visible = visible; }
  clearInk(): void {
    this.ink.count = 0;
  }
  setGuideVisible(visible: boolean): void { this.guide.visible = visible; }
  setAxesVisible(visible: boolean): void { this.frameAxes.visible = visible; }

  resetView(): void {
    this.viewMode = 'default';
    this.camera.up.copy(zAxis);
    const { width, height } = this.container.getBoundingClientRect();
    const distance = 120 / Math.tan(THREE.MathUtils.degToRad(19)) * Math.max(1, height / Math.max(width, 1)) * 1.1;
    this.controls.target.set(85, 0, 70);
    this.camera.position.copy(new THREE.Vector3(215, -310, 205).normalize().multiplyScalar(distance).add(this.controls.target));
    this.controls.update();
  }

  topView(): void {
    this.viewMode = 'top';
    this.camera.up.copy(zAxis);
    const { width, height } = this.container.getBoundingClientRect();
    const distance = 92 / Math.tan(THREE.MathUtils.degToRad(19)) * Math.max(1, height / Math.max(width, 1));
    this.camera.position.set(110, -0.1, this.surfaceZmm + distance);
    this.controls.target.set(110, 0, this.surfaceZmm);
    this.controls.update();
  }

  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const { width, height } = this.container.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    if (this.viewMode === 'default') this.resetView();
    else if (this.viewMode === 'top') this.topView();
  }

  dispose(): void {
    this.observer.disconnect();
    this.controls.dispose();
    this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.scene.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      }
    });
    geometries.forEach(g => g.dispose());
    materials.forEach(m => m.dispose());
    this.ink.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
