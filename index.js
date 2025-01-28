
const express = require('express');
require('dotenv').config()
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
// Sign in to see your own test API key embedded in code samples.
const stripe = require("stripe")(process.env.STRIPE_SECRET);
// 
const formData = require('form-data');
const Mailgun = require('mailgun.js');
const { default: axios } = require('axios');
const mailgun = new Mailgun(formData);
const mg = mailgun.client({username: 'api', key:process.env.MAILGUN_API_KEY});


//middleware
app.use(cors(
  {
    origin: ['http://localhost:5173','https://bristro-boss-bae23.web.app','https://bristro-boss-bae23.firebaseapp.com'],
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type']
  }
))
app.use(express.json());
app.use(express.urlencoded());//important for ssl commerce



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
const transactionCollection = database.collection('transaction');
const userCollection = database.collection('users')



// Store ID: nexus6796a83e66816
// Store Password (API/Secret Key): nexus6796a83e66816@ssl


// Merchant Panel URL: https://sandbox.sslcommerz.com/manage/ (Credential as you inputted in the time of registration)


 
// Store name: testnexusts1w
// Registered URL: https://bristro-boss-bae23.web.app
// Session API to generate transaction: https://sandbox.sslcommerz.com/gwprocess/v3/api.php
// Validation API: https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php?wsdl
// Validation API (Web Service) name: https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php







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
app.get('/cart',verifyToken, async(req,res)=>{
    const userEmail = req.query.userEmail;
    const query = {userEmail}
    const result = await cartDishesCollection.find(query).toArray();
    res.status(200).send(result)
})

// get payment history
app.get('/payment-history/:email' ,verifyToken, async(req,res)=>{
  const email = req.params.email;
  const userEmail =   req.user.userinfo;
  if(email !== userEmail){
     return res.status(403).send({message:"Forbidden Access"})
  }
  const filter = {email}
  const result = await transactionCollection.find(filter).toArray();
  res.send(result)
})

// admin stats
app.get('/admin-stats',verifyToken,verifyAdmin, async(req , res)=>{
   const customers = await userCollection.estimatedDocumentCount();
   const products= await dishesCollection.estimatedDocumentCount();
   const orders = await transactionCollection.estimatedDocumentCount();
  //  total revenue khoyrati system
  // const allTransaction = await transactionCollection.find().toArray();
  // const totalRevenue = allTransaction.reduce((acc, item)=>acc+item.price, 0);

  // best way
  const revenue = await transactionCollection.aggregate([
     {
      $group:{
         _id:null, // null for finding data from all ids
         revenue:{
           $sum:"$price" 
         }
      }
     }
  ]).toArray();
  const totalRevenue = revenue[0].revenue || 0;
  res.send({customers, products , orders,totalRevenue})
})

//use aggregate pipeline
app.get('/order-stats',verifyToken,verifyAdmin, async(req,res)=>{
  const result = await transactionCollection.aggregate([
     {
      $unwind:"$dishes_ids"
     },
     {
      $lookup:{
         from:"dishes",
         localField:"dishes_ids",
         foreignField:"_id",
         as:"dishesitems"
      },
     },
     {
      $unwind:'$dishesitems'
     },
     {
      $group:{
        _id:'$dishesitems.category',
         quantity:{
          $sum:1,
         },
         revenue:{
           $sum:"$dishesitems.price"
         }
      }
     },
     {
      $project:{
          _id:0,
          category:'$_id',
          quantity:'$quantity',
          revenue:'$revenue'
      }
     }

  ]).toArray()
  res.send(result)
})



// get all users
app.get('/users',verifyToken,verifyAdmin, async(req,res)=>{
    const result = await userCollection.find().toArray();
    res.send(result)
})

// admin check api
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




