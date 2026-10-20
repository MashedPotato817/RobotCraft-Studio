import { patterns, type PatternId } from '../design/patterns';
import { createCraftJob, processes, type ProcessId } from '../process/craft';
import { jointTelemetry, type PlanningResult } from '../robot/planner';
import { Playback, type PlaybackSnapshot } from '../simulation/playback';
import { Workspace } from '../rendering/workspace';

const icon = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M8 24V16l8-8 8 8v8M8 16h16M16 8V4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="17" r="3" fill="currentColor"/></svg>`;
const phaseLabels = { travel: '空行程', lower: '接近工件', draw: '沿图案制作', lift: '抬起' };

function patternIcon(id: PatternId): string {
  const paths = patterns[id].strokes.map(stroke => `<polyline points="${stroke.map(([x, y]) => `${x * 85},${-y * 85}`).join(' ')}"/>`).join('');
  return `<svg viewBox="-50 -50 100 100" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

export function mountWorkstation(root: HTMLElement): () => void {
  root.innerHTML = `
    <header class="topbar">
      <a class="brand" href="./" aria-label="RobotCraft Studio 首页"><span class="brand-mark">${icon}</span><span>RobotCraft <b>Studio</b><small>机器人创作工作站</small></span></a>
      <div class="workspace-label"><span class="status-dot"></span><span id="workspaceName">笔绘工作站</span><span class="version-tag">双工艺仿真</span></div>
      <span class="top-note">从一个图案，到一件作品。</span>
    </header>
    <main class="studio">
      <aside class="sidebar" aria-label="创作控制台">
        <section class="control-section"><h2><span class="step-number">01</span>选择工艺</h2>
          <div class="process-list">${Object.values(processes).map(p => `<button class="process-card${p.id === 'pen' ? ' selected' : ''}" data-process="${p.id}" aria-pressed="${p.id === 'pen'}"><strong>${p.name}</strong><small>${p.tool} · ${p.workpieceName}</small></button>`).join('')}</div>
        </section>
        <section class="control-section"><h2><span class="step-number">02</span>选择图案</h2>
          <div class="pattern-grid">${Object.values(patterns).map(p => `<button class="pattern-card${p.id === 'robot' ? ' selected' : ''}" data-pattern="${p.id}" aria-pressed="${p.id === 'robot'}" title="${p.description}">${patternIcon(p.id)}<span>${p.name}</span></button>`).join('')}</div>
          <p id="patternDescription" class="subtle-note">${patterns.robot.description}</p>
        </section>
        <section class="control-section"><h2><span class="step-number">03</span>演示配置</h2>
          <p id="configSummary" class="config-summary"></p><p class="subtle-note">使用固定默认配置，选择图案即可开始。</p>
        </section>
        <div class="plan-card"><div><span class="status-dot"></span><strong id="planHeading">准备轨迹</strong><button id="replan" class="text-button" title="重新生成轨迹">重新规划 ↗</button></div><p id="planStatus" role="status">正在建立工具与工件的关系…</p><dl><div><dt>工具尖端最大偏差</dt><dd id="maxError">—</dd></div><div><dt id="totalLabel">笔画</dt><dd id="strokeTotal">—</dd></div></dl></div>
      </aside>
      <section class="workarea" aria-label="仿真工作站">
        <div class="stage-toolbar"><div><span class="eyebrow">LIVE WORKSPACE</span><strong>三维工作空间</strong></div><div class="view-actions"><button id="topView">俯视工件</button><button id="resetView">恢复视角</button></div></div>
        <div class="stage">
          <div id="viewport"></div>
          <div class="stage-badge"><span class="status-dot"></span><span id="stateBadge">规划中</span></div>
          <div class="view-options"><label><input id="showRobot" type="checkbox" checked/>机械臂</label><label><input id="showGuide" type="checkbox" checked/>目标辅助线</label><label><input id="showAxes" type="checkbox"/>笔尖坐标轴</label></div>
          <div class="stage-caption"><span><i class="legend-line"></i><span id="resultLegend">实际笔迹</span></span><span><i class="legend-line dashed"></i>目标路径</span><span>拖动旋转 · 滚轮缩放</span></div>
          <div class="tcp-readout"><small>工具尖端坐标 / mm</small><strong id="tcpPosition">—</strong></div>
        </div>
        <div class="transport">
          <div class="transport-actions"><button id="play" class="primary-button" disabled>开始制作</button><button id="reset" class="secondary-button" disabled>重置</button></div>
          <div class="timeline"><div><strong id="phaseLabel">准备中</strong><span id="timeLabel">0.0 / — s</span></div><progress id="progress" max="1" value="0" aria-label="绘制进度"></progress></div>
          <label class="speed-control">播放速度<select id="speed" aria-label="播放速度"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
        </div>
        <footer class="workspace-footer"><span id="drawnCount">已完成 0 / —</span><span>工件几何检查 · 未检查其他碰撞</span><details class="telemetry"><summary>关节数据</summary><div id="jointData"></div></details></footer>
      </section>
    </main>`;

  const element = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const playButton = element<HTMLButtonElement>('play');
  const resetButton = element<HTMLButtonElement>('reset');
  let process: ProcessId = 'pen';
  let pattern: PatternId = 'robot';
  let player: Playback | null = null;
  let worker: Worker | null = null;
  let version = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let graphicsAvailable = true;
  let workspace: Workspace;
  let speed = 1;
  let lastDrawTime = -1;
  let frameId = 0;
  let lastFrame = performance.now();

  const status = (heading: string, message: string, state: string) => {
    element('planHeading').textContent = heading;
    element('planStatus').textContent = message;
    element('stateBadge').textContent = heading;
    root.dataset.state = state;
  };
  try {
    workspace = new Workspace(element('viewport'), () => {
      graphicsAvailable = false;
      ++version;
      clearTimeout(timer);
      worker?.terminate();
      worker = null;
      player?.pause();
      playButton.disabled = true;
      resetButton.disabled = true;
      element<HTMLButtonElement>('replan').disabled = true;
      status('画面已中断', '图形上下文已丢失，请刷新页面重新建立仿真。', 'error');
    });
  } catch {
    status('三维视图不可用', '当前浏览器无法建立 WebGL 视图，请使用支持 WebGL 的浏览器。', 'error');
    element('viewport').textContent = '无法建立三维工作空间';
    return () => {};
  }

  const renderSnapshot = (snapshot: PlaybackSnapshot) => {
    workspace.show(snapshot);
    element('tcpPosition').textContent = snapshot.tip.map(v => v.toFixed(1)).join(' / ');
    element('phaseLabel').textContent = snapshot.state === 'completed' ? '制作完成' : snapshot.state === 'ready' ? '轨迹就绪' : snapshot.state === 'paused' ? '已暂停' : phaseLabels[snapshot.phase];
    element('timeLabel').textContent = `${snapshot.time.toFixed(1)} / ${player!.plan.duration.toFixed(1)} s`;
    element<HTMLProgressElement>('progress').value = snapshot.progress;
    element('drawnCount').textContent = `已绘笔画 ${snapshot.drawnStrokes} / ${player!.plan.strokeCount}`;
    playButton.textContent = snapshot.state === 'playing' ? '暂停制作' : snapshot.state === 'paused' ? '继续制作' : snapshot.state === 'completed' ? '重新制作' : '开始制作';
    element('jointData').innerHTML = jointTelemetry(snapshot.q).map(j => `<span>${j.name}<b>${j.value.toFixed(1)} ${j.unit}</b></span>`).join('');
    if (snapshot.state === 'completed') status('制作完成', '作品已保留。可以俯视检查，或重新制作。', 'completed');
    lastDrawTime = snapshot.time;
  };

  const requestPlan = () => {
    if (stopped || !graphicsAvailable) return;
    clearTimeout(timer);
    worker?.terminate();
    worker = null;
    const requestVersion = ++version;
    player = null;
    lastDrawTime = -1;
    playButton.disabled = true;
    playButton.textContent = '开始制作';
    resetButton.disabled = true;
    workspace.clearInk();
    element<HTMLProgressElement>('progress').value = 0;
    element('drawnCount').textContent = '已完成 0 / —';
    element('timeLabel').textContent = '0.0 / — s';
    element('phaseLabel').textContent = '准备中';
    element('tcpPosition').textContent = '—';
    element('maxError').textContent = '—';
    element('strokeTotal').textContent = '—';
    element('jointData').replaceChildren();
    const config = processes[process];
    element('workspaceName').textContent = `${config.name}工作站`;
    element('resultLegend').textContent = process === 'cream' ? '奶油条带' : '实际笔迹';
    element('configSummary').textContent = process === 'cream' ? `圆形蛋糕 · 圆口 ${config.radiusMm * 2} mm · 单层奶油图案` : '纸面 · 墨蓝笔迹 · 平面书写';
    try {
      const job = createCraftJob(process, pattern);
      workspace.setJob(job);
      workspace.setGuideVisible(element<HTMLInputElement>('showGuide').checked);
    } catch (error) {
      workspace.setGuideVisible(false);
      status('配置不可用', error instanceof Error ? error.message : '默认配置无效。', 'error');
      return;
    }
    status('规划中', '正在计算工具动作、工件间隙与连续关节轨迹…', 'planning');
    timer = setTimeout(() => {
      try {
        const activeWorker = new Worker(new URL('../robot/planning.worker.ts', import.meta.url), { type: 'module' });
        worker = activeWorker;
        activeWorker.onmessage = (event: MessageEvent<{ version: number; result: PlanningResult }>) => {
          if (stopped || event.data.version !== version || worker !== activeWorker) return;
          activeWorker.terminate();
          worker = null;
          const result = event.data.result;
          if (!result.ok) { status('规划未通过', result.message, 'error'); return; }
          player = new Playback(result.plan);
          player.setSpeed(speed);
          playButton.disabled = false;
          resetButton.disabled = false;
          element('maxError').textContent = `${result.plan.maxPositionErrorMm.toFixed(2)} mm`;
          element('strokeTotal').textContent = `${result.plan.strokeCount} 笔`;
          status('轨迹就绪', process === 'cream' ? '喷嘴与抬起路径已校验。奶油为几何挤出。' : '笔尖与抬笔路径已校验，可以开始制作。', 'ready');
          renderSnapshot(player.snapshot());
        };
        activeWorker.onerror = event => {
          event.preventDefault();
          if (worker !== activeWorker || requestVersion !== version) return;
          activeWorker.terminate(); worker = null;
          status('规划中断', '计算任务未能完成，请点击重新规划。', 'error');
        };
        activeWorker.postMessage({ version: requestVersion, process, pattern });
      } catch {
        status('规划不可用', '浏览器未能启动计算任务，请重新规划或刷新页面。', 'error');
      }
    }, 180);
  };

  root.querySelectorAll<HTMLButtonElement>('[data-process]').forEach(button => button.addEventListener('click', () => {
    process = button.dataset.process as ProcessId;
    root.querySelectorAll<HTMLButtonElement>('[data-process]').forEach(card => {
      const selected = card.dataset.process === process;
      card.classList.toggle('selected', selected);
      card.setAttribute('aria-pressed', String(selected));
    });
    requestPlan();
  }));
  root.querySelectorAll<HTMLButtonElement>('[data-pattern]').forEach(button => button.addEventListener('click', () => {
    pattern = button.dataset.pattern as PatternId;
    root.querySelectorAll('[data-pattern]').forEach(card => {
      const selected = (card as HTMLElement).dataset.pattern === pattern;
      card.classList.toggle('selected', selected);
      card.setAttribute('aria-pressed', String(selected));
    });
    element('patternDescription').textContent = patterns[pattern].description;
    requestPlan();
  }));
  playButton.addEventListener('click', () => {
    if (!player) return;
    if (player.snapshot().state === 'playing') {
      player.pause(); status('已暂停', '当前作品和位置已保留，点击继续制作。', 'paused');
    } else {
      player.play(); status('制作中', '机械臂正在沿已校验的轨迹制作。', 'playing'); lastFrame = performance.now();
    }
    renderSnapshot(player.snapshot());
  });
  resetButton.addEventListener('click', () => {
    if (!player) return;
    player.reset(); renderSnapshot(player.snapshot());
    status('轨迹就绪', '作品已清空，机械臂回到首个目标上方。', 'ready');
  });
  element<HTMLSelectElement>('speed').addEventListener('change', event => {
    speed = Number((event.target as HTMLSelectElement).value);
    player?.setSpeed(speed);
  });
  element('replan').addEventListener('click', requestPlan);
  element('topView').addEventListener('click', () => workspace.topView());
  element('resetView').addEventListener('click', () => workspace.resetView());
  element('showRobot').addEventListener('change', event => workspace.setRobotVisible((event.target as HTMLInputElement).checked));
  element('showGuide').addEventListener('change', event => workspace.setGuideVisible((event.target as HTMLInputElement).checked));
  element('showAxes').addEventListener('change', event => workspace.setAxesVisible((event.target as HTMLInputElement).checked));

  const visibilityChanged = () => {
    lastFrame = performance.now();
    if (document.hidden && player?.snapshot().state === 'playing') {
      player.pause(); renderSnapshot(player.snapshot());
      status('已暂停', '离开页面时已自动暂停，可继续制作。', 'paused');
    }
  };
  document.addEventListener('visibilitychange', visibilityChanged);
  const animate = (now: number) => {
    if (stopped || !graphicsAvailable) return;
    const seconds = (now - lastFrame) / 1000;
    lastFrame = now;
    if (player && !document.hidden) {
      player.advance(seconds);
      const snapshot = player.snapshot();
      if (snapshot.time !== lastDrawTime) renderSnapshot(snapshot);
    }
    workspace.render();
    frameId = requestAnimationFrame(animate);
  };
  requestPlan();
  frameId = requestAnimationFrame(animate);
  return () => {
    stopped = true; ++version; clearTimeout(timer); worker?.terminate();
    cancelAnimationFrame(frameId);
    document.removeEventListener('visibilitychange', visibilityChanged);
    workspace.dispose();
  };
}
