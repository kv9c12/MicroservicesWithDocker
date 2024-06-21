const express = require('express');
const { Kafka } = require('kafkajs');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());

const kafka = new Kafka({
  clientId: 'order-service',
  brokers: ['kafka:9092']
});

const producer = kafka.producer();

const dbConfig = {
  host: 'mysql',
  user: 'user',
  password: 'password',
  database: 'inventory_db'
};

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

app.listen(3000, () => {
  console.log('Order service listening on port 3000');
});
