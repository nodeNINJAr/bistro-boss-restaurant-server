
const express = require('express');
require('dotenv').config()
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');


//middleware
app.use(cors())
app.use(express.json());



// mongo uri
const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.USER_PASS}@cluster0.pm9ea.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();


const database = client.db('bistro-boss');
const dishesCollection = database.collection('dishes');
const reviewsCollection = database.collection('reviews ');

// get all dish data
app.get('/dishes', async(req,res)=>{
    const result = await dishesCollection.find().toArray();
    res.status(200).send(result)
})

// get all reviews data
app.get('/reviews', async(req,res)=>{
    const result = await reviewsCollection.find().toArray();
    res.status(200).send(result)
})















    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res)=>{
    res.status(200).send('Bistro boss server running')
})
app.listen(port, ()=>{
    console.log(`server running on the port ${port}`)
})