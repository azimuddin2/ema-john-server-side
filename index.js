const express = require('express');
const cors = require('cors');
const SSLCommerzPayment = require('sslcommerz-lts');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASSWORD;
const is_live = false //true for live, false for sandbox

// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.debhwjz.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        const productCollection = client.db('emaJohn').collection('product');
        const orderCollection = client.db('emaJohn').collection('orders');

        // product related api
        app.get('/productCount', async (req, res) => {
            const result = await productCollection.estimatedDocumentCount();
            res.send({ productCount: result });
        });

        app.get('/product', async (req, res) => {
            const page = parseInt(req.query.page) || 0;
            const size = parseInt(req.query.size) || 9;
            const skip = page * size;

            let cursor;
            if (page || size) {
                cursor = productCollection.find();
            }
            const result = await cursor.skip(skip).limit(size).toArray();
            res.send(result);
        });


        // use post to get products by ids
        app.post('/productByKeys', async (req, res) => {
            const keys = req.body;
            const ids = keys.map(id => ObjectId(id));
            const query = { _id: { $in: ids } }
            const cursor = productCollection.find(query);
            const products = await cursor.toArray();
            res.send(products);
        });


        // orders related api
        app.post('/order', async (req, res) => {
            const order = req.body;
            const { productPrice, name, phone, email, currency, postCode, address } = order;
            const transactionId = new ObjectId().toString();

            const data = {
                total_amount: productPrice,
                currency: currency,
                tran_id: transactionId, // use unique tran_id for each api call
                success_url: `${process.env.SERVER_URL}/payment/success?transactionId=${transactionId}`,
                fail_url: `${process.env.SERVER_URL}/payment/fail?transactionId=${transactionId}`,
                cancel_url: 'http://localhost:3030/cancel',
                ipn_url: 'http://localhost:3030/ipn',
                shipping_method: 'Courier',
                product_name: 'Computer.',
                product_category: 'Electronic',
                product_profile: 'general',
                cus_name: name,
                cus_email: email,
                cus_add1: address,
                cus_add2: 'Dhaka',
                cus_city: 'Dhaka',
                cus_state: 'Dhaka',
                cus_postcode: '1000',
                cus_country: 'Bangladesh',
                cus_phone: phone,
                cus_fax: '01711111111',
                ship_name: 'Customer Name',
                ship_add1: 'Dhaka',
                ship_add2: 'Dhaka',
                ship_city: 'Dhaka',
                ship_state: 'Dhaka',
                ship_postcode: postCode,
                ship_country: 'Bangladesh',
            };

            const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
            sslcz.init(data).then(apiResponse => {
                // Redirect the user to payment gateway
                let GatewayPageURL = apiResponse.GatewayPageURL;
                orderCollection.insertOne({
                    ...order,
                    transactionId,
                    paid: false,
                })
                res.send({ url: GatewayPageURL });
            });
        });

        app.post('/payment/success', async (req, res) => {
            const { transactionId } = req.query;

            if (!transactionId) {
                return res.redirect(`${process.env.CLIENT_URL}/payment/fail`)
            }

            const updatedDoc = {
                $set: {
                    paid: true,
                    paidAt: new Date()
                }
            }

            const result = await orderCollection.updateOne({ transactionId }, updatedDoc);
            if (result.modifiedCount > 0) {
                res.redirect(`${process.env.CLIENT_URL}/payment/success?transactionId=${transactionId}`)
            }
        });

        app.post('/payment/fail', async (req, res) => {
            const { transactionId } = req.query;

            if (!transactionId) {
                return res.redirect(`${process.env.CLIENT_URL}/payment/fail`);
            }

            const result = await orderCollection.deleteOne({ transactionId });
            if (result.deletedCount) {
                res.redirect(`${process.env.CLIENT_URL}/payment/fail`);
            }
        });

        app.get('/order/by-transaction-id/:id', async (req, res) => {
            const { id } = req.params;
            const order = await orderCollection.findOne({ transactionId: id });
            res.send(order);
        });


    }
    finally {

    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Ema john server running!!');
})

app.listen(port, () => {
    console.log('ema john app listing on port', port);
})