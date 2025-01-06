
const express = require('express');
require('dotenv').config()
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');



//middleware
app.use(cors(
  {
    origin: ['http://localhost:5173'],
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type']
  }
))
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
    // await client.connect();


const database = client.db('bistro-boss');
const dishesCollection = database.collection('dishes');
const reviewsCollection = database.collection('reviews ');
const cartDishesCollection = database.collection('cart');
const userCollection = database.collection('users')



// token verify
const verifyToken = (req,res,next) =>{
    if(!req.headers.authorization){
      return res.status(401).send({message:"Unauthorized"})
    }
  
    const token = req.headers.authorization.split(" ")[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) =>{
       if(err){
        return res.status(401).send({message:"Unauthorized"}) 
       }
       req.user = decoded
       next();
    })
}
// admin verify
const verifyAdmin = async(req,res,next)=>{
     

    const email = req.user.userinfo;
    const query = {email:email, role:"admin"};
    const admin = await userCollection.findOne(query);
 
     if(!admin){
       return res.status(403).send({message:"forbidden access"})  
     }
   next()
}


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
// get all cart data
app.get('/cart', async(req,res)=>{
    const userEmail = req.query.userEmail;
    const query = {userEmail}
    const result = await cartDishesCollection.find(query).toArray();
    res.status(200).send(result)
})

// get all users
app.get('/users',verifyToken,verifyAdmin, async(req,res)=>{
    const result = await userCollection.find().toArray();
    res.send(result)
})

// admin check
app.get('/users/admin/:email',verifyToken, async(req, res)=>{
     const email = req.params.email;
    
     if(email !== req.user.userinfo){
       return res.status(403).send({message:"Forvidden Access"})  
     }
     const query = {email:email}
     const user = await userCollection.findOne(query);
     let admin = false;

     if(user){
         admin = user?.role === "admin"
     }
     res.send({admin});
     
})



// add to cart
app.post('/addTocart', async (req,res)=>{
    const data = req.body;
    const result = await cartDishesCollection.insertOne(data);
    res.status(200).send(result)
})

// set user on data base
app.post('/addusers', async(req ,res)=>{
   const userData = req.body;
   const query = {email:userData?.email}

  const isExist = await userCollection.findOne(query)
    // 
    if(isExist){
       return res.send({messsage:"user already available"})
    }
   const result = await userCollection.insertOne(userData);
   res.status(200).send(result);
} )

// user role update
app.patch('/users/admin/:id', async(req,res)=>{
  // 
    const id = req.params.id;
    const filter = { _id: new ObjectId(id)};
    const upadateAdmin = {
        $set : {
            role : "admin"
        }
    }
    const result = await userCollection.updateOne(filter , upadateAdmin);
    res.status(200).send(result)
})



 // item delete from cart
app.delete('/cart/:id' , async(req,res)=>{
  const id = req.params.id;
  const query = {_id: new ObjectId(id)};
  const result = await cartDishesCollection.deleteOne(query);
  res.status(200).send(result)
})

// delete user
app.delete('/users/:id', async(req,res)=>{
   const id = req.params.id;
   const query = {_id: new ObjectId(id)};
   const result = await userCollection.deleteOne(query);
   res.send(result)
})

//jwt sign in
app.post("/jwt", async(req, res ) =>{
  const payload = req.body;
   const token = jwt.sign(payload, process.env.JWT_SECRET , {expiresIn:"5h"});
   res.send(token)

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