import { patterns, type PatternId } from '../design/patterns';
import { createPenJob, defaultPenSettings, type PenSettings } from '../process/pen';
import { jointTelemetry, type PlanningResult } from '../robot/planner';
import { Playback, type PlaybackSnapshot } from '../simulation/playback';
import { Workspace } from '../rendering/workspace';

const icon = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M8 24V16l8-8 8 8v8M8 16h16M16 8V4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="17" r="3" fill="currentColor"/></svg>`;
const phaseLabels = { travel: '空行程', lower: '落笔', draw: '绘制中', lift: '抬笔' };

function patternIcon(id: PatternId): string {
  const paths = patterns[id].strokes.map(stroke => `<polyline points="${stroke.map(([x, y]) => `${x * 85},${-y * 85}`).join(' ')}"/>`).join('');
  return `<svg viewBox="-50 -50 100 100" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

export function mountWorkstation(root: HTMLElement): () => void {
  root.innerHTML = `
    <header class="topbar">
      <a class="brand" href="./" aria-label="RobotCraft Studio 首页"><span class="brand-mark">${icon}</span><span>RobotCraft <b>Studio</b><small>机器人创作工作站</small></span></a>
      <div class="workspace-label"><span class="status-dot"></span>笔绘工作站<span class="version-tag">基础仿真</span></div>
      <span class="top-note">从一个图案，到一件作品。</span>
    </header>
    <main class="studio">
      <aside class="sidebar" aria-label="创作参数">
        <section class="control-section"><h2><span class="step-number">01</span>末端工具</h2>
          <div class="tool-card"><span class="pen-symbol">✎</span><span><strong>绘图笔</strong><small>平面书写与线条绘制</small></span><span class="selected-check">✓</span></div>
          <p class="subtle-note">钻孔与裱花将在后续阶段加入</p>
        </section>
        <section class="control-section"><h2><span class="step-number">02</span>选择图案</h2>
          <div class="pattern-grid">${Object.values(patterns).map(p => `<button class="pattern-card${p.id === defaultPenSettings.pattern ? ' selected' : ''}" data-pattern="${p.id}" aria-pressed="${p.id === defaultPenSettings.pattern}" title="${p.description}">${patternIcon(p.id)}<span>${p.name}</span></button>`).join('')}</div>
          <p id="patternDescription" class="subtle-note">${patterns[defaultPenSettings.pattern].description}</p>
          <label class="range-label" for="sizeMm"><span>图案宽度</span><output id="sizeMmValue">44 mm</output></label>
          <input id="sizeMm" data-setting="sizeMm" type="range" min="20" max="60" step="1" value="44"/>
          <div class="input-pair">
            <label>中心 X <span>mm</span><input id="centerXmm" data-setting="centerXmm" type="number" min="80" max="140" step="1" value="110" required/></label>
            <label>中心 Y <span>mm</span><input id="centerYmm" data-setting="centerYmm" type="number" min="-20" max="20" step="1" value="0" required/></label>
          </div>
        </section>
        <section class="control-section"><h2><span class="step-number">03</span>绘制设置</h2>
          <label class="range-label" for="drawSpeedMmS"><span>目标绘制速度</span><output id="drawSpeedMmSValue">18 mm/s</output></label>
          <input id="drawSpeedMmS" data-setting="drawSpeedMmS" type="range" min="5" max="60" step="1" value="18"/>
          <div class="color-row"><span>笔迹颜色</span><div class="swatches">${[['#24465f', '墨蓝'], ['#c0643b', '赭橙'], ['#527961', '森林绿']].map(([color, label], i) => `<button class="swatch" style="--swatch:${color}" data-color="${color}" aria-label="${label}" aria-pressed="${i === 0}"></button>`).join('')}</div></div>
        </section>
        <div class="plan-card"><div><span class="status-dot"></span><strong id="planHeading">准备轨迹</strong><button id="replan" class="text-button" title="重新生成轨迹">重新规划 ↗</button></div><p id="planStatus" role="status">正在建立笔尖与纸面的关系…</p><dl><div><dt>笔尖最大偏差</dt><dd id="maxError">—</dd></div><div><dt>笔画</dt><dd id="strokeTotal">—</dd></div></dl></div>
      </aside>
      <section class="workarea" aria-label="仿真工作站">
        <div class="stage-toolbar"><div><span class="eyebrow">LIVE WORKSPACE</span><strong>三维工作空间</strong></div><div class="view-actions"><button id="topView">俯视纸面</button><button id="resetView">恢复视角</button></div></div>
        <div class="stage">
          <div id="viewport"></div>
          <div class="stage-badge"><span class="status-dot"></span><span id="stateBadge">规划中</span></div>
          <div class="view-options"><label><input id="showRobot" type="checkbox" checked/>机械臂</label><label><input id="showGuide" type="checkbox" checked/>目标辅助线</label><label><input id="showAxes" type="checkbox"/>笔尖坐标轴</label></div>
          <div class="stage-caption"><span><i class="legend-line"></i>实际笔迹</span><span><i class="legend-line dashed"></i>目标路径</span><span>拖动旋转 · 滚轮缩放</span></div>
          <div class="tcp-readout"><small>笔尖坐标 / mm</small><strong id="tcpPosition">—</strong></div>
        </div>
        <div class="transport">
          <div class="transport-actions"><button id="play" class="primary-button" disabled>开始绘制</button><button id="reset" class="secondary-button" disabled>重置</button></div>
          <div class="timeline"><div><strong id="phaseLabel">准备中</strong><span id="timeLabel">0.0 / — s</span></div><progress id="progress" max="1" value="0" aria-label="绘制进度"></progress></div>
          <label class="speed-control">播放速度<select id="speed" aria-label="播放速度"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
        </div>
        <footer class="workspace-footer"><span id="drawnCount">已绘笔画 0 / —</span><span>画板几何检查 · 未检查其他碰撞</span><details class="telemetry"><summary>关节数据</summary><div id="jointData"></div></details></footer>
      </section>
    </main>`;

  const element = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const playButton = element<HTMLButtonElement>('play');
  const resetButton = element<HTMLButtonElement>('reset');
  const settingsInputs = [...root.querySelectorAll<HTMLInputElement>('[data-setting]')];
  let pattern: PatternId = defaultPenSettings.pattern;
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
    element('phaseLabel').textContent = snapshot.state === 'completed' ? '绘制完成' : snapshot.state === 'ready' ? '轨迹就绪' : snapshot.state === 'paused' ? '已暂停' : phaseLabels[snapshot.phase];
    element('timeLabel').textContent = `${snapshot.time.toFixed(1)} / ${player!.plan.duration.toFixed(1)} s`;
    element<HTMLProgressElement>('progress').value = snapshot.progress;
    element('drawnCount').textContent = `已绘笔画 ${snapshot.drawnStrokes} / ${player!.plan.strokeCount}`;
    playButton.textContent = snapshot.state === 'playing' ? '暂停绘制' : snapshot.state === 'paused' ? '继续绘制' : snapshot.state === 'completed' ? '重新绘制' : '开始绘制';
    element('jointData').innerHTML = jointTelemetry(snapshot.q).map(j => `<span>${j.name}<b>${j.value.toFixed(1)} ${j.unit}</b></span>`).join('');
    if (snapshot.state === 'completed') status('绘制完成', '作品已保留。可以俯视检查笔迹，或重新绘制。', 'completed');
    lastDrawTime = snapshot.time;
  };

  const readSettings = (): PenSettings => {
    const settings = { ...defaultPenSettings, pattern };
    for (const input of settingsInputs) {
      if (input.value.trim() === '' || !input.checkValidity()) throw new Error('请检查参数范围，并补全数字输入。');
      settings[input.dataset.setting as keyof Omit<PenSettings, 'pattern'>] = Number(input.value);
    }
    return settings;
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
    playButton.textContent = '开始绘制';
    resetButton.disabled = true;
    workspace.clearInk();
    element<HTMLProgressElement>('progress').value = 0;
    element('drawnCount').textContent = '已绘笔画 0 / —';
    element('timeLabel').textContent = '0.0 / — s';
    element('phaseLabel').textContent = '准备中';
    element('tcpPosition').textContent = '—';
    element('maxError').textContent = '—';
    element('strokeTotal').textContent = '—';
    element('jointData').replaceChildren();
    let settings: PenSettings;
    try {
      settings = readSettings();
      const job = createPenJob(settings);
      workspace.setJob(job);
      workspace.setGuideVisible(element<HTMLInputElement>('showGuide').checked);
    } catch (error) {
      workspace.setGuideVisible(false);
      status('请检查参数', error instanceof Error ? error.message : '参数无效。', 'error');
      return;
    }
    status('规划中', '正在计算工具姿态、抬笔动作与连续关节轨迹…', 'planning');
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
          status('轨迹就绪', '笔尖与抬笔路径已校验，可以开始绘制。', 'ready');
          renderSnapshot(player.snapshot());
        };
        activeWorker.onerror = event => {
          event.preventDefault();
          if (worker !== activeWorker || requestVersion !== version) return;
          activeWorker.terminate(); worker = null;
          status('规划中断', '计算任务未能完成，请点击重新规划。', 'error');
        };
        activeWorker.postMessage({ version: requestVersion, settings });
      } catch {
        status('规划不可用', '浏览器未能启动计算任务，请重新规划或刷新页面。', 'error');
      }
    }, 180);
  };

  settingsInputs.forEach(input => input.addEventListener('input', () => {
    element('sizeMmValue').textContent = `${element<HTMLInputElement>('sizeMm').value} mm`;
    element('drawSpeedMmSValue').textContent = `${element<HTMLInputElement>('drawSpeedMmS').value} mm/s`;
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
  root.querySelectorAll<HTMLButtonElement>('[data-color]').forEach(button => button.addEventListener('click', () => {
    workspace.setInkColor(button.dataset.color!);
    root.querySelectorAll('[data-color]').forEach(swatch => swatch.setAttribute('aria-pressed', String(swatch === button)));
  }));
  playButton.addEventListener('click', () => {
    if (!player) return;
    if (player.snapshot().state === 'playing') {
      player.pause(); status('已暂停', '当前笔迹和位置已保留，点击继续绘制。', 'paused');
    } else {
      player.play(); status('绘制中', '机械臂正在沿已校验的轨迹绘制。', 'playing'); lastFrame = performance.now();
    }
    renderSnapshot(player.snapshot());
  });
  resetButton.addEventListener('click', () => {
    if (!player) return;
    player.reset(); renderSnapshot(player.snapshot());
    status('轨迹就绪', '笔迹已清空，机械臂回到起笔上方。', 'ready');
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
      status('已暂停', '离开页面时已自动暂停，可继续绘制。', 'paused');
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
