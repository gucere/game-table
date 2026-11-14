/**
 * The 3D cube, ported from the author's solver app (version_3/web/app.js): drag a sticker to turn
 * its layer, drag empty space to look around, keys U D L R F B (Shift = counter-clockwise).
 */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { t as tx } from '../../i18n';
import { COLORS, CubeModel, FACES, FACE_AXES, cross, dot, inverse, parseMove, toFacelets, type Face, type Vec } from './model';

export interface CubeResult {
  ms: number;
  moves: number;
  solver: boolean;
}

let worker: Worker | null = null;
let nextId = 1;
function solve(facelets: string): Promise<string[]> {
  worker ??= new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const w = worker!;
    const onMsg = (e: MessageEvent<{ id: number; moves?: string[]; error?: string }>) => {
      if (e.data.id !== id) return;
      w.removeEventListener('message', onMsg);
      if (e.data.moves) resolve(e.data.moves);
      else reject(new Error(e.data.error));
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ id, facelets });
  });
}

function roundedSquare(size: number, radius: number) {
  const s = size / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-s + radius, -s);
  shape.lineTo(s - radius, -s);
  shape.quadraticCurveTo(s, -s, s, -s + radius);
  shape.lineTo(s, s - radius);
  shape.quadraticCurveTo(s, s, s - radius, s);
  shape.lineTo(-s + radius, s);
  shape.quadraticCurveTo(-s, s, -s, s - radius);
  shape.lineTo(-s, -s + radius);
  shape.quadraticCurveTo(-s, -s, -s + radius, -s);
  return new THREE.ShapeGeometry(shape);
}

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`;
};

interface Api {
  turn: (name: string, ms: number) => Promise<void>;
  reset: (state: number[]) => void;
}

export default function CubeBoard({ n, onSolved }: { n: number; onSolved: (r: CubeResult) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const model = useRef(new CubeModel(n)).current;
  const state = useRef(model.solved());
  const api = useRef<Api | null>(null);
  const busy = useRef(false);
  const history = useRef<string[]>([]);
  /** Turns made by the player (undos count too) */
  const count = useRef(0);
  const startedAt = useRef<number | null>(null);
  const usedSolver = useRef(false);
  const done = useRef(false);
  const [moves, setMoves] = useState(0);
  const [now, setNow] = useState(0);
  const [phase, setPhase] = useState<'scrambling' | 'ready' | 'solving' | 'solved'>('scrambling');
  const [solverMsg, setSolverMsg] = useState('');
  const canSolve = n === 2 || n === 3;

  // A move made by the player
  const userMove = useRef<(name: string) => Promise<void>>(async () => {});
  userMove.current = async (name: string) => {
    if (busy.current || !api.current || done.current || phase === 'scrambling' || phase === 'solving') return;
    busy.current = true;
    startedAt.current ??= performance.now();
    history.current.push(name);
    count.current++;
    setMoves(count.current);
    await api.current.turn(name, 200);
    busy.current = false;
    checkSolved();
  };

  const checkSolved = () => {
    if (done.current || !model.isSolved(state.current)) return;
    done.current = true;
    const ms = startedAt.current ? performance.now() - startedAt.current : 0;
    setNow(ms);
    setPhase('solved');
    setTimeout(() => onSolved({ ms: Math.round(ms), moves: count.current, solver: usedSolver.current }), 1600);
  };

  // three.js scene
  useEffect(() => {
    const canvas = canvasRef.current!;
    const box = wrap.current!;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.enableDamping = true;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a0, 2.2));
    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(0.5, 1, 1);
    camera.add(light);
    scene.add(camera);

    const cubeGroup = new THREE.Group();
    scene.add(cubeGroup);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x101217, roughness: 0.7 });
    const stickerMaterials = COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 }));
    const bodyGeometry = new THREE.BoxGeometry(0.98, 0.98, 0.98);
    const stickerGeometry = roundedSquare(0.84, 0.12);
    const cubies: THREE.Group[] = [];
    const stickers: THREE.Mesh[] = [];
    const byKey = new Map<string, THREE.Group>();
    for (let p = 0; p < model.centers.length; p++) {
      const c = model.centers[p];
      const nr = model.normals[p];
      const piece: Vec = [c[0] - nr[0], c[1] - nr[1], c[2] - nr[2]];
      let group = byKey.get(piece.join(','));
      if (!group) {
        group = new THREE.Group();
        group.userData.piece = piece;
        group.position.set(piece[0] / 2, piece[1] / 2, piece[2] / 2);
        group.add(new THREE.Mesh(bodyGeometry, bodyMaterial));
        cubeGroup.add(group);
        byKey.set(piece.join(','), group);
        cubies.push(group);
      }
      const sticker = new THREE.Mesh(stickerGeometry, stickerMaterials[0]);
      sticker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...nr));
      sticker.position.set(nr[0] * 0.495, nr[1] * 0.495, nr[2] * 0.495);
      sticker.userData.p = p;
      group.add(sticker);
      stickers.push(sticker);
    }
    const distance = n * 3.1 + 2;
    camera.position.set(0.95, 0.8, 1.3).normalize().multiplyScalar(distance);
    controls.minDistance = n * 1.4;
    controls.maxDistance = n * 8;
    controls.update();

    const recolor = () => {
      for (let p = 0; p < stickers.length; p++) stickers[p].material = stickerMaterials[model.colorAt(state.current, p)];
    };
    recolor();

    const resize = () => {
      const w = box.clientWidth;
      const h = box.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(box);
    resize();
    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });

    // Turn the layer on screen, then update the colors
    const turn = (name: string, ms: number) => {
      if (ms <= 0) {
        state.current = model.apply(state.current, name);
        recolor();
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        const { face, turns } = parseMove(name);
        const axis = FACE_AXES[face];
        const targets = model.layerDepths(name);
        const pivot = new THREE.Group();
        cubeGroup.add(pivot);
        for (const cubie of cubies) if (targets.includes(dot(cubie.userData.piece, axis))) pivot.attach(cubie);
        const axisVector = new THREE.Vector3(...axis);
        const angle = (-Math.PI / 2) * turns;
        const duration = Math.abs(turns) === 2 ? ms * 1.4 : ms;
        const start = performance.now();
        const frame = (t0: number) => {
          const t = Math.min(1, (t0 - start) / duration);
          const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          pivot.setRotationFromAxisAngle(axisVector, angle * eased);
          if (t < 1) {
            requestAnimationFrame(frame);
            return;
          }
          for (const cubie of [...pivot.children]) {
            cubeGroup.add(cubie);
            const piece = cubie.userData.piece as Vec;
            cubie.position.set(piece[0] / 2, piece[1] / 2, piece[2] / 2);
            cubie.quaternion.identity();
          }
          cubeGroup.remove(pivot);
          state.current = model.apply(state.current, name);
          recolor();
          resolve();
        };
        requestAnimationFrame(frame);
      });
    };
    api.current = {
      turn,
      reset: (s) => {
        state.current = s;
        recolor();
      },
    };

    // Picking stickers
    const raycaster = new THREE.Raycaster();
    let drag: { p: number; x: number; y: number } | null = null;
    const pick = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = raycaster.intersectObjects(stickers, false)[0];
      return hit ? (hit.object.userData.p as number) : null;
    };
    const toScreen = (v: Vec) => {
      const p = new THREE.Vector3(...v).project(camera);
      return [p.x, -p.y];
    };
    // Which layer turn a drag on sticker p means
    const moveFromDrag = (p: number, dx: number, dy: number) => {
      const nr = model.normals[p];
      const center = model.centers[p].map((x) => x / 2) as Vec;
      const from = toScreen(center);
      const length = Math.hypot(dx, dy);
      let best: Vec = [1, 0, 0];
      let bestScore = -Infinity;
      for (const axis of [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ] as Vec[]) {
        if (dot(axis, nr) !== 0) continue;
        for (const sign of [1, -1]) {
          const t = axis.map((x) => x * sign) as Vec;
          const to = toScreen(center.map((x, i) => x + t[i] * 0.5) as Vec);
          const sx = to[0] - from[0];
          const sy = to[1] - from[1];
          const score = (sx * dx + sy * dy) / (Math.hypot(sx, sy) * length || 1);
          if (score > bestScore) {
            bestScore = score;
            best = t;
          }
        }
      }
      // Moving toward t turns the layer +90 degrees around normal x t
      const turnAxis = cross(nr, best);
      const face = FACES.find((f) => dot(FACE_AXES[f], turnAxis) === 1) as Face;
      const layer = (n - 1 - model.depth(p, FACE_AXES[face])) / 2 + 1;
      return model.layerMoveName(face, layer, false);
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const p = pick(e);
      if (p === null) return;
      controls.enabled = false;
      if (!busy.current) drag = { p, x: e.clientX, y: e.clientY };
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 12) return;
      const r = canvas.getBoundingClientRect();
      const name = moveFromDrag(drag.p, ((e.clientX - drag.x) / r.width) * 2, ((e.clientY - drag.y) / r.height) * 2);
      drag = null;
      userMove.current(name);
    };
    const onUp = () => {
      drag = null;
      controls.enabled = true;
    };
    // Capture, so we run before the camera controls and can stop them
    canvas.addEventListener('pointerdown', onDown, { capture: true });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    // Scramble on start
    let alive = true;
    (async () => {
      const scramble = model.scramble(Math.random);
      for (const m of scramble) {
        if (!alive) return;
        await turn(m, n > 4 ? 0 : 70);
      }
      if (alive) setPhase('ready');
    })();

    return () => {
      alive = false;
      api.current = null;
      ro.disconnect();
      renderer.setAnimationLoop(null);
      canvas.removeEventListener('pointerdown', onDown, { capture: true });
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      controls.dispose();
      renderer.dispose();
      bodyGeometry.dispose();
      stickerGeometry.dispose();
      bodyMaterial.dispose();
      stickerMaterials.forEach((m) => m.dispose());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard: U D L R F B, Shift for counter-clockwise
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches?.('input, select, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
      const face = e.key.toUpperCase() as Face;
      if (FACES.includes(face) && e.code === `Key${face}`) {
        e.preventDefault();
        userMove.current(face + (e.shiftKey ? "'" : ''));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Running clock
  useEffect(() => {
    if (phase !== 'ready') return;
    const id = setInterval(() => startedAt.current && setNow(performance.now() - startedAt.current), 100);
    return () => clearInterval(id);
  }, [phase]);

  const undo = async () => {
    const last = history.current.pop();
    if (!last || busy.current || !api.current || phase !== 'ready') return;
    busy.current = true;
    count.current++;
    setMoves(count.current);
    await api.current.turn(inverse(last), 200);
    busy.current = false;
  };

  const runSolver = async () => {
    if (!canSolve || busy.current || phase !== 'ready') return;
    const facelets = toFacelets(model, state.current);
    if (!facelets) return;
    usedSolver.current = true;
    setPhase('solving');
    setSolverMsg(tx('Working out a solution… (the first time takes a few seconds)'));
    try {
      busy.current = true;
      const sol = await solve(facelets);
      setSolverMsg(tx('Solution ({n} moves): {moves}', { n: sol.length, moves: sol.join(' ') }));
      for (const m of sol) {
        if (!api.current) return;
        await api.current.turn(m, 260);
      }
      history.current = [];
    } catch {
      setSolverMsg(tx('The solver could not solve this cube.'));
    } finally {
      busy.current = false;
      setPhase('ready');
      checkSolved();
    }
  };

  return (
    <div className="stack-sm center cube-game">
      <div className="info-row">
        <span className="chip">⏱ {fmt(now)}</span>
        <span className="chip">{tx('Moves: {n}', { n: moves })}</span>
        {phase === 'scrambling' && <span className="chip">{tx('Scrambling…')}</span>}
        {phase === 'solved' && <span className="chip trump-chip">{tx('Solved! 🎉')}</span>}
      </div>
      <div ref={wrap} className="cube-viewport">
        <canvas ref={canvasRef} aria-label={tx('Puzzle cube')} />
      </div>
      <div className="row center">
        <button className="btn" onClick={undo} disabled={phase !== 'ready' || moves === 0}>
          ↶ {tx('Undo')}
        </button>
        {canSolve && (
          <button className="btn" onClick={runSolver} disabled={phase !== 'ready'}>
            🧠 {tx('Solve it for me')}
          </button>
        )}
      </div>
      {solverMsg && <p className="small muted cube-solution">{solverMsg}</p>}
      <p className="small muted">{tx('Drag a sticker to turn its layer; drag the background to look around. Keys: U D L R F B (Shift turns the other way).')}</p>
    </div>
  );
}
