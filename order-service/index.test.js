const request = require('supertest');
const express = require('express');
const mysql = require('mysql2/promise');
const { Kafka } = require('kafkajs');

jest.mock('mysql2/promise');
jest.mock('kafkajs');

const app = express();
app.use(express.json());

const producer = {
  connect: jest.fn(),
  send: jest.fn(),
  disconnect: jest.fn()
};

const dbConfig = {
  host: 'mysql',
  user: 'user',
  password: 'password',
  database: 'inventory_db'
};

Kafka.mockImplementation(() => ({
  producer: () => producer
}));

app.post('/order', async (req, res) => {
  const { item, quantity } = req.body;

  if (!item || !quantity) {
    return res.status(400).send('Item and quantity are required');
  }

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT quantity FROM inventory WHERE item = ?', [item]);

    if (rows.length === 0) {
      return res.status(404).send('Item not found');
    }

    const availableQuantity = rows[0].quantity;

    if (availableQuantity < quantity) {
      return res.status(400).send('Insufficient inventory');
    }

    await producer.connect();
    await producer.send({
      topic: 'orders',
      messages: [
        { value: JSON.stringify({ item, quantity }) }
      ]
    });
    await producer.disconnect();

    res.send('Order placed successfully');
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).send('Internal server error');
  }
});

describe('OrderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return 400 if item or quantity is missing', async () => {
    const response = await request(app)
      .post('/order')
      .send({ item: 'apple' });

    expect(response.status).toBe(400);
    expect(response.text).toBe('Item and quantity are required');
  });

  test('should return 404 if item is not found', async () => {
    mysql.createConnection.mockResolvedValueOnce({
      execute: jest.fn().mockResolvedValueOnce([[], []])
    });

    const response = await request(app)
      .post('/order')
      .send({ item: 'unknown', quantity: 10 });

    expect(response.status).toBe(404);
    expect(response.text).toBe('Item not found');
  });

  test('should return 400 if insufficient inventory', async () => {
    mysql.createConnection.mockResolvedValueOnce({
      execute: jest.fn().mockResolvedValueOnce([[{ quantity: 5 }], []])
    });

    const response = await request(app)
      .post('/order')
      .send({ item: 'apple', quantity: 10 });

    expect(response.status).toBe(400);
    expect(response.text).toBe('Insufficient inventory');
  });

  test('should place order successfully', async () => {
    mysql.createConnection.mockResolvedValueOnce({
      execute: jest.fn().mockResolvedValueOnce([[{ quantity: 100 }], []])
    });

    producer.connect.mockResolvedValueOnce();
    producer.send.mockResolvedValueOnce();
    producer.disconnect.mockResolvedValueOnce();

    const response = await request(app)
      .post('/order')
      .send({ item: 'apple', quantity: 10 });

    expect(response.status).toBe(200);
    expect(response.text).toBe('Order placed successfully');
  });

  test('should handle internal server error', async () => {
    mysql.createConnection.mockRejectedValueOnce(new Error('Database error'));

    const response = await request(app)
      .post('/order')
      .send({ item: 'apple', quantity: 10 });

    expect(response.status).toBe(500);
    expect(response.text).toBe('Internal server error');
  });
});
