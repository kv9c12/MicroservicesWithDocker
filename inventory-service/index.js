const { Kafka } = require('kafkajs');
const mysql = require('mysql2/promise');

const kafka = new Kafka({
  clientId: 'inventory-service',
  brokers: ['kafka:9092']
});

const consumer = kafka.consumer({ groupId: 'inventory-group' });

const dbConfig = {
  host: 'mysql',
  user: 'user',
  password: 'password',
  database: 'inventory_db'
};

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

run().catch(console.error);
