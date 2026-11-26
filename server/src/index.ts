import { createFighterJetServer } from './server';

const server = createFighterJetServer();
const port = Number(process.env.PORT ?? 3001);

server
  .listen(port)
  .then((actualPort) => {
    console.log(`FighterJet server listening on http://localhost:${actualPort}`);
  })
  .catch((error: unknown) => {
    console.error('Failed to start FighterJet server:', error);
    process.exitCode = 1;
  });

const shutdown = () => {
  void server.close().finally(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
