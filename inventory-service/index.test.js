// inventory-service/index.test.js
const { Kafka } = require('kafkajs');
const mysql = require('mysql2/promise');

jest.mock('mysql2/promise');
jest.mock('kafkajs');

const dbConfig = {
  host: 'mysql',
  user: 'user',
  password: 'password',
  database: 'inventory_db'
};

const kafka = new Kafka({
  clientId: 'inventory-service',
  brokers: ['kafka:9092']
});

const consumer = {
  connect: jest.fn(),
  subscribe: jest.fn(),
  run: jest.fn()
};

Kafka.mockImplementation(() => ({
  consumer: () => consumer
}));

const mockConnection = {
  execute: jest.fn()
};

mysql.createConnection.mockResolvedValue(mockConnection);

const run = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: 'orders', fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const order = JSON.parse(message.value.toString());
      const { item, quantity } = order;

      const connection = await mysql.createConnection(dbConfig);

      const [rows] = await connection.execute('SELECT quantity FROM inventory WHERE item = ?', [item]);

      if (rows.length === 0) {
        console.error(`Item not found: ${item}`);
        return;
      }

      const availableQuantity = rows[0].quantity;

      if (availableQuantity < quantity) {
        console.error(`Insufficient inventory for ${item}. Available: ${availableQuantity}, Requested: ${quantity}`);
        return;
      }

      await connection.execute('UPDATE inventory SET quantity = quantity - ? WHERE item = ?', [quantity, item]);

      console.log(`Order processed: ${JSON.stringify(order)}`);
      console.log(`Updated inventory for ${item}: ${availableQuantity - quantity}`);
    }
  });
};

describe('InventoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  test('should handle order processing successfully', async () => {
    mockConnection.execute
      .mockResolvedValueOnce([[{ quantity: 100 }]])
      .mockResolvedValueOnce([[], []]);

    const message = {
      value: JSON.stringify({ item: 'apple', quantity: 10 })
    };

    await run();
    await consumer.run.mock.calls[0][0].eachMessage({ topic: 'orders', partition: 0, message });

    expect(mysql.createConnection).toHaveBeenCalledWith(dbConfig);
    expect(mockConnection.execute).toHaveBeenCalledWith('SELECT quantity FROM inventory WHERE item = ?', ['apple']);
    expect(mockConnection.execute).toHaveBeenCalledWith('UPDATE inventory SET quantity = quantity - ? WHERE item = ?', [10, 'apple']);
    expect(console.log).toHaveBeenCalledWith('Order processed: {"item":"apple","quantity":10}');
    expect(console.log).toHaveBeenCalledWith('Updated inventory for apple: 90');
  });

  test('should handle item not found', async () => {
    mockConnection.execute.mockResolvedValueOnce([[]]);

    const message = {
      value: JSON.stringify({ item: 'unknown', quantity: 10 })
    };

    await run();
    await consumer.run.mock.calls[0][0].eachMessage({ topic: 'orders', partition: 0, message });

    expect(console.error).toHaveBeenCalledWith('Item not found: unknown');
  });

  test('should handle insufficient inventory', async () => {
    mockConnection.execute.mockResolvedValueOnce([[{ quantity: 5 }]]);

    const message = {
      value: JSON.stringify({ item: 'apple', quantity: 10 })
    };

    await run();
    await consumer.run.mock.calls[0][0].eachMessage({ topic: 'orders', partition: 0, message });

    expect(console.error).toHaveBeenCalledWith('Insufficient inventory for apple. Available: 5, Requested: 10');
  });
});
