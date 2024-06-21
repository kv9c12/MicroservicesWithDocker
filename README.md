Microservices with Kafka and Docker

This repository contains two microservices: OrderService and InventoryService, which communicate with each other using Apache Kafka. Below are the instructions to set up and run these services along with testing instructions



OrderService

Running Tests
1. Navigate to order-service directory:
    > cd order-service
2. Install Dependencies:
    > npm install
3. Run Tests:
    > npm test

Building Docker Image
1. Build Docker Image:
    > docker build -t order-service .
2. Run Docker Container:
    > docker run -d --name order-service -p 3000:3000 order-service
3. Access APIs:
    You can now access the OrderService APIs using http://localhost:3000.


InventoryService

Running Tests
1. Navigate to inventory-service directory:
    > cd ../inventory-service
2. Install Dependencies:
    > npm install
3. Run Tests:
    > npm test
 
Building Docker Image
1. Build Docker Image:
    > docker build -t inventory-service .
2. Run Docker Container:
    > docker run -d --name inventory-service -p 4000:4000 inventory-service
3. Access APIs:
    You can now access the InventoryService APIs using http://localhost:4000.



API Curl

Success:
curl --location 'http://localhost:3000/order' \
--header 'Content-Type: application/json' \
--data '{"item":"apple","quantity":40}'

Failure:
curl --location 'http://localhost:3000/order' \
--header 'Content-Type: application/json' \
--data '{"item":"apple","quantity":1000}'