// create-ssl-payment
app.post('/create-ssl-payment',verifyToken, async(req,res)=>{
  const tranxId = new ObjectId().toString();
  const payment = req.body;
  const initiate = {
    store_id:process.env.STORE_ID,
    store_passwd:process.env.STORE_PASS,
    total_amount: payment?.price,
    currency: 'BDT',
    tran_id:tranxId, // use unique tran_id for each api call
    shipping_method: 'Courier',
    multi_card_name:"mastercard,visacard,amexcard",
    success_url: process.env.SUCCESS_URL,
    fail_url:process.env.FAIL_URL,
    cancel_url:process.env.CANCLE_URL,
    ipn_url:process.env.IPN_URL,
    product_name: 'Computer.',
    product_category: 'Electronic',
    product_profile: 'general',
    cus_name: 'Customer Name',
    cus_email: payment?.email,
    cus_add1: 'Dhaka',
    cus_city: 'Dhaka',
    cus_state: 'Dhaka',
    cus_postcode: '1000',
    cus_country: 'Bangladesh',
    cus_phone: '01711111111',
    ship_name: 'Customer Name',
    ship_add1: 'Dhaka',  
    ship_city: 'Dhaka',
    ship_state: 'Dhaka',
    ship_postcode: 1000,
    ship_country: 'Bangladesh',
};
  // 
  const iniResponse = await axios({
    url:process.env.INI_API,
    method:"POST",
    data:initiate,
    // 
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
})
  payment.transactionId=tranxId;
  // 
  const response = await transactionCollection.insertOne(payment)
  //  
  const gatewayUrl = iniResponse.data?.GatewayPageURL;
  // 
  res.send({gatewayUrl})
 
})
//pay success 
app.post('/success-payment', async(req,res)=>{
  const paymentSuccess = req.body;
  // 
  //  validation
  const {data} = await axios.get(`https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php?val_id=${paymentSuccess?.val_id}&store_id=nexus6796a83e66816&store_passwd=nexus6796a83e66816@ssl&format=json`)
// 
  if(data?.status !== "VALID"){
     return res.status(404).send({message:"invalid payment"})
  }
  // update status after payment successs
  const updatePayment = await transactionCollection.updateOne({transactionId:data?.tran_id}, {
     $set:{ 
       status:"success"
     }
  })

  // cart item delete after payment
  const payment =  await transactionCollection.findOne({
    transactionId:data?.tran_id,
  })
  // 
  const query = { _id: {
    $in:payment.cartIds.map(id=> new ObjectId(id))
  }}
  const {deletedCount}= await cartDishesCollection.deleteMany(query);
  if(deletedCount > 0){
     res.redirect("https://bristro-boss-bae23.web.app/shop")
  }
  // 
})





// stripe payment secret 
app.post('/create-payment-intent',verifyToken, async(req,res)=>{
    const {price} = req.body;
    // stripe calculate money by decimel
    const amount = parseInt(price * 100);
    // create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
       amount:amount,
       currency: "usd",
       payment_method_types:[
        "card"
       ]
    })
    res.send({
      clientSecret: paymentIntent.client_secret,
    })
})
//add data to history
app.post('/transaction' ,verifyToken, async(req,res)=>{
  const payment = req.body;
  const transResult = await transactionCollection.insertOne(payment);
  // cart item delete after payment
  const query = { _id: {
    $in:payment.cartIds.map(id=> new ObjectId(id))
  }}
  const deleteResult = await cartDishesCollection.deleteMany(query);

//
mg.messages.create(process.env.MAiL_SAENDING_DOMAIN, {
  from: "Excited User <mailgun@sandboxaa64ad9dae964ce5a51918c6d50e079e.mailgun.org>",
  to: ["mehedihasan645356@gmail.com"],
  subject: "Your Order Success",
  text: "Hurry up and get ready for end delisious food",
  html: `
     <div>
         <h1>thanks for your order</h1>
          <h2>Your tansaction id is ${payment?.transactionId} </h2>
     </div>
  `
})
.then(msg => console.log(msg)) // logs response data
  .catch(err => console.error(err)); // logs any error




  // Send the response as a combined object
  res.status(200).json({
    success: true,
    transactionResult: transResult,
    deleteResult: deleteResult
  });
  
})

// add to cart
app.post('/addTocart',verifyToken, async (req,res)=>{
    const data = req.body;
    const result = await cartDishesCollection.insertOne(data);
    res.status(200).send(result)
})


// add product to database
app.post('/menu',verifyToken,verifyAdmin, async (req,res)=>{
    const menuData = req.body;
    const result = await dishesCollection.insertOne(menuData);
    res.status(201).send(result);
    
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
app.patch('/users/admin/:id',verifyToken,verifyAdmin, async(req,res)=>{
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
//update menu
app.patch('/menu/:id',verifyToken, verifyAdmin, async(req,res)=>{
  const id = req.params.id;
  const recepieData = req.body;
  const filter ={_id: new ObjectId(id)};
  const updatedMenu = {
     $set:{
          name:recepieData?.name,   
          category:recepieData?.category,
          price:recepieData?.price,
          recipe:recepieData?.recipe,
          image:recepieData?.image

     }
  } 
  const result = await dishesCollection.updateOne(filter, updatedMenu);
  res.send(result)
})


 // item delete from cart
app.delete('/cart/:id' ,verifyToken, async(req,res)=>{
  const id = req.params.id;
  const query = {_id: new ObjectId(id)};
  const result = await cartDishesCollection.deleteOne(query);
  res.status(200).send(result)
})

// delete user
app.delete('/users/:id',verifyToken,verifyAdmin, async(req,res)=>{
   const id = req.params.id;
   const query = {_id: new ObjectId(id)};
   const result = await userCollection.deleteOne(query);
   res.send(result)
})
// delete menu
app.delete('/menu/:id',verifyToken,verifyAdmin, async(req,res)=>{
   const id = req.params.id;
   const query = {_id: new ObjectId(id)};
   const result = await dishesCollection.deleteOne(query);
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