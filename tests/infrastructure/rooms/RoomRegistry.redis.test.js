const { RoomRegistry } = require('../../../src/infrastructure/rooms/RoomRegistry');
const { RedisRoomStore } = require('../../../src/infrastructure/rooms/RedisRoomStore');

let GenericContainer;
let createClient;
let skipReason = null;

try {
  ({ GenericContainer } = require('testcontainers'));
} catch (error) {
  skipReason = `testcontainers module unavailable: ${error.message}`;
}

if (!skipReason) {
  try {
    ({ createClient } = require('redis'));
  } catch (error) {
    skipReason = `redis client module unavailable: ${error.message}`;
  }
}

const describeOrSkip = skipReason ? describe.skip : describe;

if (skipReason) {
  // eslint-disable-next-line no-console
  console.warn(`Skipping RoomRegistry Redis integration tests: ${skipReason}`);
}

const TEST_TIMEOUT_MS = 120000;
if (!skipReason) {
  jest.setTimeout(TEST_TIMEOUT_MS);
}

describeOrSkip('RoomRegistry with Redis store (integration)', () => {
  const ROOM_PREFIX = 'itest-room:';
  const SOCKET_KEY = 'itest-socket-room';
  const INDEX_KEY = 'itest-room-index';

  let container;
  let redisClient;
  let roomRegistry;

  beforeAll(async () => {
    container = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start();
    const host = container.getHost();
    const port = container.getMappedPort(6379);
    redisClient = createClient({ url: `redis://${host}:${port}` });
    redisClient.on('error', (error) => {
      // eslint-disable-next-line no-console
      console.error('Redis test client error', error);
    });
    await redisClient.connect();
  });

  afterAll(async () => {
    if (redisClient) {
      await redisClient.quit();
    }
    if (container) {
      await container.stop({ timeout: 1000 });
    }
  });

  beforeEach(() => {
    const store = new RedisRoomStore(redisClient, {
      roomKeyPrefix: ROOM_PREFIX,
      socketRoomKey: SOCKET_KEY,
      roomIndexKey: INDEX_KEY,
      roomTtlSeconds: 60,
    });
    roomRegistry = new RoomRegistry({ storageAdapter: store });
  });

  afterEach(async () => {
    if (redisClient) {
      await redisClient.flushAll();
    }
  });

  test('persists room lifecycle and cleans up when empty', async () => {
    const room = roomRegistry.getOrCreate('Integration');
    const host = room.game.addPlayer({ socketId: 'sock-1', name: 'Host' });
    roomRegistry.setSocketRoom('sock-1', room.id);

    await roomRegistry.waitForPersistence();

    const key = `${ROOM_PREFIX}integration`;
    const serialized = await redisClient.get(key);
    expect(serialized).not.toBeNull();

    const removal = roomRegistry.removeSocket('sock-1');
    expect(removal.roomId).toBe('integration');
    expect(removal.removedPlayer.id).toBe(host.id);

    await roomRegistry.waitForPersistence();

    expect(await redisClient.get(key)).toBeNull();
    expect(await redisClient.hGet(SOCKET_KEY, 'sock-1')).toBeNull();
  });

  test('listActiveRooms reflects persisted rooms', async () => {
    const first = roomRegistry.getOrCreate('Alpha');
    roomRegistry.getOrCreate('Beta');
    first.game.addPlayer({ socketId: 'socket-alpha', name: 'Alice' });

    await roomRegistry.waitForPersistence();

    const rooms = roomRegistry.listActiveRooms();
    expect(rooms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'alpha', players: 1 }),
        expect.objectContaining({ id: 'beta', players: 0 }),
      ]),
    );

    const indexMembers = await redisClient.zRange(INDEX_KEY, 0, -1);
    expect(indexMembers).toEqual(expect.arrayContaining(['alpha', 'beta']));
  });
});
