import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { PlayerId, Snapshot } from '@fighterjet/shared';
import { FighterJetClient } from './game/client';
import { store } from './game/store';

function playerLabel(id: PlayerId): string {
  return id === 'p1' ? 'P1' : 'P2';
}

function PlayerBadges({
  snapshot,
  myId,
}: {
  snapshot: Snapshot;
  myId: PlayerId | null;
}) {
  return (
    <div className="player-badges">
      {snapshot.players.map((player) => (
        <span
          key={player.id}
          className={[
            'badge',
            player.id,
            player.connected ? 'online' : 'offline',
            player.id === myId ? 'me' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {playerLabel(player.id)} {player.connected ? '在线' : '等待'}
        </span>
      ))}
    </div>
  );
}

function TopScores({ snapshot }: { snapshot: Snapshot }) {
  if (snapshot.topScores.length === 0) {
    return <p className="muted">暂无记录</p>;
  }

  return (
    <ol className="top-scores">
      {snapshot.topScores.map((entry, index) => (
        <li key={`${entry.at}-${index}`}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          <span>{entry.score}</span>
        </li>
      ))}
    </ol>
  );
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clientRef = useRef<FighterJetClient | null>(null);
  const view = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const client = new FighterJetClient(store, canvas);
    clientRef.current = client;

    return () => {
      client.destroy();
      clientRef.current = null;
    };
  }, []);

  const snapshot = view.snapshot;
  const myReady =
    view.playerId !== null &&
    snapshot !== null &&
    snapshot.ready.includes(view.playerId);
  const countdown =
    snapshot?.countdownRemainingMs != null
      ? Math.max(1, Math.ceil(snapshot.countdownRemainingMs / 1000))
      : null;
  const reconnectSeconds =
    snapshot?.reconnectRemainingMs != null
      ? Math.max(0, Math.ceil(snapshot.reconnectRemainingMs / 1000))
      : null;

  let overlay: ReactNode = null;

  if (view.status === 'full') {
    overlay = (
      <div className="overlay">
        <h1>对局已满</h1>
        <p>当前已有两名玩家，请稍后再试。</p>
        <button
          type="button"
          className="button"
          onClick={() => clientRef.current?.retry()}
        >
          重试
        </button>
      </div>
    );
  } else if (view.status === 'error') {
    overlay = (
      <div className="overlay">
        <h1>连接错误</h1>
        <p>{view.error ?? '未知错误'}</p>
        <button
          type="button"
          className="button"
          onClick={() => clientRef.current?.retry()}
        >
          重试
        </button>
      </div>
    );
  } else if (
    view.status === 'connecting' ||
    view.status === 'closed' ||
    (view.status === 'connected' && !snapshot)
  ) {
    overlay = (
      <div className="overlay">
        <h1>{view.status === 'closed' ? '连接已断开' : '连接中'}</h1>
        <p>
          {view.status === 'closed'
            ? '正在尝试重连…'
            : '正在连接服务器…'}
        </p>
        {view.status === 'closed' && (
          <button
            type="button"
            className="button"
            onClick={() => clientRef.current?.retry()}
          >
            立即重连
          </button>
        )}
      </div>
    );
  } else if (snapshot) {
    if (snapshot.phase === 'waiting') {
      overlay = (
        <div className="overlay">
          <h1>等待玩家</h1>
          <p>需要 2 名玩家才能开始</p>
          <PlayerBadges snapshot={snapshot} myId={view.playerId} />
          <p className="tagline">是兄弟，就一起打飞机！</p>
        </div>
      );
    } else if (snapshot.phase === 'countdown') {
      overlay = (
        <div className="overlay overlay-clear">
          <div className="big">{countdown ?? 3}</div>
          <p>准备</p>
        </div>
      );
    } else if (snapshot.phase === 'paused') {
      overlay = (
        <div className="overlay">
          <h1>暂停</h1>
          <p>队友断线，等待重连</p>
          <div className="big">{reconnectSeconds ?? 0}</div>
          <p className="muted">秒</p>
        </div>
      );
    } else if (snapshot.phase === 'gameover') {
      overlay = (
        <div className="overlay">
          <h1>GAME OVER</h1>
          <p className="score-final">
            SCORE {String(snapshot.score).padStart(6, '0')}
          </p>
          <TopScores snapshot={snapshot} />
          <button
            type="button"
            className="button"
            disabled={myReady}
            onClick={() => clientRef.current?.ready()}
          >
            {myReady ? '已准备，等待队友' : '再来一局'}
          </button>
        </div>
      );
    }
  }

  const showHud = snapshot !== null && snapshot.phase !== 'waiting';

  return (
    <main className="app">
      <div className="game-shell">
        <canvas
          ref={canvasRef}
          className="game-canvas"
          width={360}
          height={640}
        />

        {showHud && snapshot && (
          <div className="hud">
            <span>SCORE {String(snapshot.score).padStart(6, '0')}</span>
            <span className="lives">
              {'♥'.repeat(snapshot.lives)}
              {'♡'.repeat(Math.max(0, 3 - snapshot.lives))}
            </span>
            <span>WAVE {snapshot.wave}</span>
          </div>
        )}

        {overlay}

        {snapshot?.phase === 'playing' && (
          <p className="hint">
            <span className="desktop-hint">
              WASD / 方向键移动 · 自动开火
            </span>
            <span className="touch-hint">拖拽移动 · 自动开火</span>
          </p>
        )}
      </div>
    </main>
  );
}
